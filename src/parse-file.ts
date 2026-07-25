// ファイルシステムからの合成 — node専用の入口 (ADR-0010)。
// パーサ本体 (parse.ts) は純粋で、fsはこの薄い層だけが知る。
// ブラウザ (ugatsu等) は parseFiles (仮想ファイル群) を使う。

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Model } from "./model.js";
import { parseWith } from "./parse.js";

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
    const key = from === undefined ? resolve(ref) : resolve(dirname(from), ref);
    const src = overlay?.(key) ?? readFileSync(key, "utf8");
    return { key, src };
  }, filePath);
}
