#!/usr/bin/env python3
"""Generate School Intelligence cloud dashboard module under dashboard/."""
from __future__ import annotations

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
CREATED: list[str] = []
ERRORS: list[str] = []


def emit(rel: str, content: str) -> None:
    try:
        path = ROOT / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        text = content.rstrip() + "\n"
        path.write_text(text, encoding="utf-8")
        CREATED.append(rel)
    except Exception as e:
        ERRORS.append(f"{rel}: {e}")


def patch_sidebar() -> None:
    rel = "components/layout/sidebar.tsx"
    path = ROOT / rel
    if not path.exists():
        ERRORS.append(f"{rel}: not found")
        return
    src = path.read_text(encoding="utf-8")
    if "school-intelligence" in src and "GraduationCap" in src:
        return
    if "GraduationCap" not in src:
        src = src.replace(
            "  BrainCircuit,\n} from 'lucide-react';",
            "  BrainCircuit,\n  GraduationCap,\n} from 'lucide-react';",
        )
    block = """
  {
    id: 'school-intelligence',
    label: '12. School Intelligence',
    icon: GraduationCap,
    items: [
      { href: '/dashboard/school-intelligence', label: 'Overview' },
      { href: '/dashboard/school-intelligence/campus-safety', label: 'Campus Safety' },
      { href: '/dashboard/school-intelligence/zones-schedule', label: 'Zones & Schedule' },
      { href: '/dashboard/school-intelligence/occupancy', label: 'Occupancy' },
      { href: '/dashboard/school-intelligence/incidents', label: 'Incidents' },
      { href: '/dashboard/school-intelligence/digest', label: 'Daily Digest' },
    ],
  },
"""
    marker = "  },\n];\n\ntype SidebarProps"
    if "id: 'school-intelligence'" not in src:
        if marker not in src:
            ERRORS.append(f"{rel}: could not find navSections end marker")
            return
        src = src.replace(marker, "  }," + block + "];\n\ntype SidebarProps")
    path.write_text(src, encoding="utf-8")
    CREATED.append(rel + " (patched)")


def lib_files() -> None:
    emit("lib/school-intelligence/types.ts", TYPES_TS)
    emit("lib/school-intelligence/constants.ts", CONSTANTS_TS)
    emit("lib/school-intelligence/safety-scores.ts", SAFETY_SCORES_TS)
    emit("lib/school-intelligence/summary-templates.ts", SUMMARY_TEMPLATES_TS)
    emit("lib/school-intelligence/bell-schedule.ts", BELL_SCHEDULE_TS)
    emit("lib/school-intelligence/zones-demo.ts", ZONES_DEMO_TS)
    emit("lib/school-intelligence/occupancy.ts", OCCUPANCY_TS)
    emit("lib/school-intelligence/incidents.ts", INCIDENTS_TS)
    emit("lib/school-intelligence/digest.ts", DIGEST_TS)
    emit("lib/school-intelligence/store.ts", STORE_TS)


def component_files() -> None:
    for name, body in COMPONENTS.items():
        emit(f"components/school-intelligence/{name}", body)


def page_files() -> None:
    for name, body in PAGES.items():
        emit(f"app/(dashboard)/dashboard/school-intelligence/{name}", body)


def api_files() -> None:
    for name, body in API_ROUTES.items():
        emit(f"app/api/school-intelligence/{name}/route.ts", body)


def main() -> int:
    lib_files()
    component_files()
    page_files()
    api_files()
    patch_sidebar()
    print(f"Created/updated {len(CREATED)} paths")
    for p in sorted(CREATED):
        print(f"  - {p}")
    if ERRORS:
        print("Errors:", file=sys.stderr)
        for e in ERRORS:
            print(f"  ! {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
