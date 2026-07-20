"""Compatibility loader for the documented hyphenated unittest module name."""

import importlib.util
import sys
from pathlib import Path


_module_name = f"{__name__}.sprite-tools"
_test_file = Path(__file__).with_name("sprite-tools.test.py")
_spec = importlib.util.spec_from_file_location(_module_name, _test_file)
assert _spec and _spec.loader
_module = importlib.util.module_from_spec(_spec)
sys.modules[_module_name] = _module
_spec.loader.exec_module(_module)
setattr(sys.modules[__name__], "sprite-tools", _module)
