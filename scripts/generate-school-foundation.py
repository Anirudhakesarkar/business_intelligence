#!/usr/bin/env python3
"""Generate Phase 1 School Foundation module (cloud dashboard only)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / "lib/school-foundation"
COMP = ROOT / "components/school-management"
APP = ROOT / "app/(dashboard)/dashboard/school-management"
API = ROOT / "app/api"


def w(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
    print(f"w {path.relative_to(ROOT)}")


# See continuation - file split for maintainability
# Run: python3 scripts/generate-school-foundation.py
