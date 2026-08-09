"""The exporter reads the version stamped on the document, and refuses a spelling it does not know.

**A version nothing reads is not a version.** koyu writes `format` on every canonical document
so that a reader can stop rather than misread; this exporter took the document apart without
looking, and the day the language version key was renamed — `koyu-canonical/1.2` to `2.0` —
nothing here noticed. A wrong IFC is worse than no IFC, because it opens.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from koyu_ifc.export import READS_CANONICAL, export  # noqa: E402


# A spelling this exporter does not read. **Asserted absent rather than assumed absent**: the
# first version of this test hard-coded a value that a later commit added to the allowlist, so
# the guard stopped firing and the test stopped testing anything while still looking deliberate.
UNKNOWN_FORMAT = "koyu-canonical/99.0"


def test_the_sample_is_actually_unknown():
    assert UNKNOWN_FORMAT not in READS_CANONICAL, (
        f"{UNKNOWN_FORMAT} has been added to READS_CANONICAL, so the refusal test below no "
        "longer exercises a refusal — pick a spelling this exporter does not read."
    )


def test_a_format_this_exporter_does_not_know_is_refused():
    with pytest.raises(ValueError) as e:
        export({"canonical": {"format": UNKNOWN_FORMAT, "unit": "mm"}})
    assert UNKNOWN_FORMAT in str(e.value)
    # The message says which side is behind. The document is not the problem.
    assert "Nothing is wrong with the document" in str(e.value)


def test_a_document_with_no_format_at_all_is_refused():
    with pytest.raises(ValueError):
        export({"canonical": {"unit": "mm"}})


def test_the_current_format_is_one_this_exporter_reads(pair):
    """Whatever koyu writes today, this exporter must be listed as reading it.

    The guard is only worth having if the list is kept in step, and this is the check that
    fails on the release that moves the format rather than on a user's machine afterwards.
    """
    model, _ = pair
    assert model["canonical"]["format"] in READS_CANONICAL
