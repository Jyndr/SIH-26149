import hashlib


def safe_device_id(platform_name: str, path: str, serial: str | None) -> str:
    identity = f"{platform_name}\0{serial or ''}\0{path}".encode("utf-8", "replace")
    return f"dev_{hashlib.sha256(identity).hexdigest()[:24]}"

