// ファイルシステムからの合成 — node専用の入口 (ADR-0010)。
// パーサ本体 (parse.ts) は純粋で、fsはこの薄い層だけが知る。
// ブラウザ (ugatsu等) は parseFiles (仮想ファイル群) を使う。

import { readFileSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Model } from "./core/model.js";
import { parseWith } from "./core/parse.js";

/** ファイルから読む。import は書かれたファイルからの相対で解決される */
export function parseFile(filePath: string): Model {
  return parseFileWith(filePath);
}

/**
 * 差し替えつきのファイル合成 — 書き込み前の門番 (MCPのwrite_layer) が使う。
 * overlay が文字列を返したパスは、ディスクの内容の代わりにそれが合成される
 */
export function parseFileWith(
  filePath: string,
  overlay?: (absPath: string) => string | undefined,
): Model {
  return parseWith((from, ref) => {
    const spelled = from === undefined ? resolve(ref) : resolve(dirname(from), ref);
    // **Layer identity is filesystem identity, not spelling.** Deciding it by spelling composes
    // one file twice when it arrives through a symlink or in different letter case, breaking the
    // promise that a layer imported twice is still composed once (rule 1) — in practice it failed
    // with `grid X is declared once`. A path that does not exist yet (the overlay holds its
    // content) has no realpath, so the spelling stands as its identity.
    // `.native` asks the OS: on a case-insensitive filesystem (the macOS default) the JS
    // implementation returns the spelling as given, so `B.muro` and `b.muro` become two layers
    let key = spelled;
    try {
      key = realpathSync.native(spelled);
    } catch {
      /* not on disk yet — the spelling is the identity */
    }
    // The overlay answers to either spelling — the MCP gatekeeper matches on the resolved one
    const src = overlay?.(spelled) ?? overlay?.(key) ?? readFileSync(key, "utf8");
    return { key, src };
  }, filePath);
}
