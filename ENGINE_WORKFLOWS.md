# Cyphora Engine Workflows

This document explains how to use the Recovery Engine and Erasure Engine from the command line, what each command does, and what safety limits currently exist.

## Recovery Engine

Location:

```bash
forensic-engine/
```

The Recovery Engine is a read-only forensic image analysis engine. It does not modify the source evidence image. It hashes the evidence, detects partitions and filesystems, recovers files from filesystem metadata, and then falls back to signature-based carving.

### Install

```bash
cd /home/abhiraj/SIH/SIH-26149/forensic-engine
python -m pip install -e .
```

This installs the local `forensic-engine` CLI in editable mode.

### List Supported Formats

```bash
forensic-engine formats
```

This lists registered file signatures and MIME types used by the carving engine.

### Verify Evidence Image

```bash
forensic-engine verify /path/to/evidence.img
```

This reads the image and prints JSON metadata, including hash, size, timestamps, and evidence status.

It does not recover files.

### Full Recovery

```bash
forensic-engine analyze /path/to/evidence.img \
  --case-id CASE-001 \
  --output /home/abhiraj/SIH/SIH-26149/test-runs/recovery
```

This runs the complete recovery pipeline and writes output under:

```text
/home/abhiraj/SIH/SIH-26149/test-runs/recovery/CASE-001/
```

It also writes:

```text
report.json
```

Pipeline steps:

1. Register evidence and calculate integrity metadata.
2. Open the image in read-only mode.
3. Detect MBR/GPT partitions.
4. Detect supported filesystems.
5. Recover active and deleted files from filesystem metadata.
6. Scan raw bytes for known file signatures.
7. Validate candidate files.
8. Carve valid contiguous artifacts.
9. Hash recovered artifacts.
10. Write the forensic report.

### Recover Allocated Files Only

```bash
forensic-engine analyze /path/to/evidence.img \
  --case-id CASE-001 \
  --output ./recovered \
  --allocated-only
```

This skips deleted-file recovery from filesystem metadata.

### Signature Carving Only

```bash
forensic-engine analyze /path/to/evidence.img \
  --case-id CASE-001 \
  --output ./recovered \
  --no-filesystem-recovery
```

This disables filesystem metadata recovery and uses signature scanning/carving only.

Carving can recover contiguous files, but usually cannot preserve original filenames, paths, or filesystem metadata.

### Limit Metadata-Recovered File Size

```bash
forensic-engine analyze /path/to/evidence.img \
  --case-id CASE-001 \
  --output ./recovered \
  --max-filesystem-file-size 1073741824
```

This limits each filesystem-recovered file to 1 GB.

### Tune Chunk and Carve Size

```bash
forensic-engine analyze /path/to/evidence.img \
  --case-id CASE-001 \
  --output ./recovered \
  --chunk-size 4194304 \
  --max-carve-size 104857600
```

This reads in 4 MB chunks and limits carved files to 100 MB.

### E01 Support

```bash
cd /home/abhiraj/SIH/SIH-26149/forensic-engine
python -m pip install -e '.[ewf]'
```

This installs optional EWF support for `.E01` forensic images.

### Run Recovery Tests

```bash
cd /home/abhiraj/SIH/SIH-26149
PYTHONPATH=/home/abhiraj/SIH/SIH-26149/forensic-engine python -m pytest forensic-engine/tests
```

## Erasure Engine

Locations:

```text
eraser/
native-agent/
backend/
frontend/
```

The Erasure Engine is exposed through the native agent. The native agent discovers connected storage devices, prepares sanitization plans, and can perform guarded live whole-device overwrite on eligible removable devices.

By default, destructive erasure is disabled.

### Install Native Agent

```bash
cd /home/abhiraj/SIH/SIH-26149/native-agent
python -m venv .venv
.venv/bin/pip install -r requirements.txt
```

This creates a Python virtual environment and installs FastAPI, Uvicorn, and the local `eraser` package.

### Start Native Agent In Dry-Run Mode

```bash
cd /home/abhiraj/SIH/SIH-26149/native-agent
CYPHORA_AGENT_TOKEN=change-me .venv/bin/python -m native_agent
```

This starts the local native agent at:

```text
http://127.0.0.1:8765
```

In this mode, the agent can inspect and plan sanitization, but it will not overwrite data.

### Check Agent Health

```bash
curl -H 'X-Cyphora-Agent-Token: change-me' \
  http://127.0.0.1:8765/health
```

Expected response includes:

```json
{
  "status": "ok",
  "service": "cyphora-native-agent",
  "destructiveOperationsEnabled": false
}
```

### List Connected Devices

```bash
curl -H 'X-Cyphora-Agent-Token: change-me' \
  http://127.0.0.1:8765/devices
```

This returns detected storage devices with fields such as:

```text
id
name
size
bus
removable
filesystem
mountPoint
mounted
readOnly
```

### Inspect Devices With lsblk

```bash
lsblk -o NAME,PATH,SIZE,TRAN,RM,RO,FSTYPE,MOUNTPOINT,MODEL,SERIAL,TYPE
```

Use this before erasure to confirm which Linux block device is the USB drive.

Example:

```text
sda   /dev/sda   15.2G usb 1 0 Flash Disk
sda1  /dev/sda1  15.2G     1 0 exfat /run/media/abhiraj/USB
```

### Prepare Sanitization Plan

```bash
curl -H 'X-Cyphora-Agent-Token: change-me' \
  -H 'Content-Type: application/json' \
  -d '{
    "deviceId": "dev_xxxxxxxxxxxxxxxxxxxxxxxx",
    "caseId": "CASE-001",
    "method": "CLEAR",
    "targetScope": "DEVICE"
  }' \
  http://127.0.0.1:8765/sanitization/prepare
```

This checks whether the target can be sanitized.

The response reports:

```text
recommendedMethod
supported
availableMethods
mode
requirements
counteredRecoveryPaths
reason
```

### Dry-Run Sanitization

```bash
curl -H 'X-Cyphora-Agent-Token: change-me' \
  -H 'Content-Type: application/json' \
  -d '{
    "deviceId": "dev_xxxxxxxxxxxxxxxxxxxxxxxx",
    "caseId": "CASE-001",
    "method": "CLEAR",
    "targetScope": "DEVICE"
  }' \
  http://127.0.0.1:8765/sanitization/start
```

This creates a sanitization result without modifying the device.

Expected dry-run fields:

```text
mode: DRY_RUN
executed: false
verificationStatus: NOT_EXECUTED
status: DRY_RUN
```

### Start Native Agent With Live Erasure Enabled

```bash
cd /home/abhiraj/SIH/SIH-26149/native-agent
CYPHORA_AGENT_TOKEN=change-me \
CYPHORA_ENABLE_DESTRUCTIVE_ERASURE=true \
.venv/bin/python -m native_agent
```

This enables destructive whole-device overwrite support.

The engine still refuses unsafe targets unless all conditions pass:

- target scope must be `DEVICE`
- device must be removable
- device must be unmounted
- device must not be read-only
- device path must be under `/dev`
- request must include `execute: true`
- request must include the exact confirmation phrase

### Unmount A Pendrive

```bash
udisksctl unmount -b /dev/sdX1
```

Example:

```bash
udisksctl unmount -b /dev/sda1
```

This unmounts the pendrive partition so the raw block device can be overwritten safely.

### Live Erase Through Native Agent

```bash
curl -H 'X-Cyphora-Agent-Token: change-me' \
  -H 'Content-Type: application/json' \
  -d '{
    "deviceId": "dev_xxxxxxxxxxxxxxxxxxxxxxxx",
    "caseId": "CASE-001",
    "method": "CLEAR",
    "targetScope": "DEVICE",
    "execute": true,
    "confirmation": "ERASE Flash Disk"
  }' \
  http://127.0.0.1:8765/sanitization/start
```

This overwrites the whole removable device with zeroes, syncs the write, and verifies a read-back sample from the start of the device.

Successful live response includes:

```text
mode: LIVE
executed: true
status: COMPLETED
verificationStatus: VERIFIED
bytesWritten
```

### Permission Requirement

Linux usually restricts raw block-device writes to `root` or members of the `disk` group.

If the native agent returns:

```text
Permission denied: '/dev/sdX'
```

then run the erase directly with sudo:

```bash
sudo dd if=/dev/zero of=/dev/sdX bs=16M status=progress conv=fsync
sync
```

Example:

```bash
sudo dd if=/dev/zero of=/dev/sda bs=16M status=progress conv=fsync
sync
```

Always verify the device first:

```bash
lsblk -o NAME,PATH,SIZE,TRAN,RM,RO,FSTYPE,MOUNTPOINT,MODEL,SERIAL,TYPE
```

Do not run `dd` unless the target is definitely the USB pendrive.

## CLEAR vs PURGE

`CLEAR` means overwriting user-addressable data, currently implemented as zero-fill overwrite for removable devices.

`PURGE` means stronger media sanitization, usually controller-native secure erase, cryptographic erase, or hardware-supported purge.

Current status:

```text
CLEAR overwrite: implemented for eligible removable unmounted devices
PURGE: planned/recommended but not implemented as controller-native purge
CRYPTOGRAPHIC_ERASE: planned only
DESTROY: planned only
FILE-level secure erase: planned only
```

For USB flash media, overwrite is useful but may not guarantee physical purge because flash controllers can use wear leveling and spare blocks.

## Website And Backend Workflow

Start backend:

```bash
cd /home/abhiraj/SIH/SIH-26149
PORT=5001 \
MONGODB_URI=mongodb://127.0.0.1:27017/cyphora \
CYPHORA_AGENT_TOKEN=change-me \
NATIVE_AGENT_URL=http://127.0.0.1:8765 \
npm run dev --workspace=backend
```

Start frontend:

```bash
cd /home/abhiraj/SIH/SIH-26149
npm run dev --workspace=frontend -- --host 127.0.0.1
```

Frontend URL:

```text
http://127.0.0.1:5174/
```

Check backend health:

```bash
curl http://127.0.0.1:5001/api/v1/health
```

Check backend-to-native-agent health:

```bash
curl -H 'Authorization: Bearer mock_jwt_token_jyndr_forensics_test' \
  http://127.0.0.1:5001/api/v1/native-agent/health
```

List devices through backend:

```bash
curl -H 'Authorization: Bearer mock_jwt_token_jyndr_forensics_test' \
  http://127.0.0.1:5001/api/v1/devices
```

## UI Notes

The Secure Erasure page now:

- shows cases in a dropdown
- displays `No cases found` when the case list is empty
- loads evidence for the selected case
- lets users select an evidence artifact instead of guessing an artifact ID
- keeps file-level erasure planned-only
- enables live erase only when the native agent reports the device is eligible
- requires typed confirmation before destructive erasure

