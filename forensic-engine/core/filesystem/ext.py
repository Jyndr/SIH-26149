"""Read-only ext2/ext3/ext4 metadata recovery.

The parser deliberately has no dependency on the carving pipeline.  Its public
``parse_ext`` function matches :class:`~core.filesystem.analyzer.FileSystemAnalyzer`
plugins and returns JSON-shaped dictionaries describing regular files.  Data is
not copied while metadata is analysed; instead every result contains logical to
absolute-image extents which an extractor can stream through ``ImageReader``.

Supported allocation formats are the ext2/3 block map (direct, single, double
and triple indirect blocks) and the ext4 extent tree.  Directory records are
walked from inode 2.  Plausible deleted records retained in directory slack and
unallocated inodes whose block maps survive are reported as deleted files.

All counts read from the image are bounded before they drive reads or loops.
Malformed metadata marks a file incomplete, or causes an invalid filesystem to
produce no results through ``parse_ext``; evidence is never modified.
"""
from __future__ import annotations

import struct
from collections import OrderedDict, deque
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterator

from core.image_reader.base import ImageReader
from core.partition import Partition


EXT_MAGIC = 0xEF53

# Superblock feature bits used by this parser.
EXT4_FEATURE_INCOMPAT_META_BG = 0x0010
EXT4_FEATURE_INCOMPAT_EXTENTS = 0x0040
EXT4_FEATURE_INCOMPAT_64BIT = 0x0080
EXT4_FEATURE_INCOMPAT_FILETYPE = 0x0002
EXT4_FEATURE_RO_COMPAT_SPARSE_SUPER = 0x0001
EXT4_FEATURE_RO_COMPAT_BIGALLOC = 0x0200
EXT4_FEATURE_COMPAT_SPARSE_SUPER2 = 0x0200

# Inode types and flags.
S_IFMT = 0xF000
S_IFDIR = 0x4000
S_IFREG = 0x8000
EXT4_INDEX_FL = 0x00001000
EXT4_EXTENTS_FL = 0x00080000
EXT4_INLINE_DATA_FL = 0x10000000
EXT4_ENCRYPT_FL = 0x00000800
EXT4_COMPR_FL = 0x00000004

EXTENT_MAGIC = 0xF30A
EXT_INIT_MAX_LEN = 1 << 15


class ExtFormatError(ValueError):
    """Raised when the partition does not contain a usable ext superblock."""


def _u16(data: bytes, offset: int) -> int:
    return struct.unpack_from("<H", data, offset)[0]


def _u32(data: bytes, offset: int) -> int:
    return struct.unpack_from("<I", data, offset)[0]


def _s32(data: bytes, offset: int) -> int:
    return struct.unpack_from("<i", data, offset)[0]


def _align4(value: int) -> int:
    return (value + 3) & ~3


def _ceil_div(value: int, divisor: int) -> int:
    return (value + divisor - 1) // divisor


def _decode_label(raw: bytes) -> str:
    return raw.split(b"\0", 1)[0].decode("utf-8", "replace").strip()


def _decode_timestamp(low: int, extra: int = 0) -> str | None:
    """Decode the signed 32-bit ext time plus ext4's two epoch bits."""
    if low == 0 and extra == 0:
        return None
    seconds = low + ((extra & 0x3) << 32)
    try:
        return datetime.fromtimestamp(seconds, timezone.utc).isoformat()
    except (OverflowError, OSError, ValueError):
        return None


@dataclass(frozen=True, slots=True)
class ExtSuperblock:
    inodes_count: int
    blocks_count: int
    first_data_block: int
    block_size: int
    cluster_ratio: int
    blocks_per_group: int
    inodes_per_group: int
    inode_size: int
    revision: int
    first_inode: int
    feature_compat: int
    feature_incompat: int
    feature_ro_compat: int
    descriptor_size: int
    first_meta_bg: int
    volume_name: str
    uuid: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "inodes_count": self.inodes_count,
            "blocks_count": self.blocks_count,
            "first_data_block": self.first_data_block,
            "block_size": self.block_size,
            "cluster_ratio": self.cluster_ratio,
            "blocks_per_group": self.blocks_per_group,
            "inodes_per_group": self.inodes_per_group,
            "inode_size": self.inode_size,
            "revision": self.revision,
            "first_inode": self.first_inode,
            "feature_compat": self.feature_compat,
            "feature_incompat": self.feature_incompat,
            "feature_ro_compat": self.feature_ro_compat,
            "descriptor_size": self.descriptor_size,
            "first_meta_bg": self.first_meta_bg,
            "volume_name": self.volume_name,
            "uuid": self.uuid,
        }


@dataclass(frozen=True, slots=True)
class ExtGroupDescriptor:
    index: int
    block_bitmap: int
    inode_bitmap: int
    inode_table: int
    flags: int


@dataclass(frozen=True, slots=True)
class _Inode:
    number: int
    image_offset: int
    raw: bytes
    allocated: bool | None
    mode: int
    uid: int
    gid: int
    size: int
    links: int
    flags: int
    blocks_512: int
    generation: int
    atime: int
    ctime: int
    mtime: int
    dtime: int
    atime_extra: int
    ctime_extra: int
    mtime_extra: int
    crtime: int
    crtime_extra: int

    @property
    def kind(self) -> int:
        return self.mode & S_IFMT


@dataclass(frozen=True, slots=True)
class _BlockRun:
    logical_block: int
    block_count: int
    physical_block: int | None
    sparse: bool = False
    unwritten: bool = False


class ExtFileSystemParser:
    """Bounded read-only ext metadata parser.

    Limits are intentionally configurable for callers analysing unusually large
    filesystems.  Defaults allow normal forensic images while preventing corrupt
    counters from causing unbounded memory, recursion, or I/O.
    """

    MAX_GROUPS = 1_048_576
    MAX_FILES = 250_000
    MAX_DIRECTORIES = 100_000
    MAX_DIRECTORY_BYTES = 256 * 1024 * 1024
    MAX_DELETED_SCAN_INODES = 262_144
    MAX_DELETED_SCAN_BYTES = 128 * 1024 * 1024
    MAX_METADATA_BLOCKS_PER_FILE = 262_144
    MAX_EXTENT_NODES_PER_FILE = 262_144
    MAX_EXTENTS_PER_FILE = 1_000_000
    MAX_EXTENT_DEPTH = 5
    MAX_BITMAP_CACHE = 64
    MAX_INODE_CACHE = 4096

    def __init__(
        self,
        reader: ImageReader,
        partition: Partition,
        *,
        recover_deleted: bool = True,
        max_files: int = MAX_FILES,
        max_deleted_scan_inodes: int = MAX_DELETED_SCAN_INODES,
    ) -> None:
        self.reader = reader
        self.partition = partition
        self.recover_deleted = recover_deleted
        self.max_files = max(1, min(int(max_files), self.MAX_FILES))
        self.max_deleted_scan_inodes = max(
            0, min(int(max_deleted_scan_inodes), self.MAX_DELETED_SCAN_INODES)
        )

        try:
            media_size = int(reader.size)
        except (RuntimeError, TypeError, ValueError) as exc:
            raise ExtFormatError("image reader is not open") from exc
        start = int(partition.start_offset)
        declared_size = int(partition.size)
        if start < 0 or declared_size <= 0 or start >= media_size:
            raise ExtFormatError("partition lies outside the image")
        self._start = start
        self._end = min(media_size, start + declared_size)
        if self._end - self._start < 2048:
            raise ExtFormatError("partition is too small for an ext superblock")

        self.superblock = self._read_superblock()
        self._effective_blocks = min(
            self.superblock.blocks_count,
            (self._end - self._start) // self.superblock.block_size,
        )
        if self._effective_blocks <= self.superblock.first_data_block:
            raise ExtFormatError("ext block range lies outside the partition")
        self.truncated = self._effective_blocks < self.superblock.blocks_count
        self.groups = self._read_group_descriptors()
        if not self.groups:
            raise ExtFormatError("no readable ext block group descriptors")

        self._inode_cache: OrderedDict[int, _Inode | None] = OrderedDict()
        self._inode_bitmap_cache: OrderedDict[int, bytes | None] = OrderedDict()
        self._block_bitmap_cache: OrderedDict[int, bytes | None] = OrderedDict()
        self._referenced_inodes: set[int] = set()
        self._emitted_deleted_inodes: set[int] = set()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @property
    def metadata(self) -> dict[str, Any]:
        result = self.superblock.to_dict()
        result.update({"group_count": len(self.groups), "truncated": self.truncated})
        return result

    def parse(self) -> list[dict[str, Any]]:
        """Return allocated and recoverable deleted regular-file records."""
        files: list[dict[str, Any]] = []
        self._walk_directory_tree(files)
        if self.recover_deleted and len(files) < self.max_files:
            self._discover_orphan_inodes(files)
        return files

    # ------------------------------------------------------------------
    # Bounded media access and filesystem geometry
    # ------------------------------------------------------------------

    def _read_absolute(self, offset: int, size: int) -> bytes:
        if size <= 0 or offset < self._start or offset >= self._end:
            return b""
        size = min(size, self._end - offset)
        try:
            return self.reader.read_at(offset, size)
        except (OSError, RuntimeError, ValueError):
            return b""

    def _read_relative(self, offset: int, size: int) -> bytes:
        if offset < 0:
            return b""
        return self._read_absolute(self._start + offset, size)

    def _valid_block(self, block: int) -> bool:
        return self.superblock.first_data_block <= block < self._effective_blocks

    def _read_block(self, block: int) -> bytes:
        if not self._valid_block(block):
            return b""
        return self._read_relative(
            block * self.superblock.block_size, self.superblock.block_size
        )

    def _read_superblock(self) -> ExtSuperblock:
        raw = self._read_relative(1024, 1024)
        if len(raw) != 1024 or _u16(raw, 0x38) != EXT_MAGIC:
            raise ExtFormatError("ext superblock magic is missing")

        log_block_size = _u32(raw, 0x18)
        if log_block_size > 6:
            raise ExtFormatError("unsupported ext block size")
        block_size = 1024 << log_block_size
        if block_size < 1024 or block_size > 65536 or block_size & (block_size - 1):
            raise ExtFormatError("invalid ext block size")

        revision = _u32(raw, 0x4C)
        inode_size = 128 if revision == 0 else _u16(raw, 0x58)
        if inode_size < 128 or inode_size > block_size or inode_size % 4:
            raise ExtFormatError("invalid ext inode size")

        feature_compat = _u32(raw, 0x5C)
        feature_incompat = _u32(raw, 0x60)
        feature_ro_compat = _u32(raw, 0x64)
        blocks_lo = _u32(raw, 0x04)
        blocks_hi = _u32(raw, 0x150) if feature_incompat & EXT4_FEATURE_INCOMPAT_64BIT else 0
        blocks_count = blocks_lo | (blocks_hi << 32)
        inodes_count = _u32(raw, 0x00)
        first_data_block = _u32(raw, 0x14)
        blocks_per_group = _u32(raw, 0x20)
        inodes_per_group = _u32(raw, 0x28)
        if (
            not blocks_count
            or not inodes_count
            or not blocks_per_group
            or not inodes_per_group
            or first_data_block >= blocks_count
        ):
            raise ExtFormatError("invalid ext filesystem geometry")

        descriptor_size = 32
        if feature_incompat & EXT4_FEATURE_INCOMPAT_64BIT:
            descriptor_size = _u16(raw, 0xFE)
            if descriptor_size < 64:
                raise ExtFormatError("invalid 64-bit ext group descriptor size")
        if descriptor_size > block_size or descriptor_size % 8:
            raise ExtFormatError("invalid ext group descriptor size")

        cluster_ratio = 1
        if feature_ro_compat & EXT4_FEATURE_RO_COMPAT_BIGALLOC:
            log_cluster_size = _s32(raw, 0x1C)
            if log_cluster_size < int(log_block_size) or log_cluster_size > 31:
                raise ExtFormatError("invalid ext bigalloc cluster size")
            cluster_ratio = 1 << (log_cluster_size - int(log_block_size))

        uuid_raw = raw[0x68:0x78]
        uuid_hex = uuid_raw.hex()
        uuid = (
            f"{uuid_hex[:8]}-{uuid_hex[8:12]}-{uuid_hex[12:16]}-"
            f"{uuid_hex[16:20]}-{uuid_hex[20:]}"
        )
        return ExtSuperblock(
            inodes_count=inodes_count,
            blocks_count=blocks_count,
            first_data_block=first_data_block,
            block_size=block_size,
            cluster_ratio=cluster_ratio,
            blocks_per_group=blocks_per_group,
            inodes_per_group=inodes_per_group,
            inode_size=inode_size,
            revision=revision,
            first_inode=_u32(raw, 0x54) if revision else 11,
            feature_compat=feature_compat,
            feature_incompat=feature_incompat,
            feature_ro_compat=feature_ro_compat,
            descriptor_size=descriptor_size,
            first_meta_bg=_u32(raw, 0x104),
            volume_name=_decode_label(raw[0x78:0x88]),
            uuid=uuid,
        )

    def _group_has_super(self, group: int) -> bool:
        sb = self.superblock
        if sb.feature_compat & EXT4_FEATURE_COMPAT_SPARSE_SUPER2:
            # Backup group numbers live at superblock offsets 0x24c/0x250.  They
            # are not needed for group zero, which always has the primary copy.
            raw = self._read_relative(1024 + 0x24C, 8)
            backups = {_u32(raw, 0), _u32(raw, 4)} if len(raw) == 8 else set()
            return group == 0 or group in backups
        if not (sb.feature_ro_compat & EXT4_FEATURE_RO_COMPAT_SPARSE_SUPER):
            return True
        if group in (0, 1):
            return True
        for base in (3, 5, 7):
            value = base
            while value < group:
                value *= base
            if value == group:
                return True
        return False

    def _descriptor_block(self, descriptor_block_index: int) -> int:
        sb = self.superblock
        if not (sb.feature_incompat & EXT4_FEATURE_INCOMPAT_META_BG) or (
            descriptor_block_index < sb.first_meta_bg
        ):
            return sb.first_data_block + 1 + descriptor_block_index
        descriptors_per_block = sb.block_size // sb.descriptor_size
        meta_group = descriptor_block_index * descriptors_per_block
        first = sb.first_data_block + meta_group * sb.blocks_per_group
        return first + (1 if self._group_has_super(meta_group) else 0)

    def _read_group_descriptors(self) -> list[ExtGroupDescriptor]:
        sb = self.superblock
        block_groups = _ceil_div(
            sb.blocks_count - sb.first_data_block, sb.blocks_per_group
        )
        inode_groups = _ceil_div(sb.inodes_count, sb.inodes_per_group)
        physical_groups = _ceil_div(
            self._effective_blocks - sb.first_data_block, sb.blocks_per_group
        )
        group_count = min(
            max(block_groups, inode_groups), physical_groups, self.MAX_GROUPS
        )
        descriptors_per_block = sb.block_size // sb.descriptor_size
        if not descriptors_per_block or group_count <= 0:
            return []

        descriptors: list[ExtGroupDescriptor] = []
        cached_block_number = -1
        cached_block = b""
        for group in range(group_count):
            desc_block_index, slot = divmod(group, descriptors_per_block)
            block_number = self._descriptor_block(desc_block_index)
            if block_number != cached_block_number:
                cached_block_number = block_number
                cached_block = self._read_block(block_number)
            offset = slot * sb.descriptor_size
            raw = cached_block[offset : offset + sb.descriptor_size]
            if len(raw) < 32:
                break
            block_bitmap = _u32(raw, 0x00)
            inode_bitmap = _u32(raw, 0x04)
            inode_table = _u32(raw, 0x08)
            if sb.feature_incompat & EXT4_FEATURE_INCOMPAT_64BIT and len(raw) >= 44:
                block_bitmap |= _u32(raw, 0x20) << 32
                inode_bitmap |= _u32(raw, 0x24) << 32
                inode_table |= _u32(raw, 0x28) << 32
            descriptors.append(
                ExtGroupDescriptor(
                    index=group,
                    block_bitmap=block_bitmap,
                    inode_bitmap=inode_bitmap,
                    inode_table=inode_table,
                    flags=_u16(raw, 0x12),
                )
            )
        return descriptors

    # ------------------------------------------------------------------
    # Bitmap and inode access
    # ------------------------------------------------------------------

    @staticmethod
    def _cache_put(cache: OrderedDict, key: int, value: Any, limit: int) -> None:
        cache[key] = value
        cache.move_to_end(key)
        while len(cache) > limit:
            cache.popitem(last=False)

    def _bitmap(self, group: int, *, inode: bool) -> bytes | None:
        cache = self._inode_bitmap_cache if inode else self._block_bitmap_cache
        if group in cache:
            value = cache[group]
            cache.move_to_end(group)
            return value
        if group < 0 or group >= len(self.groups):
            return None
        block = self.groups[group].inode_bitmap if inode else self.groups[group].block_bitmap
        raw = self._read_block(block)
        value = raw if len(raw) == self.superblock.block_size else None
        self._cache_put(cache, group, value, self.MAX_BITMAP_CACHE)
        return value

    def _inode_allocated(self, number: int) -> bool | None:
        if number < 1 or number > self.superblock.inodes_count:
            return None
        group, bit = divmod(number - 1, self.superblock.inodes_per_group)
        bitmap = self._bitmap(group, inode=True)
        if bitmap is None or bit // 8 >= len(bitmap):
            return None
        return bool(bitmap[bit // 8] & (1 << (bit & 7)))

    def _block_allocated(self, block: int) -> bool | None:
        sb = self.superblock
        if not self._valid_block(block):
            return None
        relative = block - sb.first_data_block
        group, within = divmod(relative, sb.blocks_per_group)
        bitmap = self._bitmap(group, inode=False)
        if bitmap is None:
            return None
        bit = within // sb.cluster_ratio
        if bit // 8 >= len(bitmap):
            return None
        return bool(bitmap[bit // 8] & (1 << (bit & 7)))

    def _read_inode(self, number: int) -> _Inode | None:
        if number in self._inode_cache:
            value = self._inode_cache[number]
            self._inode_cache.move_to_end(number)
            return value
        sb = self.superblock
        if number < 1 or number > sb.inodes_count:
            return None
        group, within_group = divmod(number - 1, sb.inodes_per_group)
        if group >= len(self.groups):
            return None
        table = self.groups[group].inode_table
        inode_offset = table * sb.block_size + within_group * sb.inode_size
        raw = self._read_relative(inode_offset, sb.inode_size)
        inode: _Inode | None = None
        if len(raw) == sb.inode_size:
            mode = _u16(raw, 0x00)
            uid = _u16(raw, 0x02)
            gid = _u16(raw, 0x18)
            if len(raw) >= 124:
                uid |= _u16(raw, 0x78) << 16
                gid |= _u16(raw, 0x7A) << 16
            size = _u32(raw, 0x04)
            if mode & S_IFMT == S_IFREG and len(raw) >= 112:
                size |= _u32(raw, 0x6C) << 32
            extra_size = _u16(raw, 0x80) if len(raw) >= 130 else 0
            has_extra_times = extra_size >= 0x20 and len(raw) >= 152
            inode = _Inode(
                number=number,
                image_offset=self._start + inode_offset,
                raw=raw,
                allocated=self._inode_allocated(number),
                mode=mode,
                uid=uid,
                gid=gid,
                size=size,
                links=_u16(raw, 0x1A),
                flags=_u32(raw, 0x20),
                blocks_512=_u32(raw, 0x1C)
                | ((_u16(raw, 0x74) << 32) if len(raw) >= 118 else 0),
                generation=_u32(raw, 0x64),
                atime=_s32(raw, 0x08),
                ctime=_s32(raw, 0x0C),
                mtime=_s32(raw, 0x10),
                dtime=_s32(raw, 0x14),
                ctime_extra=_u32(raw, 0x84) if has_extra_times else 0,
                mtime_extra=_u32(raw, 0x88) if has_extra_times else 0,
                atime_extra=_u32(raw, 0x8C) if has_extra_times else 0,
                crtime=_s32(raw, 0x90) if has_extra_times else 0,
                crtime_extra=_u32(raw, 0x94) if has_extra_times else 0,
            )
        self._cache_put(self._inode_cache, number, inode, self.MAX_INODE_CACHE)
        return inode

    # ------------------------------------------------------------------
    # Block maps
    # ------------------------------------------------------------------

    @staticmethod
    def _append_run(runs: list[_BlockRun], run: _BlockRun) -> bool:
        if run.block_count <= 0:
            return True
        if len(runs) >= ExtFileSystemParser.MAX_EXTENTS_PER_FILE:
            return False
        if runs:
            previous = runs[-1]
            logical_contiguous = (
                previous.logical_block + previous.block_count == run.logical_block
            )
            physical_contiguous = (
                previous.physical_block is not None
                and run.physical_block is not None
                and previous.physical_block + previous.block_count == run.physical_block
            )
            if (
                logical_contiguous
                and previous.sparse == run.sparse
                and previous.unwritten == run.unwritten
                and (previous.sparse or physical_contiguous)
            ):
                runs[-1] = _BlockRun(
                    previous.logical_block,
                    previous.block_count + run.block_count,
                    previous.physical_block,
                    previous.sparse,
                    previous.unwritten,
                )
                return True
        runs.append(run)
        return True

    def _map_inode(self, inode: _Inode) -> tuple[list[_BlockRun], bool, bytes | None]:
        if inode.size == 0:
            return [], True, None
        if inode.flags & EXT4_INLINE_DATA_FL:
            data, complete = self._inline_data(inode)
            if inode.flags & (EXT4_COMPR_FL | EXT4_ENCRYPT_FL):
                complete = False
            return [], complete, data
        total_blocks = _ceil_div(inode.size, self.superblock.block_size)
        if inode.flags & EXT4_EXTENTS_FL:
            runs, complete = self._map_extents(inode, total_blocks)
        else:
            runs, complete = self._map_indirect(inode, total_blocks)
        if inode.flags & (EXT4_COMPR_FL | EXT4_ENCRYPT_FL):
            # Raw compressed/encrypted payloads can still be preserved as
            # forensic bytes, but they are not the complete logical plaintext
            # described by the directory entry.
            complete = False
        return runs, complete, None

    def _map_indirect(
        self, inode: _Inode, total_blocks: int
    ) -> tuple[list[_BlockRun], bool]:
        sb = self.superblock
        pointers = struct.unpack_from("<15I", inode.raw, 0x28)
        fanout = sb.block_size // 4
        runs: list[_BlockRun] = []
        complete = True
        metadata_blocks = 0
        logical = 0

        def add(pointer: int, level: int, start: int, wanted: int) -> None:
            nonlocal complete, metadata_blocks
            if wanted <= 0:
                return
            capacity = fanout**level
            wanted = min(wanted, capacity)
            if pointer == 0:
                if not self._append_run(runs, _BlockRun(start, wanted, None, True)):
                    complete = False
                return
            if level == 0:
                if not self._valid_block(pointer):
                    complete = False
                    return
                if not self._append_run(runs, _BlockRun(start, 1, pointer)):
                    complete = False
                return
            if metadata_blocks >= self.MAX_METADATA_BLOCKS_PER_FILE:
                complete = False
                return
            raw = self._read_block(pointer)
            metadata_blocks += 1
            if len(raw) != sb.block_size:
                complete = False
                return
            child_capacity = fanout ** (level - 1)
            entries_needed = min(fanout, _ceil_div(wanted, child_capacity))
            for index in range(entries_needed):
                child_wanted = min(child_capacity, wanted - index * child_capacity)
                child = _u32(raw, index * 4)
                add(child, level - 1, start + index * child_capacity, child_wanted)
                if len(runs) >= self.MAX_EXTENTS_PER_FILE:
                    complete = False
                    return

        for pointer in pointers[:12]:
            if logical >= total_blocks:
                break
            add(pointer, 0, logical, 1)
            logical += 1
        for level, pointer in enumerate(pointers[12:], start=1):
            if logical >= total_blocks:
                break
            capacity = fanout**level
            wanted = min(capacity, total_blocks - logical)
            add(pointer, level, logical, wanted)
            logical += wanted
        if logical < total_blocks:
            complete = False
        return runs, complete

    def _map_extents(
        self, inode: _Inode, total_blocks: int
    ) -> tuple[list[_BlockRun], bool]:
        leaves: list[tuple[int, int, int, bool]] = []
        visited: set[int] = set()
        complete = True
        nodes = 0

        def walk(raw: bytes, expected_depth: int | None, physical_node: int | None) -> None:
            nonlocal complete, nodes
            if nodes >= self.MAX_EXTENT_NODES_PER_FILE:
                complete = False
                return
            nodes += 1
            if len(raw) < 12:
                complete = False
                return
            magic, entries, maximum, depth = struct.unpack_from("<HHHH", raw, 0)
            capacity = (len(raw) - 12) // 12
            if (
                magic != EXTENT_MAGIC
                or depth > self.MAX_EXTENT_DEPTH
                or (expected_depth is not None and depth != expected_depth)
                or entries > maximum
                or entries > capacity
                or maximum > capacity
            ):
                complete = False
                return
            if depth == 0:
                previous_logical = -1
                for index in range(entries):
                    offset = 12 + index * 12
                    logical = _u32(raw, offset)
                    encoded_length = _u16(raw, offset + 4)
                    physical = _u32(raw, offset + 8) | (_u16(raw, offset + 6) << 32)
                    unwritten = encoded_length > EXT_INIT_MAX_LEN
                    length = (
                        encoded_length - EXT_INIT_MAX_LEN
                        if unwritten
                        else encoded_length
                    )
                    if not length or logical <= previous_logical:
                        complete = False
                        continue
                    previous_logical = logical
                    if len(leaves) >= self.MAX_EXTENTS_PER_FILE:
                        complete = False
                        return
                    leaves.append((logical, physical, length, unwritten))
                return

            previous_index = -1
            for index in range(entries):
                offset = 12 + index * 12
                logical = _u32(raw, offset)
                child = _u32(raw, offset + 4) | (_u16(raw, offset + 8) << 32)
                if logical <= previous_index or child in visited or not self._valid_block(child):
                    complete = False
                    continue
                previous_index = logical
                visited.add(child)
                child_raw = self._read_block(child)
                if len(child_raw) != self.superblock.block_size:
                    complete = False
                    continue
                walk(child_raw, depth - 1, child)

        walk(inode.raw[0x28:0x64], None, None)
        leaves.sort(key=lambda item: item[0])
        runs: list[_BlockRun] = []
        cursor = 0
        for logical, physical, length, unwritten in leaves:
            if logical >= total_blocks:
                continue
            if logical < cursor:
                overlap = cursor - logical
                if overlap >= length:
                    complete = False
                    continue
                logical += overlap
                physical += overlap
                length -= overlap
                complete = False
            length = min(length, total_blocks - logical)
            if complete and logical > cursor:
                if not self._append_run(
                    runs, _BlockRun(cursor, logical - cursor, None, True)
                ):
                    complete = False
                    break
            if physical == 0 or physical >= self._effective_blocks:
                complete = False
                cursor = max(cursor, logical + length)
                continue
            valid_length = min(length, self._effective_blocks - physical)
            if valid_length != length:
                complete = False
            if unwritten:
                added = self._append_run(
                    runs, _BlockRun(logical, valid_length, None, True, True)
                )
            else:
                added = self._append_run(
                    runs, _BlockRun(logical, valid_length, physical)
                )
            if not added:
                complete = False
                break
            cursor = max(cursor, logical + length)
        if complete and cursor < total_blocks:
            if not self._append_run(
                runs, _BlockRun(cursor, total_blocks - cursor, None, True)
            ):
                complete = False
        return runs, complete

    def _inline_data(self, inode: _Inode) -> tuple[bytes, bool]:
        """Recover ext4 inline data stored in i_block and system.data xattr."""
        wanted = inode.size
        first = inode.raw[0x28:0x64][: min(60, wanted)]
        if len(first) >= wanted:
            return first, True
        remaining = wanted - len(first)
        if len(inode.raw) < 132:
            return first, False
        extra_isize = _u16(inode.raw, 0x80)
        header_offset = 128 + extra_isize
        if header_offset + 4 > len(inode.raw):
            return first, False
        if _u32(inode.raw, header_offset) != 0xEA020000:
            return first, False
        cursor = header_offset + 4
        while cursor + 16 <= len(inode.raw):
            name_len = inode.raw[cursor]
            name_index = inode.raw[cursor + 1]
            value_offset = _u16(inode.raw, cursor + 2)
            value_inum = _u32(inode.raw, cursor + 4)
            value_size = _u32(inode.raw, cursor + 8)
            if name_len == 0:
                break
            entry_end = cursor + 16 + name_len
            if entry_end > len(inode.raw):
                return first, False
            name = inode.raw[cursor + 16 : entry_end]
            if name_index == 7 and name == b"data" and value_inum == 0:
                # For inode-body xattrs, offsets are relative to the xattr
                # header.  Some older tools wrote inode-relative offsets, so
                # accept that only when the primary interpretation is invalid.
                candidates = (header_offset + value_offset, value_offset)
                for value_start in candidates:
                    value_end = value_start + value_size
                    if (
                        value_size >= remaining
                        and value_start >= header_offset
                        and value_end <= len(inode.raw)
                    ):
                        return first + inode.raw[value_start : value_start + remaining], True
                return first, False
            cursor = _align4(entry_end)
        return first, False

    # ------------------------------------------------------------------
    # Directory traversal and deleted metadata discovery
    # ------------------------------------------------------------------

    @staticmethod
    def _safe_name(raw: bytes) -> str | None:
        if not raw or b"\0" in raw or b"/" in raw:
            return None
        name = raw.decode("utf-8", "replace")
        if name in ("", ".", ".."):
            return None
        # Avoid control characters in report paths while retaining all other
        # decoded evidence text.
        return "".join(ch if ord(ch) >= 0x20 else "\ufffd" for ch in name)

    def _directory_blocks(self, inode: _Inode) -> tuple[list[tuple[int, bytes]], bool]:
        runs, complete, resident = self._map_inode(inode)
        if resident is not None:
            return [(0, resident)], complete
        blocks: list[tuple[int, bytes]] = []
        maximum_blocks = _ceil_div(
            min(inode.size, self.MAX_DIRECTORY_BYTES), self.superblock.block_size
        )
        for run in runs:
            if run.sparse or run.physical_block is None:
                continue
            for index in range(min(run.block_count, maximum_blocks)):
                logical = run.logical_block + index
                if logical >= maximum_blocks:
                    break
                raw = self._read_block(run.physical_block + index)
                if len(raw) != self.superblock.block_size:
                    complete = False
                    break
                blocks.append((logical, raw))
        if inode.size > self.MAX_DIRECTORY_BYTES:
            complete = False
        return blocks, complete

    def _parse_directory_block(
        self, raw: bytes, *, scan_slack: bool
    ) -> Iterator[tuple[int, str, int, bool]]:
        """Yield ``(inode, name, dirent_type, from_slack)`` records."""
        offset = 0
        limit = len(raw)
        while offset + 8 <= limit:
            inode_number = _u32(raw, offset)
            record_length = _u16(raw, offset + 4)
            name_length = raw[offset + 6]
            file_type = raw[offset + 7]
            if (
                record_length < 8
                or record_length % 4
                or offset + record_length > limit
                or name_length > 255
                or name_length > record_length - 8
            ):
                break
            name_end = offset + 8 + name_length
            name = self._safe_name(raw[offset + 8 : name_end])
            if (
                inode_number
                and inode_number <= self.superblock.inodes_count
                and file_type <= 7
                and name is not None
            ):
                yield inode_number, name, file_type, False

            minimum = _align4(8 + name_length)
            if scan_slack and record_length >= minimum + 8:
                slack_start = offset + minimum
                slack_end = offset + record_length
                yield from self._parse_deleted_slack(raw, slack_start, slack_end)
            offset += record_length

    def _parse_deleted_slack(
        self, raw: bytes, start: int, end: int
    ) -> Iterator[tuple[int, str, int, bool]]:
        cursor = _align4(start)
        while cursor + 8 <= end:
            inode_number = _u32(raw, cursor)
            record_length = _u16(raw, cursor + 4)
            name_length = raw[cursor + 6]
            file_type = raw[cursor + 7]
            plausible = (
                0 < inode_number <= self.superblock.inodes_count
                and record_length >= 8
                and record_length % 4 == 0
                and cursor + record_length <= end
                and 0 < name_length <= min(255, record_length - 8)
                and file_type <= 7
            )
            if plausible:
                name = self._safe_name(raw[cursor + 8 : cursor + 8 + name_length])
                # A slack record is useful only while its inode remains free;
                # an allocated inode may already describe a different file.
                if name is not None and self._inode_allocated(inode_number) is False:
                    yield inode_number, name, file_type, True
                    cursor += record_length
                    continue
            cursor += 4

    @staticmethod
    def _join_path(parent: str, name: str) -> str:
        return f"/{name}" if parent == "/" else f"{parent}/{name}"

    def _walk_directory_tree(self, files: list[dict[str, Any]]) -> None:
        root = self._read_inode(2)
        if root is None or root.kind != S_IFDIR:
            return
        queue: deque[tuple[_Inode, str]] = deque([(root, "/")])
        visited_directories: set[int] = set()
        directory_bytes = 0
        while queue and len(visited_directories) < self.MAX_DIRECTORIES:
            directory, parent_path = queue.popleft()
            if directory.number in visited_directories:
                continue
            visited_directories.add(directory.number)
            self._referenced_inodes.add(directory.number)
            blocks, _ = self._directory_blocks(directory)
            for logical, raw in blocks:
                remaining = max(0, directory.size - logical * self.superblock.block_size)
                block_raw = raw[: min(len(raw), remaining)]
                directory_bytes += len(block_raw)
                if directory_bytes > self.MAX_DIRECTORY_BYTES:
                    return
                scan_slack = self.recover_deleted and not (
                    directory.flags & EXT4_INDEX_FL
                )
                for inode_number, name, _type_hint, from_slack in self._parse_directory_block(
                    block_raw, scan_slack=scan_slack
                ):
                    if len(files) >= self.max_files:
                        return
                    inode = self._read_inode(inode_number)
                    if inode is None:
                        continue
                    self._referenced_inodes.add(inode_number)
                    path = self._join_path(parent_path, name)
                    deleted = bool(
                        from_slack
                        or inode.allocated is False
                        or inode.dtime != 0
                        or inode.links == 0
                    )
                    if inode.kind == S_IFDIR:
                        if not deleted and inode_number not in visited_directories:
                            queue.append((inode, path))
                        continue
                    if inode.kind != S_IFREG:
                        continue
                    if deleted and not self.recover_deleted:
                        continue
                    record = self._make_file_record(inode, name, path, deleted)
                    if record is None:
                        continue
                    files.append(record)
                    if deleted:
                        self._emitted_deleted_inodes.add(inode_number)

    def _discover_orphan_inodes(self, files: list[dict[str, Any]]) -> None:
        sb = self.superblock
        scanned = 0
        bytes_scanned = 0
        first = max(1, sb.first_inode)
        for number in range(first, sb.inodes_count + 1):
            if (
                scanned >= self.max_deleted_scan_inodes
                or bytes_scanned + sb.inode_size > self.MAX_DELETED_SCAN_BYTES
                or len(files) >= self.max_files
            ):
                break
            if number in self._referenced_inodes or number in self._emitted_deleted_inodes:
                continue
            allocated = self._inode_allocated(number)
            scanned += 1
            if allocated is not False:
                continue
            inode = self._read_inode(number)
            bytes_scanned += sb.inode_size
            if (
                inode is None
                or inode.kind != S_IFREG
                or (inode.dtime == 0 and inode.links != 0)
            ):
                continue
            name = f"inode-{number}"
            record = self._make_file_record(
                inode, name, f"/$deleted/{name}", deleted=True
            )
            if record is None:
                continue
            # Empty free inode-table slots and deleted inodes whose mapping was
            # wiped cannot contribute a recoverable artifact.
            if inode.size and not record["extents"] and "resident_data" not in record:
                continue
            files.append(record)
            self._emitted_deleted_inodes.add(number)

    # ------------------------------------------------------------------
    # Public record conversion
    # ------------------------------------------------------------------

    def _allocation_state(self, run: _BlockRun) -> str:
        if run.sparse or run.physical_block is None:
            return "not-applicable"
        seen_allocated = seen_free = seen_unknown = False
        # A run can be extremely large.  Cluster allocation is constant within
        # a cluster, but cap probes and report uncertainty beyond that bound.
        probes = min(run.block_count, 1_000_000)
        step = max(1, self.superblock.cluster_ratio)
        index = 0
        while index < probes:
            state = self._block_allocated(run.physical_block + index)
            if state is True:
                seen_allocated = True
            elif state is False:
                seen_free = True
            else:
                seen_unknown = True
            index += step
        if run.block_count > probes:
            seen_unknown = True
        if seen_unknown:
            return "unknown" if not (seen_allocated or seen_free) else "mixed"
        if seen_allocated and seen_free:
            return "mixed"
        return "allocated" if seen_allocated else "free"

    def _make_file_record(
        self, inode: _Inode, name: str, path: str, deleted: bool
    ) -> dict[str, Any] | None:
        runs, map_complete, resident = self._map_inode(inode)
        extents: list[dict[str, Any]] = []
        data_runs = 0
        potentially_reallocated = False
        for run in runs:
            logical_offset = run.logical_block * self.superblock.block_size
            if logical_offset >= inode.size:
                continue
            length = min(
                run.block_count * self.superblock.block_size,
                inode.size - logical_offset,
            )
            if length <= 0:
                continue
            state = self._allocation_state(run)
            if not run.sparse:
                data_runs += 1
                if deleted and state in ("allocated", "mixed"):
                    potentially_reallocated = True
            extents.append(
                {
                    "image_offset": (
                        None
                        if run.sparse or run.physical_block is None
                        else self._start + run.physical_block * self.superblock.block_size
                    ),
                    "logical_offset": logical_offset,
                    "length": length,
                    "sparse": run.sparse,
                    "unwritten": run.unwritten,
                    "block_allocation": state,
                }
            )

        if inode.size and resident is None and not extents:
            map_complete = False
        if resident is not None and len(resident) < inode.size:
            map_complete = False
        is_complete = bool(map_complete and not potentially_reallocated)
        recoverable = bool(
            inode.size == 0
            or (resident is not None and len(resident) > 0)
            or any(not extent["sparse"] for extent in extents)
            or (map_complete and extents)
        )
        timestamps = {
            "created": _decode_timestamp(inode.crtime, inode.crtime_extra),
            "modified": _decode_timestamp(inode.mtime, inode.mtime_extra),
            "changed": _decode_timestamp(inode.ctime, inode.ctime_extra),
            "accessed": _decode_timestamp(inode.atime, inode.atime_extra),
            "deleted": _decode_timestamp(inode.dtime),
        }
        result: dict[str, Any] = {
            "filesystem": "ext",
            "name": name,
            "path": path,
            "parent_path": path.rsplit("/", 1)[0] or "/",
            "inode": inode.number,
            "type": "file",
            "is_directory": False,
            "size": inode.size,
            "logical_size": inode.size,
            "allocated": not deleted and inode.allocated is not False,
            "deleted": deleted,
            "is_deleted": deleted,
            "status": "deleted" if deleted else "allocated",
            "recoverable": recoverable,
            "mode": inode.mode & 0x0FFF,
            "uid": inode.uid,
            "gid": inode.gid,
            "links": inode.links,
            "flags": inode.flags,
            "accessed_at": timestamps["accessed"],
            "modified_at": timestamps["modified"],
            "changed_at": timestamps["changed"],
            "created_at": timestamps["created"],
            "deleted_at": timestamps["deleted"],
            "timestamps": timestamps,
            "extents": extents,
            "is_complete": is_complete,
            "is_fragmented": data_runs > 1,
            "recovery_method": "filesystem",
            "metadata": {
                "inode_generation": inode.generation,
                "blocks_512": inode.blocks_512,
                "compressed": bool(inode.flags & EXT4_COMPR_FL),
                "encrypted": bool(inode.flags & EXT4_ENCRYPT_FL),
                "inline_data": bool(inode.flags & EXT4_INLINE_DATA_FL),
                "potentially_reallocated": potentially_reallocated,
            },
        }
        first_data = next(
            (extent["image_offset"] for extent in extents if extent["image_offset"] is not None),
            None,
        )
        result["offset"] = first_data
        if resident is not None:
            result["resident_data"] = resident[: inode.size]
            # The first inline bytes live in i_block inside the inode.  Expose
            # their evidence offset so the pipeline can suppress a duplicate
            # signature carve of the same resident payload.
            result["data_offset"] = inode.image_offset + 0x28
            result["offset"] = result["data_offset"]
        return result


def parse_ext(reader: ImageReader, partition: Partition) -> list[dict[str, Any]]:
    """Filesystem-analyzer plugin entry point.

    A corrupt or truncated ext header is treated as an unreadable filesystem and
    yields an empty list so metadata recovery cannot abort signature carving.
    Individual corrupt inodes or mapping trees are skipped/marked incomplete by
    :class:`ExtFileSystemParser`.
    """
    try:
        return ExtFileSystemParser(reader, partition).parse()
    except (ExtFormatError, IndexError, struct.error, OverflowError):
        return []


def iter_file_content(
    reader: ImageReader,
    entry: dict[str, Any],
    *,
    chunk_size: int = 1024 * 1024,
) -> Iterator[bytes]:
    """Stream a parsed entry's logical content without altering evidence.

    Sparse and unwritten ranges are materialised as zero bytes.  Callers should
    reject entries with ``is_complete == False`` when exact reconstruction is
    required.  This helper is filesystem-neutral enough for the integration
    layer but lives here to keep the extent contract executable and tested.
    """
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    size = int(entry.get("size", 0))
    if size < 0:
        raise ValueError("entry size must not be negative")
    resident = entry.get("resident_data")
    if resident is not None:
        if not isinstance(resident, (bytes, bytearray, memoryview)):
            raise ValueError("resident_data must be bytes-like")
        data = bytes(resident)[:size]
        for offset in range(0, len(data), chunk_size):
            yield data[offset : offset + chunk_size]
        return

    logical_cursor = 0
    for extent in sorted(entry.get("extents", []), key=lambda item: item["logical_offset"]):
        logical = int(extent["logical_offset"])
        length = min(int(extent["length"]), max(0, size - logical))
        if logical < logical_cursor or length < 0:
            raise ValueError("overlapping or invalid file extent")
        gap = min(logical - logical_cursor, max(0, size - logical_cursor))
        while gap:
            amount = min(gap, chunk_size)
            yield b"\0" * amount
            gap -= amount
            logical_cursor += amount
        if length <= 0:
            continue
        image_offset = extent.get("image_offset")
        if extent.get("sparse") or image_offset is None:
            remaining = length
            while remaining:
                amount = min(remaining, chunk_size)
                yield b"\0" * amount
                remaining -= amount
                logical_cursor += amount
            continue
        remaining = length
        absolute = int(image_offset)
        while remaining:
            amount = min(remaining, chunk_size)
            data = reader.read_at(absolute, amount)
            if len(data) != amount:
                raise IOError("short read while extracting ext file extent")
            yield data
            absolute += amount
            remaining -= amount
            logical_cursor += amount
    trailing = max(0, size - logical_cursor)
    while trailing:
        amount = min(trailing, chunk_size)
        yield b"\0" * amount
        trailing -= amount


def read_file_content(
    reader: ImageReader, entry: dict[str, Any], *, max_bytes: int = 64 * 1024 * 1024
) -> bytes:
    """Return a small parsed file in memory, with an explicit allocation bound."""
    size = int(entry.get("size", 0))
    if max_bytes < 0 or size < 0 or size > max_bytes:
        raise ValueError("file exceeds max_bytes")
    return b"".join(iter_file_content(reader, entry))


__all__ = [
    "ExtFileSystemParser",
    "ExtFormatError",
    "ExtGroupDescriptor",
    "ExtSuperblock",
    "iter_file_content",
    "parse_ext",
    "read_file_content",
]
