# conformance — muro の適合試験

**これは muro の定義の実体である。**ここにあるのは入力と期待だけで、**どの処理系の関数も参照しない。**別の言語で書き直した実装がこの全件に合格すれば、それは「正しい muro 実装」を名乗れる。

`koyu` はここでは**被験実装**の一つにすぎない。`koyu` を呼ぶのは薄いランナー一枚 ([test/conformance.test.ts](../test/conformance.test.ts)) だけで、ケース自身は `koyu` を知らない。

## 何を試験するか

三本である。いずれも[凍る面](../docs/reference/stability.md)に属する。

| 期待 | ファイル | 比べ方 | なぜその比べ方か |
|---|---|---|---|
| **正準 JSON** | `expected/canonical.json` | **バイト一致** | [機械形式](../docs/reference/json/index.md)は「同じ構成からは同じバイト列が出る」ことを約束し、照合順・正規化・数の綴りまで定めている。バイトで比べなければその約束を試験していない |
| **診断** | `expected/diagnostics.json` | 構造の一致 (並びを含む) | [診断契約](../docs/reference/diagnostics/index.md)が縛るのは `code` と `severity` と出所であり、本文の字面は凍らない。並びは走査の順で、これも契約である |
| **形** | `expected/form.json` | 構造の一致 | [導出規則](../docs/reference/form/index.md)が凍るのは `Form` の中身であって、その JSON の綴りではない |

**`koyu validate` の判定は試験しない。**[建築的な判定](../docs/reference/validate/index.md)は「凍らない面、追加的に増える面」である。規則が一つ増えるたびに他実装が不適合になる試験は、適合の定義として成り立たない。判定の回帰は `test/` が持つ。

## ケースの形

一つのディレクトリが一つのケースである。

```text
cases/<名前>/
  main.muro              entry。**この名前は固定である**
  *.muro                 import される層 (あれば)
  about.json             このケースが縛る規範文
  expected/canonical.json    (任意)
  expected/diagnostics.json  (任意)
  expected/form.json         (任意)
  expected/parse-error.txt   (任意 — parse が止まるケース)
```

**期待ファイルが在るものだけが試験される。**三本すべてを置く必要はない。`parse-error.txt` があるケースは、parse が止まることと、その本文がこのファイルの内容を含むことを試験する (本文は凍らないので、部分一致である)。

`about.json` は台帳である。

```json
{
  "pins": ["docs/reference/json/index.md#照合順"],
  "why": "整数に見えるキーが照合順に並ぶこと。JavaScript のオブジェクトは整数風キーを数値昇順で先に並べるので、正しく並べ替えた後で崩れうる"
}
```

`pins` は**規範のどの節を縛るか**を、公開ドキュメントの頁とアンカーで指す。ランナーがこれを集めて、**規範の節ごとに最低一ケースあるか**を数える。縛るケースを書けない規範文が見つかったら、それは規範の曖昧さであって、書き足すべき合図である。

## 走らせる

```bash
npx tsx --test test/conformance.test.ts
```

別の実装で受験するなら、上の表の三本を読んで自分のランナーを書く。ケースのディレクトリ構造と比べ方がこの頁の契約であり、`koyu` の実装詳細は一切要らない。

## ケースを足す

1. `cases/<名前>/main.muro` に最小の入力を書く。**最小であること**が要点で、余分な宣言は何を試験しているのかを曇らせる
2. `about.json` に、縛る規範文と理由を書く
3. 期待値は**実装を走らせて得た出力から始めてよい。**ただし一件ずつ「規範がそう言っているか」を確かめる — 規範に書かれていない挙動を見つけたら、規範に書くか挙動を変えるかを ADR で決める。**写しただけの期待値は、誤挙動を正典に変える**
