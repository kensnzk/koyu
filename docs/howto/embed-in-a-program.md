---
title: プログラムに組み込む
mode: howto
---

# プログラムに組み込む

`.muro` を自分のプログラムから読み、検査し、問う手順である。面積表を吐く社内ツール、コミット時に回る門番、ブラウザで動く編集器 — どれも同じ四段でできている。

**CLI が答えるものはすべて API が答える。**`koyu` コマンド・`koyu-mcp`・この API は同じ導出の三つの入口であり、どれかにしか無い答えというものは無い。だから CLI を子プロセスで呼んで出力を正規表現で剥がす必要は無い。

面の一覧 — どの名が出ていてどの型を持つか — は[TypeScript API](../reference/api/index.md)にある。この頁は組み込みの**順序と判断**である。

以下の出力は実際に走らせて得たものである。

## 1. 入れる

```sh
npm install @kensnzk/koyu
```

**実行時依存はゼロである。**パッケージが引くのは Node の標準モジュールだけで、それも `@kensnzk/koyu/node` の中に閉じている。動作環境は Node 22 以上。

## 2. モデルがどこから来るかを決める

ここが最初の設計判断で、後から変えると入口が全部動く。

| 建物の在り処 | 使う関数 | 入口 |
|---|---|---|
| ファイルシステム | `parseFile` | `@kensnzk/koyu/node` |
| メモリ上のバッファ (エディタ・ブラウザ) | `parseFiles` | `@kensnzk/koyu` |
| HTTP・DB・その他 | `parseWith` | `@kensnzk/koyu` |
| 一枚のテキスト (`import` 無し) | `parse` | `@kensnzk/koyu` |

**ルートの入口は `node:fs` を引かない。**ブラウザ・Web Worker・エッジランタイムでそのまま動く。ファイルシステムを触るものだけが `/node` に分けてある。

どれを選んでも**出てくる `Model` は同じ形である。**合成 (`import` の解決) は「レイヤーをどう読むか」という関数を外から受け取る形になっていて、fs はその実装の一つでしかない。

## 3. 一巡させる

読み込み、検査し、判定を出し、面積を合計する。これで一巡している。

```ts
import { areaM2, checkDiagnostics, isIndoor } from "@kensnzk/koyu";
import { validate } from "@kensnzk/koyu/validate";
import { parseFile } from "@kensnzk/koyu/node";

const model = parseFile("examples/house/main.muro");

const errors = checkDiagnostics(model).filter((d) => d.severity === "error");
console.log(`${model.name} — ${model.spaces.size} spaces, ${errors.length} errors`);

for (const f of validate(model)) console.log(`${f.level} [${f.rule}] ${f.message}`);

let total = 0;
for (const s of model.spaces.values()) if (isIndoor(model, s)) total += areaM2(s) ?? 0;
console.log(`total floor: ${total.toFixed(2)} m2`);

process.exit(errors.length > 0 ? 1 : 0);
```

```text
小さな戸建住宅 — 13 spaces, 0 errors
total floor: 92.75 m2
```

`model.spaces` は `Map<string, Space>`、`model.boundaries` は `Boundary[]` である。**パスが空間の同一性**であり、境界はどちらの空間にも属さない第一級の関係として配列に並ぶ。

面積を自分で足し直しているのは、**合計の定義がプログラムごとに違うから**である。半屋外を入れるか、吹抜けをどう扱うか、`use` ごとに割るか — そこは呼ぶ側の判断で、`areaM2` はその材料を返すところまでを受け持つ。

## 4. 二つの答えを混ぜない

**組み込みで最も起きやすい事故がこれである。**

```ts
const errors = checkDiagnostics(model).filter((d) => d.severity === "error");
for (const f of validate(model)) console.log(`${f.level} [${f.rule}] ${f.message}`);
```

- `checkDiagnostics` が返すのは `Diagnostic { code, severity }` — **書かれたものがデータとして矛盾していないか**だけを言う。
- `validate` が返すのは `Finding { rule, level }` — **建築として妥当か**を言う。

**フィールド名からして別の型である。**連結しようとすれば型が落ちる。`check` が緑でも建物が使えるとは限らない — 扉を一枚も宣言しない建物は、緑のまま完全に密封される。緑を根拠に「動く」と主張しない。それぞれが何を約束するかは[約束の範囲](../reference/scope.md)にある。

**終了コードもこれに従って分ける。**構成が壊れているのと、建築的な指摘が出ているのは、呼ぶ側にとって別の事件である。

## 5. 読み込みの失敗を捕まえる

構文エラーと合成エラーは診断ではなく**例外**として飛ぶ。モデルが組み上がる前に止まるからである。

```ts
import { SourceError } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

function load(path: string) {
  try {
    return parseFile(path);
  } catch (e) {
    if (e instanceof SourceError) {
      console.error(`${e.file ?? path}:${e.line}: ${e.raw}`);
      process.exit(2);
    }
    throw e;
  }
}

const model = load("broken.muro");
console.log(model.spaces.size);
```

```text
<absolute path>/broken.muro:2: Undefined grid line name: X1
```

`SourceError` は `line` と `raw` (位置接頭辞を除いた本文) と `file` (合成しているとき) を持つ。`message` は三つを繋いだ文字列なので、自前の書式で出したいときは `raw` を使う。

**ここを握り潰さない。**捕まえないまま上げると、利用者に生のスタックトレースが出る。

## ブラウザで動かす

ファイルシステムが無いところでは、内容の対応表をそのまま渡す。

```ts
import { parseFiles, checkDiagnostics } from "@kensnzk/koyu";
import { svgPlan } from "@kensnzk/koyu/draw";

const model = parseFiles({
  "main.muro": "koyu 1.0\nunit mm\ngrid X 0 3600 7200\ngrid Y 0 4500\nlevel L1 0 h:2400 slab:150\nimport ./L1.muro",
  "L1.muro": "space /L1/a room X1..X2 Y1..Y2\nspace /L1/b room X2..X3 Y1..Y2",
}, "main.muro");

console.log(model.layers, model.spaces.size, checkDiagnostics(model).length);
console.log(svgPlan(model, { level: "L1" }).slice(0, 60));
```

```text
[ 'main.muro', 'L1.muro' ] 2 0
<svg xmlns="http://www.w3.org/2000/svg" width="528" height="
```

`import` はこのキー空間の中で解決される。エディタのバッファをそのまま渡せるので、**一文字打つたびに再合成して検査する**という作りがそのまま書ける。合成は毎回ゼロからやり直すが、同梱の最大の例 (11 層・1,808 空間・延床 141,448.56 ㎡) でも 0.1 秒台なので、キャッシュから始める必要は無い。

読み方そのものを差し替えたいときは `parseWith` にローダーを渡す。HTTP から引く、DB から引く、といった入口はここに載る。

## 形は導出する — 自分で計算し直さない

壁の四辺形、柱の矩形、階段の角柱、開口の位置。**これらを自分で計算するプログラムは書かない。**同じ規則の実装が二つできた瞬間に、二つは必ずずれる。

形の入口は一つで、`derive` がそれである。SVG を吐くだけなら `svgPlan` / `svgAxo` がその上に載っている。何がどの形で返るかは[形](../reference/form/index.md)にある。

同じことが導出全般に言える — 到達可能性は `doorsBetween`、隣接は `neighbors`、床と屋根は `slabs`、採光の入力は `daylightInputs`、敷地は `siteReport`。**答えの定義を二箇所に持たない。**

## 版を固定する

読む相手の言語版は `model.version` にある。受理される版は `SUPPORTED_LANGUAGE_VERSIONS` が持ち、版宣言を省いたファイルは `DEFAULT_LANGUAGE_VERSION` の意味論で読まれる。

```ts
import { DEFAULT_LANGUAGE_VERSION, SUPPORTED_LANGUAGE_VERSIONS } from "@kensnzk/koyu";
console.log(DEFAULT_LANGUAGE_VERSION, SUPPORTED_LANGUAGE_VERSIONS);
```

```text
1.0 [ '0.1', '0.2', '0.3', '0.4', '0.5', '1.0' ]
```

**言語の版と実装の版は別々に動く。**`package.json` の版は実装のもので、`.muro` が名乗るのは言語のものである。何を壊さないと約束しているかは[凍る面](../reference/stability.md)にある。

## 外に出すなら正準 JSON で

自分のプログラムの内側では `Model` をそのまま持てばよいが、**外へ渡すもの・保存するもの・比べるものは `toCanonical` を通す。**バイト安定な単一の文字列になるので、ハッシュも差分も比較も成り立つ。

正準 JSON には**書かれた構成だけ**が入る。導出された既定の壁は入らないので、読み戻して意味を取る側は `deriveDefaultBoundaries` を適用してから読む。形式の全部は[正準 JSON](../reference/json/index.md)にある。

## 関連

- [TypeScript API](../reference/api/index.md) — 入口と、面に載っている名の全部
- [約束の範囲](../reference/scope.md) — `check` が緑であることの意味
- [判定 — koyu validate](../reference/validate/index.md) — 15 の規則
- [形](../reference/form/index.md) — 導出された形の入口
- [正準 JSON](../reference/json/index.md) — 外部との接続の地面
- [CI で門番にする](../reference/cli/ci.md) — コマンドで済ませるときの終了コードの設計
