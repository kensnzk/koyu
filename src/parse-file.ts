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
    // **層の同一性はファイルシステム上の同一性で決める。**綴りで決めると、同じファイルが
    // symlink や大文字小文字の違いで届いたときに同じ層が二度合成され、「二度 import しても
    // 合成は一度だけ」(規則1) が破れる — 実測では `grid X is declared once` で落ちていた。
    // 未作成のパス (overlay が内容を持つ場合) では realpath が引けないので綴りのままにする。
    // `.native` を使うのは OS に訊くためである — 大文字小文字を区別しないファイルシステム
    // (macOS の既定) では JS 実装が綴りをそのまま返すので、`B.muro` と `b.muro` が別層になる
    let key = spelled;
    try {
      key = realpathSync.native(spelled);
    } catch {
      /* まだ無いファイル — 綴りがそのまま同一性である */
    }
    // 差し替えは書かれた綴りでも実体でも引ける — MCP の門番は resolve した綴りで照合する
    const src = overlay?.(spelled) ?? overlay?.(key) ?? readFileSync(key, "utf8");
    return { key, src };
  }, filePath);
}
