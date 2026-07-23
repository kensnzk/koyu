// ファイルシステムからの合成 — node専用の入口 (ADR-0010)。
// パーサ本体 (parse.ts) は純粋で、fsはこの薄い層だけが知る。
// ブラウザ (ugatsu等) は parseFiles (仮想ファイル群) を使う。

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Model } from "./model.js";
import { parseWith } from "./parse.js";

/** ファイルから読む。import は書かれたファイルからの相対で解決される */
export function parseFile(filePath: string): Model {
  return parseWith((from, ref) => {
    const key = from === undefined ? resolve(ref) : resolve(dirname(from), ref);
    return { key, src: readFileSync(key, "utf8") };
  }, filePath);
}
