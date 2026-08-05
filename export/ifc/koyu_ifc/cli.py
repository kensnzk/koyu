"""One command, rather than two.

Reading a `.muro` file is koyu's job and writing IFC is this package's, so the work genuinely
happens in two runtimes. That is an implementation detail and not something a caller should have
to hold, so `koyu-ifc export building.muro -o building.ifc` runs both.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from .export import export

FORM_SCRIPT = Path(__file__).resolve().parents[1] / "bin" / "koyu-form.mjs"


def read_model(entry: Path) -> dict:
    """Ask koyu for the model. Its stderr is passed through — a diagnostic is worth reading."""
    result = subprocess.run(
        ["node", str(FORM_SCRIPT), str(entry)], capture_output=True, text=False
    )
    if result.returncode != 0:
        sys.stderr.write(result.stderr.decode("utf-8", "replace"))
        raise SystemExit(result.returncode)
    return json.loads(result.stdout)


def main(argv: list = None) -> int:
    parser = argparse.ArgumentParser(prog="koyu-ifc", description="Write a koyu building as IFC4")
    sub = parser.add_subparsers(dest="command", required=True)

    write = sub.add_parser("export", help="write the entry .muro out as IFC4")
    write.add_argument("entry", type=Path, help="the entry .muro file; imports are composed")
    write.add_argument("-o", "--out", type=Path, help="where to write (default: alongside the entry)")

    args = parser.parse_args(argv)
    out = args.out or args.entry.with_suffix(".ifc")
    data = read_model(args.entry)
    f = export(data)
    out.parent.mkdir(parents=True, exist_ok=True)
    f.write(str(out))

    counts = {
        kind: len(f.by_type(kind))
        for kind in ("IfcSpace", "IfcWall", "IfcDoor", "IfcWindow", "IfcSlab", "IfcRelSpaceBoundary")
    }
    print(f"Wrote {out}")
    print("  " + " / ".join(f"{n} {k[3:]}" for k, n in counts.items() if n))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
