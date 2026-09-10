# Cyphora Native Agent

Local, localhost-only bridge between Cyphora and storage devices. This version supports device discovery, read-only RAW/IMG acquisition, and dry-run sanitization planning. It contains no destructive write implementation.

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt
CYPHORA_AGENT_TOKEN=change-me .venv/bin/python -m native_agent
```

The service binds to `127.0.0.1:8765`. Configure the Node backend with the same `CYPHORA_AGENT_TOKEN` and `NATIVE_AGENT_URL=http://127.0.0.1:8765`. Start it from the `native-agent` directory so the editable `../eraser` dependency resolves correctly.

The backend additionally accepts `CYPHORA_AGENT_IMAGE_ROOT` when the agent data directory is customized. It must point to the agent's `images` directory; completed image paths outside that root are rejected.

Acquired images are written beneath `CYPHORA_AGENT_DATA_DIR` (default: `native-agent/data`). E01 is represented by the acquisition interface but is rejected unless a future EWF provider is installed; RAW and IMG use a read-only bitstream copy.
