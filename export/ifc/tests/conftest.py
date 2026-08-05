"""One koyu model and the IFC written from it, for every bundled building."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import ifcopenshell
import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from koyu_ifc.export import export  # noqa: E402

# Every bundled building. The small ones carry the shapes that are easy to get wrong (an L, a
# void, a semi-outdoor terrace); the large ones carry the counts that catch anything quadratic.
EXAMPLES = [
    "examples/two-rooms.muro",
    "examples/office.muro",
    "examples/house/main.muro",
    "examples/basement/main.muro",
    "examples/mansion.muro",
    "examples/tower/main.muro",
    "examples/complex/main.muro",
    "examples/twin/main.muro",
]

# Building every solid of the largest buildings takes minutes, so the exhaustive geometry test
# runs on these. The rest are still exported and still answer every question that does not need a
# tessellation — nothing is skipped silently.
GEOMETRY_EXAMPLES = EXAMPLES[:4]


def read_koyu(entry: str) -> dict:
    out = subprocess.run(
        ["node", str(ROOT / "export/ifc/bin/koyu-form.mjs"), str(ROOT / entry)],
        capture_output=True,
        check=True,
    )
    return json.loads(out.stdout)


@pytest.fixture(scope="session")
def built(tmp_path_factory):
    """entry -> (koyu data, the IFC file), built once for the whole session."""
    cache = {}

    def build(entry: str):
        if entry not in cache:
            data = read_koyu(entry)
            path = tmp_path_factory.mktemp("ifc") / "model.ifc"
            export(data).write(str(path))
            cache[entry] = (data, ifcopenshell.open(str(path)), path)
        return cache[entry]

    return build


@pytest.fixture(params=EXAMPLES)
def pair(request, built):
    data, f, _path = built(request.param)
    return data, f


@pytest.fixture(params=GEOMETRY_EXAMPLES)
def small_pair(request, built):
    data, f, _path = built(request.param)
    return data, f
