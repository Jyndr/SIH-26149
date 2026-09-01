from __future__ import annotations

import struct

from core.filesystem.ext import ExtFileSystemParser, parse_ext, read_file_content
from core.image_reader.base import ImageReader
from core.partition import Partition


BLOCK = 1024
BLOCKS = 64
INODES = 32


class MemoryImageReader(ImageReader):
    def __init__(self, data: bytes) -> None:
        self.data = data
        self.position = 0
        self.opened = True

    def open(self) -> None:
        self.opened = True

    def close(self) -> None:
        self.opened = False

    def read(self, size: int = -1) -> bytes:
        if not self.opened:
            raise RuntimeError("closed")
        end = len(self.data) if size < 0 else min(len(self.data), self.position + size)
        result = self.data[self.position : end]
        self.position = end
        return result

    def seek(self, offset: int) -> None:
        if not self.opened:
            raise RuntimeError("closed")
        if offset < 0:
            raise ValueError("negative offset")
        self.position = offset

    def tell(self) -> int:
        return self.position

    @property
    def size(self) -> int:
        return len(self.data)


def _pack_dirent(
    image: bytearray,
    absolute: int,
    inode: int,
    record_length: int,
    name: bytes,
    file_type: int,
) -> None:
    struct.pack_into("<IHBB", image, absolute, inode, record_length, len(name), file_type)
    image[absolute + 8 : absolute + 8 + len(name)] = name


def _set_bitmap_bit(image: bytearray, block: int, bit: int) -> None:
    image[block * BLOCK + bit // 8] |= 1 << (bit & 7)


def _base_ext_image(*, inode_size: int, incompat: int = 0, prefix: int = 0) -> bytearray:
    image = bytearray(prefix + BLOCKS * BLOCK)
    base = prefix
    superblock = base + BLOCK
    struct.pack_into("<I", image, superblock + 0x00, INODES)
    struct.pack_into("<I", image, superblock + 0x04, BLOCKS)
    struct.pack_into("<I", image, superblock + 0x14, 1)
    struct.pack_into("<I", image, superblock + 0x18, 0)
    struct.pack_into("<I", image, superblock + 0x20, BLOCKS)
    struct.pack_into("<I", image, superblock + 0x28, INODES)
    struct.pack_into("<H", image, superblock + 0x38, 0xEF53)
    struct.pack_into("<I", image, superblock + 0x4C, 1)
    struct.pack_into("<I", image, superblock + 0x54, 11)
    struct.pack_into("<H", image, superblock + 0x58, inode_size)
    struct.pack_into("<I", image, superblock + 0x60, incompat)
    image[superblock + 0x68 : superblock + 0x78] = bytes(range(16))
    image[superblock + 0x78 : superblock + 0x80] = b"TESTEXT\0"

    # One group: block bitmap 3, inode bitmap 4, inode table 5.
    descriptor = base + 2 * BLOCK
    struct.pack_into("<III", image, descriptor, 3, 4, 5)
    inode_table_end = 5 + (INODES * inode_size + BLOCK - 1) // BLOCK
    for used_block in range(1, inode_table_end):
        _set_bitmap_bit(image, 3 + prefix // BLOCK, used_block - 1)
    return image


def _inode_offset(prefix: int, inode_size: int, inode_number: int) -> int:
    return prefix + 5 * BLOCK + (inode_number - 1) * inode_size


def _write_inode(
    image: bytearray,
    *,
    prefix: int,
    inode_size: int,
    number: int,
    mode: int,
    size: int,
    links: int,
    pointers: list[int] | None = None,
    flags: int = 0,
    dtime: int = 0,
) -> int:
    offset = _inode_offset(prefix, inode_size, number)
    struct.pack_into("<H", image, offset + 0x00, mode)
    struct.pack_into("<I", image, offset + 0x04, size & 0xFFFFFFFF)
    struct.pack_into("<iii", image, offset + 0x08, 1_600_000_001, 1_600_000_002, 1_600_000_003)
    struct.pack_into("<i", image, offset + 0x14, dtime)
    struct.pack_into("<H", image, offset + 0x1A, links)
    struct.pack_into("<I", image, offset + 0x20, flags)
    if mode & 0xF000 == 0x8000:
        struct.pack_into("<I", image, offset + 0x6C, size >> 32)
    if pointers:
        for index, pointer in enumerate(pointers[:15]):
            struct.pack_into("<I", image, offset + 0x28 + index * 4, pointer)
    return offset


def _mark_inode(image: bytearray, prefix: int, inode_number: int) -> None:
    bitmap = prefix + 4 * BLOCK
    image[bitmap + (inode_number - 1) // 8] |= 1 << ((inode_number - 1) & 7)


def _mark_block(image: bytearray, prefix: int, block: int) -> None:
    bitmap = prefix + 3 * BLOCK
    image[bitmap + (block - 1) // 8] |= 1 << ((block - 1) & 7)


def _ext2_direct_and_indirect_image(prefix: int = 0) -> bytes:
    inode_size = 128
    image = _base_ext_image(inode_size=inode_size, incompat=0x2, prefix=prefix)
    _mark_inode(image, prefix, 2)
    _mark_inode(image, prefix, 12)
    _mark_inode(image, prefix, 14)

    _write_inode(
        image,
        prefix=prefix,
        inode_size=inode_size,
        number=2,
        mode=0o040755,
        size=BLOCK,
        links=2,
        pointers=[10],
    )
    _write_inode(
        image,
        prefix=prefix,
        inode_size=inode_size,
        number=12,
        mode=0o100644,
        size=1400,
        links=1,
        pointers=[20, 22],
    )
    _write_inode(
        image,
        prefix=prefix,
        inode_size=inode_size,
        number=13,
        mode=0o100600,
        size=7,
        links=0,
        pointers=[23],
        dtime=1_600_001_000,
    )
    indirect_pointers = list(range(24, 36)) + [36]
    _write_inode(
        image,
        prefix=prefix,
        inode_size=inode_size,
        number=14,
        mode=0o100640,
        size=12 * BLOCK + 5,
        links=1,
        pointers=indirect_pointers,
    )
    struct.pack_into("<I", image, prefix + 36 * BLOCK, 37)

    directory = prefix + 10 * BLOCK
    _pack_dirent(image, directory, 2, 12, b".", 2)
    _pack_dirent(image, directory + 12, 2, 12, b"..", 2)
    # alpha.bin's enlarged record retains gone.txt at its original aligned end.
    _pack_dirent(image, directory + 24, 12, 40, b"alpha.bin", 1)
    _pack_dirent(image, directory + 44, 13, 20, b"gone.txt", 1)
    _pack_dirent(image, directory + 64, 14, BLOCK - 64, b"indirect.bin", 1)

    image[prefix + 20 * BLOCK : prefix + 21 * BLOCK] = b"A" * BLOCK
    image[prefix + 22 * BLOCK : prefix + 22 * BLOCK + 376] = b"B" * 376
    image[prefix + 23 * BLOCK : prefix + 23 * BLOCK + 7] = b"DELETED"
    for block in (20, 22, *range(24, 38)):
        _mark_block(image, prefix, block)
    # The deleted block is deliberately free in the block bitmap.
    for logical, block in enumerate(range(24, 36)):
        image[prefix + block * BLOCK : prefix + (block + 1) * BLOCK] = bytes(
            [logical + 1]
        ) * BLOCK
    image[prefix + 37 * BLOCK : prefix + 37 * BLOCK + 5] = b"TAIL!"
    return bytes(image)


def _extent_header(image: bytearray, offset: int, entries: int, maximum: int, depth: int) -> None:
    struct.pack_into("<HHHHI", image, offset, 0xF30A, entries, maximum, depth, 0)


def _extent_leaf(
    image: bytearray, offset: int, logical: int, physical: int, length: int
) -> None:
    struct.pack_into(
        "<IHHI", image, offset, logical, length, (physical >> 32) & 0xFFFF, physical & 0xFFFFFFFF
    )


def _ext4_extent_image(prefix: int = 4096) -> bytes:
    inode_size = 256
    image = _base_ext_image(inode_size=inode_size, incompat=0x42, prefix=prefix)
    _mark_inode(image, prefix, 2)
    _mark_inode(image, prefix, 12)
    root = _write_inode(
        image,
        prefix=prefix,
        inode_size=inode_size,
        number=2,
        mode=0o040755,
        size=BLOCK,
        links=2,
        flags=0x80000,
    )
    _extent_header(image, root + 0x28, 1, 4, 0)
    _extent_leaf(image, root + 0x34, 0, 14, 1)

    file_inode = _write_inode(
        image,
        prefix=prefix,
        inode_size=inode_size,
        number=12,
        mode=0o100644,
        size=3 * BLOCK,
        links=1,
        flags=0x80000,
    )
    struct.pack_into("<H", image, file_inode + 0x80, 0x20)
    struct.pack_into("<I", image, file_inode + 0x90, 1_650_000_000)
    _extent_header(image, file_inode + 0x28, 1, 4, 1)
    struct.pack_into("<IIHH", image, file_inode + 0x34, 0, 18, 0, 0)

    node = prefix + 18 * BLOCK
    _extent_header(image, node, 2, 84, 0)
    _extent_leaf(image, node + 12, 0, 20, 1)
    _extent_leaf(image, node + 24, 2, 22, 1)

    directory = prefix + 14 * BLOCK
    _pack_dirent(image, directory, 2, 12, b".", 2)
    _pack_dirent(image, directory + 12, 2, 12, b"..", 2)
    _pack_dirent(image, directory + 24, 12, BLOCK - 24, b"extent.dat", 1)
    image[prefix + 20 * BLOCK : prefix + 21 * BLOCK] = b"X" * BLOCK
    image[prefix + 22 * BLOCK : prefix + 23 * BLOCK] = b"Y" * BLOCK
    for block in (14, 18, 20, 22):
        _mark_block(image, prefix, block)
    return bytes(image)


def test_ext2_recovers_paths_deleted_slack_and_indirect_blocks() -> None:
    data = _ext2_direct_and_indirect_image()
    reader = MemoryImageReader(data)
    partition = Partition(1, 0, len(data), "raw")

    parser = ExtFileSystemParser(reader, partition)
    files = {entry["path"]: entry for entry in parser.parse()}

    assert parser.metadata["volume_name"] == "TESTEXT"
    assert set(files) == {"/alpha.bin", "/gone.txt", "/indirect.bin"}
    assert files["/alpha.bin"]["is_fragmented"] is True
    assert files["/alpha.bin"]["extents"][0]["image_offset"] == 20 * BLOCK
    assert read_file_content(reader, files["/alpha.bin"]) == b"A" * BLOCK + b"B" * 376

    deleted = files["/gone.txt"]
    assert deleted["deleted"] is True
    assert deleted["allocated"] is False
    assert deleted["deleted_at"] == "2020-09-13T12:43:20+00:00"
    assert read_file_content(reader, deleted) == b"DELETED"

    indirect = files["/indirect.bin"]
    assert len(indirect["extents"]) == 2
    assert indirect["extents"][1]["image_offset"] == 37 * BLOCK
    assert read_file_content(reader, indirect)[-5:] == b"TAIL!"


def test_ext4_extent_tree_sparse_range_and_partition_relative_offsets() -> None:
    prefix = 4096
    data = _ext4_extent_image(prefix)
    reader = MemoryImageReader(data)
    partition = Partition(7, prefix, BLOCKS * BLOCK, "0x83")

    files = parse_ext(reader, partition)

    assert len(files) == 1
    entry = files[0]
    assert entry["path"] == "/extent.dat"
    assert entry["created_at"] == "2022-04-15T05:20:00+00:00"
    assert [extent["sparse"] for extent in entry["extents"]] == [False, True, False]
    assert entry["extents"][0]["image_offset"] == prefix + 20 * BLOCK
    assert entry["extents"][1]["image_offset"] is None
    assert entry["is_fragmented"] is True
    assert read_file_content(reader, entry) == b"X" * BLOCK + b"\0" * BLOCK + b"Y" * BLOCK


def test_corrupt_extent_node_is_bounded_and_does_not_abort_metadata_walk() -> None:
    prefix = 4096
    image = bytearray(_ext4_extent_image(prefix))
    file_inode = _inode_offset(prefix, 256, 12)
    # Point the index outside the declared filesystem.
    struct.pack_into("<I", image, file_inode + 0x38, 0xFFFFFFF0)
    reader = MemoryImageReader(bytes(image))
    partition = Partition(1, prefix, BLOCKS * BLOCK, "0x83")

    files = parse_ext(reader, partition)

    assert len(files) == 1
    assert files[0]["path"] == "/extent.dat"
    assert files[0]["is_complete"] is False
    assert files[0]["extents"] == []


def test_ext4_inline_data_is_recovered_and_encryption_is_not_claimed_complete() -> None:
    inode_size = 256
    image = _base_ext_image(inode_size=inode_size, incompat=0x8002)
    _mark_inode(image, 0, 2)
    _mark_inode(image, 0, 12)
    _write_inode(
        image, prefix=0, inode_size=inode_size, number=2,
        mode=0o040755, size=BLOCK, links=2, pointers=[14],
    )
    inline_inode = _write_inode(
        image, prefix=0, inode_size=inode_size, number=12,
        mode=0o100600, size=5, links=1, flags=0x10000800,
    )
    image[inline_inode + 0x28:inline_inode + 0x2D] = b"HELLO"
    directory = 14 * BLOCK
    _pack_dirent(image, directory, 2, 12, b".", 2)
    _pack_dirent(image, directory + 12, 2, 12, b"..", 2)
    _pack_dirent(image, directory + 24, 12, BLOCK - 24, b"inline.bin", 1)
    _mark_block(image, 0, 14)
    reader = MemoryImageReader(bytes(image))

    entry = parse_ext(reader, Partition(1, 0, len(image), "raw"))[0]

    assert entry["resident_data"] == b"HELLO"
    assert entry["data_offset"] == inline_inode + 0x28
    assert read_file_content(reader, entry) == b"HELLO"
    assert entry["metadata"]["encrypted"] is True
    assert entry["is_complete"] is False


def test_encrypted_ext4_payload_is_not_reported_as_complete_plaintext() -> None:
    prefix = 4096
    image = bytearray(_ext4_extent_image(prefix))
    file_inode = _inode_offset(prefix, 256, 12)
    flags = struct.unpack_from("<I", image, file_inode + 0x20)[0]
    struct.pack_into("<I", image, file_inode + 0x20, flags | 0x800)
    reader = MemoryImageReader(bytes(image))
    partition = Partition(1, prefix, BLOCKS * BLOCK, "0x83")

    entry = parse_ext(reader, partition)[0]

    assert entry["metadata"]["encrypted"] is True
    assert entry["is_complete"] is False
    # Physical ciphertext extents remain available for forensic preservation.
    assert len(entry["extents"]) == 3


def test_invalid_superblock_returns_no_files() -> None:
    data = bytes(BLOCKS * BLOCK)
    reader = MemoryImageReader(data)
    partition = Partition(1, 0, len(data), "raw")
    assert parse_ext(reader, partition) == []
