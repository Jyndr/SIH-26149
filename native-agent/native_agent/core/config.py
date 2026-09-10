from pathlib import Path
import os


BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get("CYPHORA_AGENT_DATA_DIR", BASE_DIR / "data")).resolve()
IMAGE_DIR = DATA_DIR / "images"
AUDIT_DIR = DATA_DIR / "audit"
AGENT_TOKEN = os.environ.get("CYPHORA_AGENT_TOKEN", "")
ENABLE_DESTRUCTIVE_ERASURE = os.environ.get("CYPHORA_ENABLE_DESTRUCTIVE_ERASURE", "").lower() in {"1", "true", "yes"}

IMAGE_DIR.mkdir(parents=True, exist_ok=True)
AUDIT_DIR.mkdir(parents=True, exist_ok=True)
