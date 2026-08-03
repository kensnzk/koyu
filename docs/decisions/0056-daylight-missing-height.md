# ADR-0056: `h:` を欠く窓は analysis を partial にせず、complete な artifact の明示事実として持つ

- 状態: 採用
- 日付: 2026-08-03
- 対象: `koyu.analysis.daylight@1`、`koyu.schematic.daylight.ratio@1`、`koyu.schematic.daylight.unknown@1`

## 文脈

ADR-0055 は built-in catalog に六つの analysis を置くと決めたが、採光だけは表現が一つ決まっていなかった。`daylightInputs` は `h:` を書かれていない `window` を面積の和から落とし、落としたという事実を `missingH` という真偽値だけで返す。旧実装はこれを二つの Finding に分けている — 比が足りなければ `daylight.ratio`、数え落としがあれば `daylight.unknown` である。両方が同時に出ることもある。

ADR-0054 の protocol には、入力が足りないことを表す `partial` artifact と `MissingInput` がある。`h:` の欠落をこれに載せると、protocol の語彙としては素直に見える。しかしその場合、当該空間の `ratio` は `indeterminate` になり、旧実装が出していた「既知の窓面積だけで比を判定する」結果が消える。ADR-0055 第5節は、API の移行と判定意味の変更を同じ変更に混ぜないことを parity の条件としている。

`partial` と `MissingInput` が本来指しているのは、**外部から与えられるべき context が無い**状態である。`h:` の欠落はそうではない。`.muro` に書かれた宣言そのものの性質であり、model の中で完結して観測できる。

## 決定

`koyu.analysis.daylight@1` は `h:` の欠落があっても artifact を `complete` のまま返す。

欠落は捨てず、空間ごとの事実 `missingHeightOpenings` として保持する。各要素は canonical な boundary/opening 索引による識別子、その boundary、幅、そして boundary の実在する行と file を持つ。`daylight.unknown` はこの列の長さを見て `pass`/`fail` を出し、`daylight.ratio` は従来どおり数え上がった有効窓面積で比を判定する。したがって二つの rule は独立に成立し、旧実装と同じく併記され得る。

母集団は `daylightInputs` と同一である — 領域を持ち `daylight:1` を宣言した空間だけを対象とし、係数が 0 にならない boundary の窓だけを数える。屋内の隣室に面する `h:` 無しの窓は、そもそも数える対象ではないので欠落として数えない。列挙は識別子を付けるためだけに行い、面積は `daylightInputs` の値をそのまま使う。両者が食い違い得ないことを試験で固定する。

## 棄却した代替案

**`h:` 欠落を `partial` + `MissingInput` にする。** 棄却する。当該空間の `ratio` が `indeterminate` に変わり、既存 fixture の結果が動く。ADR-0055 の parity 条件を破り、API 移行と判定意味の変更が混ざる。将来 `h:` の推定や外部入力を導入するなら、それは別の analysis revision であって、この revision と同一視しない。

**`missingH` の真偽値だけを artifact に載せる。** 棄却する。どの窓が数え落とされたかを CLI と MCP が独自に再走査することになり、ADR-0055 第2節が禁じた重複計算に戻る。

**欠落があるとき `ratio` を出さない。** 棄却する。旧実装の沈黙は「足りている」と「数え切れていない」を区別しない。その区別を付けることが `daylight.unknown` の存在理由である。

## 帰結

採光の artifact は常に `complete` であり、`ratio` と `unknown` は同じ事実から独立に結論を出す。数え落としは真偽値ではなく、位置を持つ列として外に出るので、CLI と MCP は「どの窓に `h:` を書けばよいか」を再計算せずに言える。

`partial` と `MissingInput` の意味は「外部 context の欠落」に保たれる。model の中で観測できる不足をそこに載せない、という境界がこの ADR で確定する。

## 証拠と受入条件

- 三つの採光 reference fixture が、旧 level、subject、出所行、本文と一致する
- 有効窓面積が必要面積にちょうど等しいとき `pass`、その直下で `fail` となる
- `h:` を欠く窓を持つ空間で artifact が `complete` のままであり、`missing` を持たない
- 屋内の隣室に面する `h:` 無しの窓が欠落として数えられない
- 全 fixture で `missingHeightOpenings` の有無が `daylightInputs` の `missingH` と一致する
- provider の前後で `toCanonical(model)` が一致する
- artifact に rule ID と判定語彙が無い
