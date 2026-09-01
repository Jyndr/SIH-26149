"""Image reader subpackage — evidence image abstraction."""
from core.image_reader.base import ImageReader
from core.image_reader.raw import RawImageReader
from core.image_reader.ewf import EwfImageReader, detect_image_type, open_image

__all__ = ["ImageReader", "RawImageReader", "EwfImageReader", "detect_image_type", "open_image"]
