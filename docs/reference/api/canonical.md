---
title: 正準JSON
mode: reference
---

# 正準JSON

```ts
import { toCanonical } from "@kensnzk/koyu";

function toCanonical(model: Model): string
```

模型を機械形式へ落とす。**同じ構成なら同じバイトが出る** — これが差分とレイヤー合成の土台である。

```ts
import { toCanonical } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const a = parseFile("examples/two-rooms.muro");
console.log(toCanonical(a).split("\n").slice(0, 8).join("\n"));
console.log("bytes:", Buffer.byteLength(toCanonical(a)));
```

```text
{
  "format": "koyu-canonical/1.1",
  "koyu": "1.0",
  "name": "二室",
  "unit": "mm",
  "grid": {
    "X": [
      0,
```

```text
bytes: 2164
```

インデントは空白2、**末尾に改行が付く。**

## 何が出て、何が出ないか

**出るのは書かれた構成だけである。**

| 出るもの | 出ないもの |
|---|---|
| 通り座標・レベル・アセット・敷地形状・柱の宣言・ゾーン・空間・境界 | `import` (合成の跡は残らない) |
| 空間の割付 (`at`) — 書かれたグリッド参照の綴り | 導出された凸片 (`pieces`) |
| 宣言された境界 | 既定境界 (`derived`) |
| 描かれた線の綴り | その `effect` (切ったかどうか) |
| 属性 | `over` / `drop` の跡 |

**既定境界が出ないのは、それが書かれた構成ではないからである。**正準JSONから `Model` を組み立て直すときは [`deriveDefaultBoundaries`](derive.md#derivedefaultboundaries) を通す — そうしないと意味 (既定の壁) が読めない。

同じ理由で、`over` や `drop` が書かれたかどうかも残らない。**上書きの跡は機械形式に残らない** — 残せば「どう書いたか」が「何を書いたか」に混ざる。

## トップの並び

```text
format → koyu → name → unit → grid → levels → assets → polygons → columns → zones → spaces → boundaries
```

**文書が最初に名乗るのは自分の綴りの版である。**`format` は `"koyu-canonical/1.1"` で、これは**言語版でもツール版でもない** — 数えるのは綴りだけである。

- minor が上がるのはキーが増えたとき。増えたキーを持たない文書のバイトは変わらない。
- major が上がるのは既存のキーの名前・並び・照合順・正規化・数の綴りが変わったとき。既存の文書のバイトが変わる。

`koyu` は**書かれた版宣言の素通し**なので、版を宣言していないファイルには出ない。

```ts
import { parse, toCanonical } from "@kensnzk/koyu";

const m = parse(`grid X 0 3600
grid Y 0 4000
level L1 0 h:2400
space /L1/a room X1..X2 Y1..Y2`);
console.log(toCanonical(m));
```

```text
{
  "format": "koyu-canonical/1.1",
  "unit": "mm",
  "grid": {
    "X": [
      0,
      3600
    ],
    "Y": [
      0,
      4000
    ]
  },
  "levels": {
    "L1": {
      "z": 0,
      "h": 2400
    }
  },
  "spaces": {
    "/L1/a": {
      "type": "room",
      "at": [
        "X1",
        "Y1",
        "X2",
        "Y2"
      ]
    }
  },
  "boundaries": []
}
```

**既定を書き足していない。**書いていない版を書いたことにすれば、ツールの既定が動いた日に同じ入力のバイトが変わる。決定性は形式の側の約束なので、ツールの既定に預けない。

空の集合 (`assets` `polygons` `columns` `zones`) はキーごと落ちる。`spaces` と `boundaries` は空でも必ず出る。

## 並べ替えの規則

**並べ替えてよいのは、順序に意味の無い集合だけである。**掛ける前に問う — この配列の順序を入れ替えたら別の構成になるか。なるなら掛けてはならない。並べ替えは整形ではなく「順序に意味が無い」ことの表明である。

| 対象 | 並び |
|---|---|
| オブジェクトのキー (属性・レベル名など) | 照合順 |
| 空間・ゾーン・アセット・敷地形状 (パスで引くもの) | パスの照合順 |
| 境界 | 正準エントリを直列化した文字列の照合順 |
| 開口・`seg`・`area`・空間の複数割付 | 同上 |
| **柱の宣言** | **宣言順のまま** |
| 柱宣言の中の通り名 | 通りの並び順 |

**柱だけ並べ替えない。**同じ交点に二本は立たず先の宣言が勝つので、並べ替えると別の建物が同一のバイトになってしまう。並べ替えてよいのは宣言の**中**の、順序に意味の無い通り名の列だけである。

境界の `between` は二つのパスを照合順に並べたもので、書かれた向きは `a` キーが別に保つ — `edge` と `swing` は a 側から読まれるからである。

描かれた線の端点は**解決座標の昇順**に並ぶ。線分は向きを持たないので、書き順は綴りの揺れである。**綴り自体は通り参照のまま保たれる。**

## 照合順

**Unicode 符号位置の昇順であり、これは出力される UTF-8 バイトの昇順に等しい。**

**JavaScript の `<` と既定の `sort` は使えない。**あれは UTF-16 コード単位順で、符号位置順と一致しない。𠮟 (U+20B9F) は代用対 D842,DF9F なので `<` では 﨑 (U+FA11) より小さいが、UTF-8 では F0 A0 AE 9F と EF A8 91 で 﨑 が先である。どちらも日本語の実在の字なので、差は理論上のものではない。

**規則を「JS の既定」ではなく「この形式自身のバイト」に置いてある** — 別の言語で書かれた実装が素直に書けば同じ並びになる側を選んである。

## 不変量

```ts
toCanonical(a) === toCanonical(b)
```

が成り立つとき、[`semanticDiff(a, b)`](diff.md) は空である。逆に差分が空なら二つのバイトは一致する。**この二つの面は同じ「構成が同じ」の定義を共有している。**

同じことが形にも言える。**正準JSONがバイト同一なら、導出される形も同一である。**だから [`derive`](derive.md) の中で境界を読む順序も、切り分けの順序も、正準の並びを使う — 宣言順で読むと、同じ正準JSONから違う面積が出てしまう。

## 使いどころ

- **版管理**。`.muro` を書き換えたが構成は変わっていない、を機械で言える。
- **合成の確認**。層に割った建物が、一枚に書いたものと同じかを比べられる。
- **golden test**。図と違って、これはバイトの安定が約束されている面である。

```ts
import { toCanonical } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";
import { createHash } from "node:crypto";

const digest = (p: string) =>
  createHash("sha256").update(toCanonical(parseFile(p))).digest("hex").slice(0, 12);
```

## 関連

- [意味差分](diff.md) — 同じ「同じ」の定義を、人の読む言葉で
- [形の導出](derive.md) — この並びを読んでいる導出
- [`koyu json`](../cli/json.md) — 同じ出力をコマンドラインから
