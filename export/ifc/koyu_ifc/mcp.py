"""A stdio MCP server that writes IFC.

**This is the export's server, not koyu's.** koyu's own twelve tools stay where they are and stay
free of runtime dependencies; asking `koyu-mcp` to shell out to Python would make Python a
requirement of koyu in everything but the manifest. An agent that needs both connects both, which
is the ordinary shape of this: one server per thing that can answer, composed by the caller.

The protocol is hand-written JSON-RPC 2.0 over stdio, the same as `src/mcp.ts` — not because a
dependency would be forbidden here, but because the surface is small enough that a hundred lines
is less to reason about than a framework.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from .cli import read_model
from .export import export

PROTOCOL_VERSION = "2024-11-05"

TOOLS = {
    "export_ifc": {
        "description": (
            "Write a koyu building out as IFC4: spaces, walls, openings with doors and windows "
            "fitted into them, slabs, columns, vertical circulation, and the space boundaries "
            "themselves. GlobalIds are derived from koyu's identity, so the same model always "
            "gives the same identifiers and editing one room leaves the rest alone"
        ),
        "schema": {
            "type": "object",
            "properties": {
                "file": {
                    "type": "string",
                    "description": "Path to the entry .muro file (imports are composed automatically)",
                },
                "out": {
                    "type": "string",
                    "description": "Where to write the .ifc file. Defaults to the entry path with .ifc",
                },
            },
            "required": ["file"],
        },
    }
}


def export_ifc(args: dict) -> dict:
    entry = Path(str(args["file"]))
    out = Path(str(args["out"])) if args.get("out") else entry.with_suffix(".ifc")
    f = export(read_model(entry))
    out.parent.mkdir(parents=True, exist_ok=True)
    f.write(str(out))
    return {
        "file": str(out),
        "schema": "IFC4",
        "counts": {
            kind[3:]: len(f.by_type(kind))
            for kind in (
                "IfcSpace",
                "IfcWall",
                "IfcDoor",
                "IfcWindow",
                "IfcSlab",
                "IfcColumn",
                "IfcStair",
                "IfcRamp",
                "IfcTransportElement",
                "IfcRelSpaceBoundary",
            )
            if len(f.by_type(kind))
        },
        "georeferenced": bool(f.by_type("IfcMapConversion")),
        "hint": (
            "Identifiers are a function of the koyu model, so re-exporting after an edit keeps "
            "every untouched object's GlobalId. A space carrying uid: keeps its identifier across "
            "a rename; one without it does not."
        ),
    }


def handle(message: dict):
    method = message.get("method")
    if method == "initialize":
        return {
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "koyu-ifc", "version": "0.1.0"},
        }
    if method == "tools/list":
        return {
            "tools": [
                {"name": name, "description": t["description"], "inputSchema": t["schema"]}
                for name, t in TOOLS.items()
            ]
        }
    if method == "tools/call":
        params = message.get("params") or {}
        name = params.get("name")
        if name not in TOOLS:
            raise ValueError(f"Unknown tool: {name}")
        result = export_ifc(params.get("arguments") or {})
        return {"content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False, indent=1)}]}
    raise ValueError(f"Unknown method: {method}")


def main() -> int:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            message = json.loads(line)
        except json.JSONDecodeError:
            continue
        if "id" not in message:
            continue  # a notification expects no answer
        try:
            response = {"jsonrpc": "2.0", "id": message["id"], "result": handle(message)}
        except Exception as error:  # noqa: BLE001 - the message is what the caller needs
            response = {
                "jsonrpc": "2.0",
                "id": message["id"],
                "error": {"code": -32000, "message": str(error)},
            }
        sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
        sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
