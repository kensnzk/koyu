---
title: ファイル分割と重ね合わせ
mode: explanation
---

# ファイル分割と重ね合わせ

複数のファイルを重ねて一つの模型にする仕組みを、koyu は持っている。**しかしそれは「一棟が大きいから分ける」ための道具ではない。**

延床 31,606 ㎡ の複合建築が原本 646 行である。分割しなくても一つのファイルに収まる。**それでも合成がある理由は三つで、どれも大きさとは関係がない。**

1. **分担して書く** — 意匠・構造・設備、あるいは階ごとに、別々の人と別々のエージェントが書く
2. **例外を差分として書く** — 基準階の上に、その階だけの違いを重ねる
3. **時間を重ねる** — 計画の上に as-built を、設計値の上に実測値を重ねる

書き方は [合成](../reference/muro/composition.md) と [over / drop](../reference/muro/over-drop.md) にある。この頁が言うのは、なぜこの形なのかである。

## 六つの規則が揃ってはじめて使える

合成の問題は、合成があること自体ではない。**解決の順序が暗黙であることである。**暗黙の解決は、同じ入力から違う結果を生みうる。それは原本ではない。

だから六つを定めてある。

**1. 層は明示された強度順序を持つ。**`import` 行の並びが強度の宣言であり、後の層ほど強い。**強度は走査の順ではない** — entry の行が `import` より後ろにあっても、entry は最も弱いままである。順序を走査で決めていたら、`import` 行を上下に動かしただけで結果が変わってしまう。

**2. 単一の値は、最も強い層の意見が勝つ。**厚みも仕様も用途も階高も、上書きは一つの規則で説明される。

**3. 集合は、明示された編集で合成する。**暗黙のマージをしない。同じ座に複数の意見がありうるもの — 開口・柱・分節 — はすべてここに属す。

**4. 定義と上書きを区別する。**新たに定義する層と、既にあるものへ意見だけを足す層は、別の書き方を持つ。

**5. 同じ入力からは常に同じ結果が出る。**入力には層とその順序の宣言を含む。

**6. 出所が追える。**最終的な値を、どの層のどの行が与えたかを示せる。

## 実際にやってみる

三枚重ねる。`main.muro` が与件を、`plan.muro` が計画を、`as-built.muro` が実測を持つ。

```muro-part
koyu 1.0
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
import ./plan.muro
import ./as-built.muro
```

```muro-part
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out name:外部 outside:1
boundary /L1/a /L1/b t:120 spec:PW1
  door w:780 h:2000 name:D1
boundary /L1/a /out t:150 spec:EW1
boundary /L1/b /out t:150 spec:EW1
```

```muro-part
over /L1/a /L1/b t:125 spec:PW1-実測
over /L1/a h:2380
over /L1/a /out
  + window w:1200 h:1100 edge:S name:W9
```

```text
✔ Consistent — 3 spaces / 3 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

**設計値と実測値の差分そのものが品質記録である。**そしてどの値がどこから来たかは、常に問える。

```sh
npx tsx src/cli.ts layers main.muro --attrs
```

```text
Layers (weakest first — later layers are stronger):
  0	main.muro
  1	plan.muro
  2	as-built.muro

Attribute provenance:
  boundary:/L1/a|/L1/b:spec	← 2 as-built.muro
  boundary:/L1/a|/L1/b:t	← 2 as-built.muro
  space:/L1/a:h	← 2 as-built.muro
```

## 集合に専用構文を作らない

規則 3 が、これまで特殊扱いされてきたものを普通にする。

同じ壁に窓を足したいとき、同じ柱の宣言を一本消したいとき、住戸の分節を差し替えたいとき — **どれも「集合の編集」という一つの規則で書ける。**

```muro-part
over /L5/A/hall /L5/corridor
  - door D2                              # 削除
  = door D1 w:1000                       # 置換 (書いた属性だけを差し替える)
  + window w:600 h:1200 at:0.9 name:W1   # 追加
drop /L5/A/store                         # 空間 (その関係も一緒に消える)
drop /L5/a /L5/b                         # 境界
drop column C1                           # 柱の宣言
```

**特殊なのは値の種類であって、規則ではない。**

編集には同一性が要る。同一性は「含む対象 + その中で一意な名」なので、**`name:` を持たない要素は編集の対象にできない** — 指す言葉が無いからである。そして名が二つを指す状態は同一性の破れなので、`drop column C1` のような編集は**名が一意でなければ拒む。**

## 定義と上書きは別の文である

| | 文 | 対象が既にあるとき | 対象が無いとき |
|---|---|---|---|
| **定義** | `space` `boundary` `zone` `asset` `level` `polygon` | **エラー** (重複) | 定義する |
| **上書き** | `over` | 上書きする | **エラー** |

```text
✖ bad.muro:line 6: No such target for over: /L1/z (place it after the layer that defines it)
```

```text
✖ bad2.muro:line 6: Duplicate space path: /L1/a (first seen in bad2.muro at line 5)
```

**存在しないものに意見だけを足すのは、たいてい綴り違いか、層の順序の思い違いである。**黙って新しい空間を作ってしまえば、その思い違いは緑のまま埋もれる。

## 上書きの跡は機械形式に残らない

`over` で `h:2380` にした模型と、最初から `h:2380` と書いた模型は、**同じ正準 JSON を与える。**

正準形が答えるのは「同じ建物か」であって「どう書かれたか」ではない。書き方の履歴を持ちたければ、それは git が持つ ([正準 JSON](../reference/json/index.md))。

## 合成しないもの

- **バリアント (案の分岐)** — 分岐は git のブランチが持つ。設計案の比較はブランチの比較である
- **アセットの入れ子参照** — アセットはアセットを参照しない
- **層ごとの名前空間接頭辞** — パスの階層がすでに名前空間である ([パスと面積集計](paths.md))
- **層の部分的な読み込み** — 層は丸ごと合成される

どれも「合成が解けなくなる」方向の機能である。**六つの規則を守れる範囲だけを持つ**というのが、この一覧の意味である。

## 大きさのためではない、の実際

とはいえ、分けると副次的な効果はある。同梱の複合建築は 646 行が 10 ファイルに分かれていて、事務所階を持つ層は 41 行 — **全体の 6% ほど**である。エージェントに事務所階を書き換えさせるとき、渡すべき文脈はその一枚で足りる。

**これは合成の目的ではなく、時間と分担のために分けた結果として付いてきたものである。**目的と結果を取り違えると、「大きくなったら分ければよい」という運用になり、層の強度順序が設計されなくなる。

## この先

- [合成](../reference/muro/composition.md) — `import` の書き方
- [over / drop](../reference/muro/over-drop.md) — 上書きと集合の編集
- [koyu layers](../reference/cli/layers.md)
- [パスと面積集計](paths.md)
