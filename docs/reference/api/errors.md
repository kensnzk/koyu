---
title: エラー
mode: reference
---

# エラー

```ts
import { SourceError, srcRef } from "@kensnzk/koyu";
```

## 投げるのは解析だけである

**例外を投げるのは [`parse` 系の五つ](parsing.md)と [図の生成](draw.md) だけである。**

| 面 | 失敗の伝え方 |
|---|---|
| `parse` `parseFiles` `parseWith` `parseFile` `parseFileWith` `tokenize` | `SourceError` を投げる |
| `svgPlan` `svgAxo` | 素の `Error` を投げる (位置を持たない) |
| `checkDiagnostics` `check` | **投げない。**必ず `Diagnostic[]` / `CheckResult` を返す |
| `validate` | **投げない。**必ず `Finding[]` を返す |
| `placeOpening` `placeBand` | **投げない。**`BandError` を値として返す |
| `newUids` | 引数が不正なら `RangeError` |

**「読めなかった」と「読めたが矛盾している」は別の伝え方をする。**前者は例外で止まり、後者は診断の列になる。

## SourceError

```ts
class SourceError extends Error {
  line: number;    // 出所の行
  raw: string;     // 位置情報を除いた本文
  file?: string;   // 合成時の出所レイヤー (解決済みの絶対パス)
  // name は "SourceError"
  // message は `${file ? file + ":" : ""}line ${line}: ${raw}`
}
```

構文のエラーと合成のエラーがこれで飛ぶ。**`message` は組み立て済みの完成文で、`raw` は位置接頭辞を除いた本文である。**自分の書式で出したいなら `raw` と `line` と `file` を使う。

```ts
import { SourceError, parse } from "@kensnzk/koyu";

try {
  parse("grid X 0 3600\ngrid Y 0 4000\nlevel L1 0\nspace /L1/a room X1..X9 Y1..Y2");
} catch (e) {
  if (e instanceof SourceError) {
    console.log({ name: e.name, line: e.line, raw: e.raw, file: e.file, message: e.message });
  }
}
```

```text
{
  name: 'SourceError',
  line: 4,
  raw: 'Undefined grid line name: X9',
  file: undefined,
  message: 'line 4: Undefined grid line name: X9'
}
```

合成を通したときは `file` が入る。

```ts
import { parseFile } from "@kensnzk/koyu/node";

try { parseFile("examples/house/L1.muro"); } catch (e) {
  if (e instanceof SourceError) console.log(e.message.replace(process.cwd() + "/", ""));
}
```

```text
examples/house/L1.muro:line 3: Undeclared level: level:L1
```

分割されたレイヤーの一枚だけを読んだので、base 層にある `level` の宣言が無い。**渡すのは常に entry の一枚だけである。**

`file` に入るのは**解決済みの絶対パス**である (上の出力は見やすさのために cwd を削っている)。診断の `file` フィールドと同じ値である。

### 読めなかったファイル

`import` の解決に失敗したときも `SourceError` である。

| `raw` | `line` | いつ |
|---|---|---|
| `Cannot read file: <entry>` | `0` | entry そのものが読めない |
| `Cannot read file: <ref>` | `import` 行の行番号 | 途中の層が読めない |

`parseFiles` で対応表に無いキーを `import` したときも、`parseWith` のローダーが投げたときも、同じ形で伝わる。**entry の失敗だけが行番号 0 になる** — 読めなかったのはどの行でもないからである。

### 診断への写し

CLI の `koyu check --json` は、この例外を捕まえて `SYN01` のコード付きの診断として写す。**API の側では写さない** — 例外は例外として捕まえる。

```ts
import { SourceError, checkDiagnostics } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

function readAndCheck(path: string) {
  try {
    return { ok: true as const, diagnostics: checkDiagnostics(parseFile(path)) };
  } catch (e) {
    if (e instanceof SourceError) {
      return { ok: false as const, line: e.line, file: e.file, message: e.raw };
    }
    throw e;
  }
}
```

## srcRef

```ts
function srcRef(line: number, file?: string): string
```

位置を同じ書式で表す小物である。診断や自作のエラーで使う。

```ts
import { srcRef } from "@kensnzk/koyu";
console.log(srcRef(12), "|", srcRef(12, "L1.muro"));
```

```text
line 12 | L1.muro:line 12
```

`SourceError` の `message` はこの書式に本文を続けたものである。

## 図の生成の例外

`svgPlan` と `svgAxo` が投げるのは**素の `Error`** である。`SourceError` ではないので、`line` も `file` も持たない。

| メッセージ | いつ |
|---|---|
| `No level is defined` | `svgPlan` に `level` を渡さず、模型にレベルが無い |
| `There is no space with a region on level <名>` | `svgPlan` で指定したレベルに領域を持つ空間が無い |
| `There is nothing to draw` | `svgAxo` で立体が一つも生成されない |

**捕まえないと生のスタックトレースになる。**

## 関連

- [解析と合成](parsing.md) — 例外を投げる五つの入口
- [診断](diagnostics.md) — 例外にならない側の伝え方
- [図の生成](draw.md) — もう一つ例外を投げる面
