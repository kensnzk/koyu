---
title: Writing — write_layer / new_uids
mode: reference
---

# Writing — write_layer / new_uids

`write_layer` is **the only tool in the server that touches the disk.** `new_uids` writes nothing, but you call it in order to write.

**Commit before you let an agent write.** `write_layer` replaces files wholesale and has no undo. The server keeps not one previous version.

Every piece of output on this page was obtained by actually running it. Absolute paths are shortened to `<abs>`.

---

## write_layer

> Checks a layer (.muro file) before replacing it. Content that would make the composition unparsable is never written (the original stays intact). Check errors are returned but the write still happens, so that an edit spanning several layers can be made in steps — fix it and write again. History is left to git

### Arguments

| Argument | Required | Contents |
|---|---|---|
| `file` | yes | The entry `.muro` path. **Not the write target** — it is where composition starts, and the yardstick for what may be written |
| `layer` | yes | The `.muro` path to write. **Relative to the entry's directory**, or absolute |
| `content` | yes | The whole text of that file. **Not a diff** |

`layer` may be the entry itself; that is the proper way to edit the base layer.

Candidate targets are already in front of you: the `layer` field of [`spaces`](tools-read.md#spaces) and the `file` field of [`layers`](tools-read.md#layers). **Passing a path printed there is the reliable move.**

### What happens, in order

1. Resolve `layer` against the directory `file` lives in.
2. **Refuse anything that does not end in `.muro`.**
3. **Refuse a target that resolves outside the entry's directory** (the relative-path escape check).
4. **Compose the whole building as if `content` were already in place.** If that will not parse, return **without touching the original**.
5. If it composes, run `check` on it.
6. Create the target's directory if it does not exist.
7. **Resolve symlinks to their real paths and check containment again.**
8. Write a temporary file in the same directory, then `rename` it over the target.
9. Return `written` plus the `check` result from immediately after.

**The gatekeeper stands before the write.** A broken composition never lands on the filesystem.

### The result

A successful write.

```text
{
 "written": "<abs>/w/L2.muro",
 "ok": true,
 "spaces": 13,
 "errors": [],
 "warnings": []
}
```

| Field | Contents |
|---|---|
| `written` | The absolute path written, or `false` when nothing was written |
| `ok` | Whether the composition after the write is free of `check` errors |
| `spaces` | How many spaces the composition has after the write |
| `errors` `warnings` | Arrays of strings tagged `layer:line` |
| `parseError` | Only when it would not parse. The original is unchanged |
| `target` | Only when it would not parse. The path it was going to write |

**No `diagnostics` array comes back.** If you need diagnostic codes, call [`check`](tools-verify.md#check) separately after the write.

---

### The safety contract

#### There is no undo

The server stores no versions. **Rollback, branching and review are all git's job.** Commit before starting work that lets an agent write.

#### It is a whole-file replacement

`content` becomes the entire file. There is no partial replacement and no append. **Read the original with [`layers`](tools-read.md#layers), assemble the full text, then send it.**

#### Content that will not parse is never written

The replacement is composed virtually first, and if it will not parse **the original is not touched at all.**

```text
{
 "written": false,
 "target": "<abs>/w/L2.muro",
 "ok": false,
 "parseError": "<abs>/w/L2.muro:line 1: Undefined grid line name: X9"
}
```

`written` is `false`. The file is exactly as it was, so read `parseError`, rebuild the text and call again.

#### Content with check errors IS written — deliberately

Content that parses but makes `check` report errors **does get written.** This is the promise that lets an edit spanning several layers be made in steps: add a space in one layer and reference it from another, and the middle of that edit is necessarily red.

```text
{
 "written": "<abs>/w/L2.muro",
 "ok": false,
 "spaces": 13,
 "errors": [
  "<abs>/w/L2.muro:line 5: References an undefined space: /home/bath2"
 ],
 "warnings": []
}
```

`written` carries the path and `ok` is `false`. **Do not leave it red** — finish the fix on the next call.

#### The write is atomic

It writes `<target>.tmp-<pid>` in the same directory and `rename`s it over the target. **No half-written file is ever left behind.** If the process dies mid-write, the original is either untouched or completely replaced — never something in between.

#### Only `.muro` can be written

```text
Only .muro files can be written
```

It is an extension check. No `.md`, no `.json`, no `.ts`. **The server never touches a file that is not the notation.**

#### Only under the entry's directory

```text
Cannot write outside the entry's directory
```

There are two checks. **A relative-path escape** (`../secrets.muro`) is stopped right after resolution. **A symlink escape** — a symlink inside the directory pointing out of it — is stopped just before the write, by resolving to real paths and checking containment again. Both return the same message.

So the blast radius of `write_layer` is **the `.muro` files inside the entry's directory tree.** Do not keep anything you would not let an agent touch next to the entry.

#### Content of a file outside the composition is not checked

The gatekeeper composes **the replaced composition**. A file no `import` reaches is not part of it, so nobody reads its contents.

```text
{
 "written": "<abs>/w/sub/new.muro",
 "ok": true,
 "spaces": 13,
 "errors": [],
 "warnings": []
}
```

That is the result of writing a string that is not valid notation at all into `sub/new.muro`. **`ok: true` comes back**, because the composition did not change.

**When you create a new layer, put the `import` line in the same unit of work.** Until the entry says `import ./sub/new.muro` and `write_layer` runs again, that file's contents are never checked once.

The target's directory is created if missing (`sub/` was created above).

---

## new_uids

> Mints fresh identity tokens (uid) to write onto spaces or zones with write_layer. They collide with nothing already composed into this model, and 80 bits of randomness keeps them apart from layers that are not composed here. **Nothing assigns a uid on its own** — call this only when a space has to be pointed at across renames (sensors, registers, long-running operations), and run check afterwards, because UID03 is the only thing that proves uniqueness

### Arguments

| Argument | Required | Contents |
|---|---|---|
| `file` | yes | The entry `.muro` path |
| `count` | no | How many to mint. Default 1. **An integer between 1 and 1000** |

```json
{"name": "new_uids", "arguments": {"file": "<abs>/examples/two-rooms.muro", "count": 3}}
```

```text
{
 "uids": [
  "u-msnnsna335w4nr50",
  "u-qkp41hwk4x8f8xx8",
  "u-qyw2359xr1qk8wps"
 ],
 "note": "Write these as uid: on a space or zone. No other element accepts uid (the ledger rejects it). A uid is carried across renames by hand — that act is the record of the design decision that it is still the same space"
}
```

The spelling is `u-` followed by 16 characters drawn from the digits and the lowercase letters minus the easily-confused `i`, `l`, `o` and `u`. That is 80 bits of randomness.

Out of range, it writes nothing and says so.

```text
count is an integer between 1 and 1000
```

### This tool writes nothing

**All that comes back is strings.** Nothing happens to the model. To use them, write one as `uid:` on a space or zone line with [`write_layer`](#write_layer).

```muro-part
space /L1/a room X1..X2 Y1..Y2 name:居室A uid:u-msnnsna335w4nr50
```

**Only `space` and `zone` accept `uid`.** Not boundaries, not openings, not assets — the attribute ledger rejects it there.

### Call it only when identity is actually needed

**Nothing mints a uid on its own.** The path is already the identity; `uid` is a second identity laid on top of it. Call this only when something has to keep pointing at the same space across a rename — a sensor ledger, an external registry, a long-running operation.

Carrying a `uid` through a rename is a manual act. **That act is itself the record of the design decision that this is the same space.**

### Run check afterwards

What `new_uids` guarantees is only that the tokens **do not collide with the uids already composed into this model.** Non-collision with uids in layers that are not composed here is merely probabilistic, resting on 80 bits of randomness.

**The only thing that actually proves uniqueness is `UID03`.** After writing, call [`check`](tools-verify.md#check).

## See also

- [Reading — model_summary / layers / spaces / canonical_json](tools-read.md) — read the original before writing
- [Verifying — check / validate](tools-verify.md) — the gatekeeper after a write, and the judgement beyond it
- [The protocol](protocol.md) — failures that come back as `isError` versus failures inside a `result`
- [import](../muro/import.md) — putting a new layer into the composition
- [over / drop](../muro/over-drop.md) — overriding or removing an existing declaration from another layer
- [Diagnostic codes](../diagnostics/index.md) — how to read what `check` returns
