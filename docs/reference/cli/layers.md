---
title: koyu layers
mode: reference
---

# koyu layers

合成に参加した層を強度の弱い順に並べ、`--attrs` を付ければ最終的な属性値をどの層が与えたかを言う。**暗黙の解決がどこにも無いことを、目で確かめるための面である。**

## 引数

```text
koyu layers <entry.muro> [--attrs]
```

entry のパスを一つ取る。

## 旗

| 旗 | 効果 |
|---|---|
| `--attrs` | 属性ごとの最終値の出所を、層の添字とファイル名で並べる |

## 出力

層は `import` 行の並びを深さ優先で平坦化した順に出る。**entry は添字 0 で最も弱く、後の層ほど強い。**

```sh
npx tsx src/cli.ts layers examples/house/main.muro
```

```text
Layers (weakest first — later layers are stronger):
  0	<absolute path>/examples/house/main.muro
  1	<absolute path>/examples/house/assets.muro
  2	<absolute path>/examples/house/site.muro
  3	<absolute path>/examples/house/L1.muro
  4	<absolute path>/examples/house/L2.muro
```

(`<absolute path>` は解決済みの絶対パスを略した表記である。実際の出力にはフルパスが出る。)

**強度は走査の順ではない。**entry の行が `import` より後ろにあっても、entry は添字 0 のままである。順序で決めていたら、`import` 行を上下に動かしただけで結果が変わってしまう。

同じ層が二度 `import` されても、最初の位置を保って一度だけ合成される。

`import` を一つも持たないファイルでは、その一枚だけが出る。

```sh
npx tsx src/cli.ts layers examples/two-rooms.muro
```

```text
Layers (weakest first — later layers are stronger):
  0	<absolute path>/examples/two-rooms.muro
```

## --attrs — 値の出所

`--attrs` は層の一覧に続けて、**上書きによって出所が動いた属性**を並べる。

```muro-part
# main.muro — base 層
import ./plan.muro        # 層1
import ./as-built.muro    # 層2 — こちらが強い
```

```muro-part
# as-built.muro — 層2
over /L1/a h:2250 spec:改修後
over /L1/a /L1/b t:200
```

```sh
npx tsx src/cli.ts layers main.muro --attrs
```

```text
Layers (weakest first — later layers are stronger):
  0	<absolute path>/main.muro
  1	<absolute path>/plan.muro
  2	<absolute path>/as-built.muro

Attribute provenance:
  boundary:/L1/a|/L1/b:t	← 2 <absolute path>/as-built.muro
  space:/L1/a:h	← 2 <absolute path>/as-built.muro
  space:/L1/a:spec	← 2 <absolute path>/as-built.muro
```

左の列は `<種別>:<対象>:<属性キー>` である。種別は `space` `zone` `boundary` `level` `asset` のいずれかで、境界の対象は二つのパスを `|` で繋いだ形になる。矢印の右は層の添字とそのファイルである。

行は左の列の辞書順に並ぶ。

**`over` を一つも書いていない建物では、この節は見出しだけになる。**出所が記録されるのは値が上書きの対象になったときで、定義したまま誰も触っていない属性は並ばない。同梱の例はどれも `over` を使っていないので、`--attrs` を付けても `Attribute provenance:` の下は空である。

```sh
npx tsx src/cli.ts layers examples/tower/main.muro --attrs
```

```text
Layers (weakest first — later layers are stronger):
  0	<absolute path>/examples/tower/main.muro
  1	<absolute path>/examples/tower/assets.muro
  2	<absolute path>/examples/tower/site-geometry.muro
  3	<absolute path>/examples/tower/site.muro
  4	<absolute path>/examples/tower/L1.muro
  5	<absolute path>/examples/tower/L2.muro
  6	<absolute path>/examples/tower/typical.muro
  7	<absolute path>/examples/tower/L3.muro
  8	<absolute path>/examples/tower/L11.muro

Attribute provenance:
```

## 合成が止まるとき

強度の順序が決まらない状態は、モデルが組み上がる前に止まる。`layers` はそこまで辿り着けないので、`✖` の一行を出して終了コード 1 で終わる。**同じ層が同じ属性に二度意見を持つのはエラーである** — どちらが勝つかが決まらないからで、これは「暗黙の解決を残さない」の直接の帰結である。

同様に、`over` の対象が無い・`drop` の対象が無い・空間パスやアセット名が重複する、といった状態もすべて合成の前で止まる。

## 終了コード

| 終了コード | 意味 |
|---|---|
| 0 | 層の一覧を出せた |
| 1 | 構文・合成エラーで読めなかった |
| 2 | ファイルパスを渡していない (使い方が印字される) |

**層が一枚も無いこと自体は起こらない。**CLI はファイルから合成するので、entry そのものが必ず添字 0 の層になる。

## 関連

- [koyu diff](diff.md) — 合成後の二つのモデルを構成の言葉で比べる
- [koyu check](check.md) — 合成が通った後の整合の検査
- [.muro リファレンス](../muro/index.md) — `import` `over` `drop` の書き方
- [koyu コマンド](index.md) — entry と import の解決
