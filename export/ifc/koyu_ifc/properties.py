"""Carry koyu's non-geometric facts into IFC — properties, quantities, classification, material.

Two kinds of property set are written, and the difference matters.

**The standard ones** (`Pset_SpaceCommon`, `Pset_WallCommon`, `Pset_DoorCommon`) are what another
tool will look for. Only facts koyu actually holds go in them; nothing is invented to fill a slot.

**The `koyu` one** carries the path and the uid, so a file leads back to the source it came from
even if the identifiers are lost, and it carries the attributes koyu interprets under their own
names. A reader who knows koyu gets the model back; a reader who does not is unaffected.

Quantities are written because koyu derives them rather than storing them. An area that appears
in an IFC file usually came from the same place the geometry did; here it came from the
composition, and putting it beside the geometry is what makes the two checkable against each
other.
"""

from __future__ import annotations

from .identity import global_id

# Attributes koyu interprets, and how they read as IFC values. Anything else a space or boundary
# carries goes across as text under its own name — the carried tier travels without being read.
BOOLEAN_ATTRS = {"daylight", "outside", "void", "site", "air"}


def _value(f, v):
    if isinstance(v, bool):
        return f.create_entity("IfcBoolean", wrappedValue=v)
    if isinstance(v, (int, float)):
        return f.create_entity("IfcReal", wrappedValue=float(v))
    return f.create_entity("IfcText", wrappedValue=str(v))


def single(f, name: str, v):
    return f.create_entity("IfcPropertySingleValue", Name=name, NominalValue=_value(f, v))


def _label(f, name: str, v: str):
    return f.create_entity(
        "IfcPropertySingleValue", Name=name, NominalValue=f.create_entity("IfcLabel", wrappedValue=v)
    )


def _bool(f, name: str, v: bool):
    return f.create_entity(
        "IfcPropertySingleValue",
        Name=name,
        NominalValue=f.create_entity("IfcBoolean", wrappedValue=bool(v)),
    )


def attach_pset(f, product, tag: str, name: str, properties: list):
    """Attach one property set. Silent where there is nothing to say."""
    if not properties:
        return
    pset = f.create_entity(
        "IfcPropertySet", GlobalId=global_id("pset", tag), Name=name, HasProperties=properties
    )
    f.create_entity(
        "IfcRelDefinesByProperties",
        GlobalId=global_id("defines", tag),
        RelatedObjects=[product],
        RelatingPropertyDefinition=pset,
    )


def attach_quantities(f, product, tag: str, name: str, quantities: list):
    if not quantities:
        return
    q = f.create_entity(
        "IfcElementQuantity", GlobalId=global_id("qto", tag), Name=name, Quantities=quantities
    )
    f.create_entity(
        "IfcRelDefinesByProperties",
        GlobalId=global_id("qto-defines", tag),
        RelatedObjects=[product],
        RelatingPropertyDefinition=q,
    )


def area(f, name: str, value: float):
    return f.create_entity("IfcQuantityArea", Name=name, AreaValue=float(value))


def volume(f, name: str, value: float):
    return f.create_entity("IfcQuantityVolume", Name=name, VolumeValue=float(value))


def length(f, name: str, value: float):
    return f.create_entity("IfcQuantityLength", Name=name, LengthValue=float(value))


def count(f, name: str, value: int):
    return f.create_entity("IfcQuantityCount", Name=name, CountValue=int(value))


# ---- per element ----


def space(f, product, form_space: dict, attrs: dict):
    """A space: what it is, where it came from, and how big koyu says it is."""
    attach_pset(
        f,
        product,
        f"space-common:{form_space['path']}",
        "Pset_SpaceCommon",
        [
            _bool(f, "IsExternal", not form_space.get("indoor")),
            *([_label(f, "Category", attrs["use"])] if isinstance(attrs.get("use"), str) else []),
        ],
    )
    koyu = [single(f, "koyu.path", form_space["path"])]
    if isinstance(attrs.get("uid"), str):
        koyu.append(single(f, "koyu.uid", attrs["uid"]))
    for key in ("indoor", "semiOutdoor", "outside", "void", "covered"):
        koyu.append(_bool(f, f"koyu.{key}", bool(form_space.get(key))))
    for key, v in sorted(attrs.items()):
        if key in ("name", "uid"):
            continue
        koyu.append(single(f, f"koyu.{key}", bool(v) if key in BOOLEAN_ATTRS else v))
    attach_pset(f, product, f"space-koyu:{form_space['path']}", "koyu", koyu)

    quantities = []
    if form_space.get("areaM2") is not None:
        quantities.append(area(f, "GrossFloorArea", form_space["areaM2"]))
    if form_space.get("z0") is not None and form_space.get("z1") is not None:
        h = form_space["z1"] - form_space["z0"]
        quantities.append(length(f, "Height", h))
        if form_space.get("areaM2") is not None:
            quantities.append(volume(f, "GrossVolume", form_space["areaM2"] * h / 1000.0))
    attach_quantities(f, product, f"space:{form_space['path']}", "Qto_SpaceBaseQuantities", quantities)


def wall(f, product, wall_data: dict, attrs: dict, external: bool):
    material = wall_data["material"]
    seg = wall_data["segment"]
    run = ((seg["x2"] - seg["x1"]) ** 2 + (seg["y2"] - seg["y1"]) ** 2) ** 0.5
    height = material["z1"] - material["z0"]
    common = [_bool(f, "IsExternal", external)]
    if isinstance(attrs.get("fire"), str):
        common.append(_label(f, "FireRating", attrs["fire"]))
    attach_pset(f, product, f"wall-common:{wall_data['identity']}", "Pset_WallCommon", common)

    koyu = [single(f, "koyu.ref", wall_data["ref"]), _bool(f, "koyu.derived", wall_data["derived"])]
    for key, v in sorted(attrs.items()):
        koyu.append(single(f, f"koyu.{key}", bool(v) if key in BOOLEAN_ATTRS else v))
    attach_pset(f, product, f"wall-koyu:{wall_data['identity']}", "koyu", koyu)

    attach_quantities(
        f,
        product,
        f"wall:{wall_data['identity']}",
        "Qto_WallBaseQuantities",
        [
            length(f, "Length", run),
            length(f, "Width", material["t"]),
            length(f, "Height", height),
            volume(f, "GrossVolume", run * material["t"] * height / 1e9),
        ],
    )


def opening(f, product, op: dict, attrs: dict):
    common = []
    if isinstance(attrs.get("fire"), str):
        common.append(_label(f, "FireRating", attrs["fire"]))
    if op.get("style"):
        common.append(_label(f, "OperationType", str(op["style"])))
    kind = "Pset_DoorCommon" if op["kind"] == "door" else "Pset_WindowCommon"
    attach_pset(f, product, f"opening-common:{op['ref']}", kind, common)

    koyu = [single(f, "koyu.ref", op["ref"]), _bool(f, "koyu.sliding", bool(op.get("sliding")))]
    for key, v in sorted(attrs.items()):
        koyu.append(single(f, f"koyu.{key}", v))
    attach_pset(f, product, f"opening-koyu:{op['ref']}", "koyu", koyu)


def run(f, product, r: dict):
    """A stair or a ramp. koyu derives the step division rather than storing it."""
    tag = f"{r['path']}@{r['level']}"
    if r["device"] == "stair":
        attach_pset(
            f,
            product,
            f"run-common:{tag}",
            "Pset_StairCommon",
            [
                single(f, "NumberOfRiser", r["risers"]),
                single(f, "NumberOfTreads", max(0, r["risers"] - 1)),
                single(f, "RiserHeight", r["riser"]),
                single(f, "TreadLength", r["tread"]),
            ],
        )
    elif r["device"] == "ramp":
        attach_pset(
            f, product, f"run-common:{tag}", "Pset_RampCommon", [single(f, "RequiredSlope", r["slope"])]
        )
    attach_pset(
        f,
        product,
        f"run-koyu:{tag}",
        "koyu",
        [
            single(f, "koyu.path", r["path"]),
            single(f, "koyu.device", r["device"]),
            single(f, "koyu.form", r["form"]),
            single(f, "koyu.rise", r["rise"]),
            single(f, "koyu.slope", r["slope"]),
            single(f, "koyu.going", r["going"]),
            single(f, "koyu.lanes", r["lanes"]),
        ],
    )


# ---- classification and material ----


class Vocabulary:
    """One `IfcClassification` per koyu attribute that names a vocabulary, made on demand.

    `use:` and `spec:` are open vocabularies: koyu holds a ledger of which keys may be written,
    not of which values are allowed. So the classification is created from what the model actually
    says, and no list of permitted terms is invented here.
    """

    def __init__(self, f):
        self.f = f
        self._classifications = {}
        self._references = {}
        self._materials = {}

    def classify(self, product, key: str, value: str):
        ref = self._reference(key, value)
        self.f.create_entity(
            "IfcRelAssociatesClassification",
            GlobalId=global_id("classifies", f"{key}:{value}:{product.GlobalId}"),
            RelatedObjects=[product],
            RelatingClassification=ref,
        )

    def _reference(self, key: str, value: str):
        if (key, value) in self._references:
            return self._references[(key, value)]
        if key not in self._classifications:
            self._classifications[key] = self.f.create_entity(
                "IfcClassification", Source="koyu", Edition="muro 1.1", Name=f"koyu {key}"
            )
        ref = self.f.create_entity(
            "IfcClassificationReference",
            Identification=value,
            Name=value,
            ReferencedSource=self._classifications[key],
        )
        self._references[(key, value)] = ref
        return ref

    def associate_material(self, product, spec: str):
        if spec not in self._materials:
            self._materials[spec] = self.f.create_entity("IfcMaterial", Name=spec)
        self.f.create_entity(
            "IfcRelAssociatesMaterial",
            GlobalId=global_id("material", f"{spec}:{product.GlobalId}"),
            RelatedObjects=[product],
            RelatingMaterial=self._materials[spec],
        )
