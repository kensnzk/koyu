"""GlobalIds are a function of the model, not of the run.

An IFC file whose identifiers move on every export cannot be annotated, issue-tracked or compared.
Most authoring tools promise stability and hold it only through a state file they keep on the side.
koyu holds it with no state at all: a GlobalId is derived from koyu's own identity, so the promise
is a property of the model rather than of the machine that exported it.

Three things are checked, in order of how much they claim:

    the same model exported twice gives the same identifiers
    editing one room leaves every other object's identifier alone
    renaming a space keeps its identifier when it carries a uid, and loses it when it does not
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from koyu_ifc.export import export  # noqa: E402

SOURCE = """koyu 1.1
name identity
unit mm
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 uid:u-7f3k9m2qx4b8dhtv
space /L1/b room X2..X3 Y1..Y2
space /out name:outside outside:1
boundary /L1/a /L1/b t:120
  door w:800
boundary /L1/b /out edge:S t:150
  door w:900
"""


def ids_of(source: str, tmp_path: Path) -> dict:
    """Every product's GlobalId, keyed by what it is and what it is called."""
    tmp_path.mkdir(parents=True, exist_ok=True)
    entry = tmp_path / "main.muro"
    entry.write_text(source, encoding="utf-8")
    out = subprocess.run(
        ["node", str(ROOT / "export/ifc/bin/koyu-form.mjs"), str(entry)],
        capture_output=True,
        check=True,
    )
    f = export(json.loads(out.stdout))
    return {
        f"{p.is_a()} {p.Name}": p.GlobalId
        for p in f.by_type("IfcProduct")
        if p.Name is not None
    }


def test_exporting_twice_gives_the_same_identifiers(tmp_path):
    first = ids_of(SOURCE, tmp_path / "a")
    second = ids_of(SOURCE, tmp_path / "b")
    assert first == second
    assert len(first) > 10


def test_editing_one_room_leaves_the_rest_alone(tmp_path):
    """Widening room b moves nothing that belongs to room a."""
    before = ids_of(SOURCE, tmp_path / "before")
    after = ids_of(SOURCE.replace("grid X 0 3600 7200", "grid X 0 3600 8000"), tmp_path / "after")

    untouched = {k: v for k, v in before.items() if "/L1/a" in k and "|" not in k}
    assert untouched, "the fixture should carry objects belonging to room a"
    for key, value in untouched.items():
        assert after.get(key) == value, key


def test_a_uid_survives_a_rename_and_a_path_does_not(tmp_path):
    """This is koyu's uid contract, showing through on the IFC face."""
    before = ids_of(SOURCE, tmp_path / "before")
    renamed = SOURCE.replace("/L1/a", "/L1/living").replace("/L1/b", "/L1/dining")
    after = ids_of(renamed, tmp_path / "after")

    # `/L1/a` carries a uid, so the space keeps its identifier under a new path.
    assert before["IfcSpace /L1/a"] == after["IfcSpace /L1/living"]
    # `/L1/b` carries none, so the path was its identity and the correspondence is cut.
    assert before["IfcSpace /L1/b"] != after["IfcSpace /L1/dining"]


@pytest.mark.parametrize("kind", ["IfcSpace", "IfcWall", "IfcDoor", "IfcSlab"])
def test_identifiers_are_unique(tmp_path, kind):
    ids = [v for k, v in ids_of(SOURCE, tmp_path).items() if k.startswith(kind + " ")]
    assert len(ids) == len(set(ids)), kind
