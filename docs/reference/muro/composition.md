---
title: 合成 — 層の強度と六つの規則
mode: reference
---

# 合成 — 層の強度と六つの規則

**合成は時間と分担のためにあり、大きさのためではない。**分担して書く、例外を差分として書く、計画の上に as-built を重ねる — これが合成の用途である。一棟が大きいからファイルを分けるのではない。

合成は六つの規則を守る。**この六つが揃ってはじめて合成が使える。**揃っていないことの帰結は「同じ入力から違う結果が出る」であって、それは原本ではない。

---

## 規則1 — 層は明示された強度順序を持つ

**`import` 行の並びが強度の宣言である。**入れ子になった `import` の木を深さ優先で平らにした列が層の並びであり、**後の層ほど強い**。entry は添字 0 で最も弱い。同じ層が二度 import されれば最初の位置を保つ (合成は一度だけ)。

```muro-part
koyu 1.1
grid X 0 4000 8000
level L1 0 h:2700 slab:300
import ./plan.muro        # 層1
import ./as-built.muro    # 層2 — こちらが強い
```

**強度は走査の順ではない。**entry の行が `import` より後ろに書かれていても、entry は添字 0 のままである。順序で決めていたら、`import` 行を上下に動かしただけで結果が変わってしまう。

```muro-part
# main.muro — この over は「走査としては最後」だが、最も弱い層の意見である
import ./plan.muro
over /L1/a h:9999
```

`plan.muro` が `space /L1/a room X1..X2 Y1..Y2 h:2500` と書いていれば、合成後の `h` は **2500** である。定義した層 (添字1) の方が、entry (添字0) より強い。

層の並びは `layers` が印字する。

```text
$ koyu layers <entry.muro>
Layers (weakest first — later layers are stronger):
  0	main.muro
  1	plan.muro
  2	as-built.muro
```

## 規則2 — 単一の値は、最も強い層の意見が勝つ

厚みも仕様も用途も階高も、上書きは一つの規則で説明される。

```muro-part
over /L1/a h:2400 spec:実測
over /L1/a /L1/b t:150 type:open
over level L1 h:2900
over asset SD1 w:900
```

`over` は空間・ゾーン・境界・レベル・アセットを対象にとる。**書き方から対象の種別が決まる** — パス一つなら空間 (無ければゾーン)、パス二つなら境界、`level` / `asset` に続けて名を書けばそれぞれ。綴りと制約は [over / drop](over-drop.md) にある。

強度の比較は**属性ごと**に行われる。強い層が `h` に意見を持っていても、`spec` に意見が無ければ弱い層の `spec` がそのまま通る。

**同じ層が同じ属性に二度意見を持つのはエラーである。**どちらが勝つかが決まらないからで、これは「暗黙の解決を残さない」の直接の帰結である。

```text
$ koyu check main.muro
✖ e3.muro:line 2: One layer holds two opinions about h on /L1/a (which one wins is undetermined)
```

同じ層の中で定義と `over` が同じ属性に触れた場合も同じエラーになる。上書きは**別の層から**行うものである。

## 規則3 — 集合は、明示された編集で合成する

**暗黙のマージをしない。**同じ座に複数の意見がありうるもの — 開口・`seg`・`area`・柱 — はすべてこの規則に属す。

```muro-part
over /L1/a /L1/b
  - door D2                              # 削除
  = door D1 w:1000                       # 置換 (書いた属性だけを差し替える)
  + window w:600 h:1200 at:0.9 name:W1   # 追加
drop /L1/store                           # 空間 (その関係も一緒に消える)
drop /L1/a /L1/b                         # 境界
drop column C1                           # 柱の宣言
```

**同一性は「容れ物 + その中で一意な名」である。**`name:` を持たない要素は編集の対象にできない — 指す言葉が無いからである。`+` で足す要素には `name:` が要り、同じ容れ物の中で名が重複すればエラー、`-` と `=` が指す名が一意でなければエラーである。

**規則3が、これまで特殊扱いされてきたものを普通にする。**同じ場所に複数の層が意見を持ちうるものは、暗黙の勝ち負けではなく明示された編集で解決される。**特殊なのは値の種類であって、規則ではない。**専用の構文を作らない。

## 規則4 — 定義と上書きを区別する

| | 文 | 対象が既にあるとき | 対象が無いとき |
|---|---|---|---|
| **定義** | `space` `boundary` `zone` `asset` `level` `polygon` `column` | **エラー** (重複) | 定義する |
| **上書き** | `over` | 上書きする | **エラー** |

二つは別の文であって、書き方から区別がつく。存在しないものに意見だけを足すのは、たいてい綴り違いか、層の順序の思い違いである。

```text
$ koyu check main.muro
✖ e1.muro:line 1: No such target for over: /L1/nowhere (place it after the layer that defines it)
```

```text
$ koyu check main.muro
✖ e4.muro:line 1: Duplicate space path: /L1/a (first seen in plan.muro at line 1)
```

## 規則5 — 同じ入力からは常に同じ結果が出る

入力には**層とその順序の宣言**を含む。同じ entry からは常に同じ層の列が出て、同じ層の列からは常に同じモデルが出る。

**上書きの跡は合成後のモデルにも正準JSONにも残らない。**`over` で `h:2400` にした模型と、最初から `h:2400` と書いた模型は、同じ正準JSONを与える。正準形が答えるのは「同じ建物か」であって「どう書かれたか」ではない。

同じことは `import` にも `stack` にもスパン展開にも帯にも言える — どれも合成の途中で普通の宣言に展開され、機械形式には残らない。

## 規則6 — 出所が追える

最終的な値を、どの層が与えたかを示せる。

```text
$ koyu layers main.muro --attrs
Layers (weakest first — later layers are stronger):
  0	main.muro
  1	plan.muro
  2	as-built.muro

Attribute provenance:
  boundary:/L1/a|/L1/b:t	← 2 as-built.muro
  space:/L1/a:h	← 2 as-built.muro
  space:/L1/a:spec	← 2 as-built.muro
```

出所の鍵は `<種別>:<対象>:<属性キー>` である。種別は `space` `zone` `boundary` `level` `asset` のいずれかで、境界の対象は `<パスa>|<パスb>` と綴る。API では `model.attrSrc` が同じ鍵を持ち、値は `model.layers` の添字である。

---

## 衝突とエラー

合成の解決が定まらない状態は、**モデルが組み上がる前に止まる**。壊れた JSON を JSON パーサが弾くのと同じ層にあり、診断として後から報告するものではない。`check --json` ではこれらは `SYN01` として現れ、行と — 合成のときは — ファイルを言う。

| 状態 | 扱い |
|---|---|
| 空間パス・ゾーンパス・アセット名・敷地形状の重複 | エラー (両者の出所つき) |
| `grid` / `name` / `koyu` の再宣言 | エラー (`name` は同じ文字列なら可) |
| `over` の対象が無い / `drop` の対象が無い | エラー |
| 同じ層が同じ属性に二度意見を持つ | エラー |
| 集合の編集で名が無い / 一意でない / 重複する | エラー |
| 同じファイルの二重 import・循環 | 冪等 (一度だけ合成される) |

## 何を合成しないか

- **案の分岐** — 一つのファイルに複数の案を畳まない。分岐は git が持つ
- **アセットの入れ子参照** — アセットはアセットを参照しない
- **層ごとの名前空間接頭辞** — パスの階層がすでに名前空間である
- **層の部分的な読み込み** — 層は丸ごと合成される

## 合成の語は muro 1.0 の語である

`over` `drop` と `+` / `-` / `=` は muro 1.0 で入った。`koyu 0.5` 以前を宣言したファイルにこれらを書けば、`check` が **VER04** (error) で止める。

`check --json` が返す診断はこう読める (コードと本文だけを抜き出したもの)。

```text
VER04  A koyu 0.5 file uses a 1.0 word: over /L1/a h:2500 (a composition override) — raise the version to koyu 1.0
VER04  A koyu 0.5 file uses a 1.0 word: drop /L1/b (a composition removal) — raise the version to koyu 1.0
```

版宣言を省いたファイルは最新版 `1.0` の意味論で読まれるので、この診断は出ない。受理される版は `0.1` `0.2` `0.3` `0.4` `0.5` `1.0` の六つで、新旧はこの並びの順である。

## 関連

- [import](import.md) — 層を読む一語と、層の並びの作られ方
- [over / drop](over-drop.md) — 上書き・削除・集合編集の綴りと制約
- [stack](stack.md) — 階を跨ぐ関係の一括宣言とスパン展開
- [koyu check](../cli/check.md) — 合成後のモデルに対して走る門番
- [koyu layers](../cli/layers.md) — 層の並びと属性の出所を印字する
