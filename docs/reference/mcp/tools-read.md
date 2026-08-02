---
title: 読む — model_summary / layers / spaces / canonical_json
mode: reference
---

# 読む — model_summary / layers / spaces / canonical_json

建物を読むだけの四つ。**どれも何も書かない。**引数はすべて entry の `.muro` パス `file` で、呼ぶたびにゼロから合成される。

この頁の出力はすべて実際に走らせて得たものである。絶対パスは `<abs>` に縮めてある。

## ざっと

| ツール | 何を返すか | いつ呼ぶか |
|---|---|---|
| [`model_summary`](#model_summary) | 建物一棟の要約 | **最初に一度。**次に何を読むかを決めるため |
| [`layers`](#layers) | 全レイヤーの全文 | 書き換える前に、原本を読むため |
| [`spaces`](#spaces) | 空間の一覧 | パス・面積・出所層を数え上げるため |
| [`canonical_json`](#canonical_json) | 合成後の単一モデル | 機械に渡す・外と繋ぐ・差分を取るため |

---

## model_summary

> Summary of the building: name, levels, layer composition, zones, door/window assets, areas, and check counts. Call this first

```json
{"name": "model_summary", "arguments": {"file": "<abs>/examples/two-rooms.muro"}}
```

`file` のみ、必須。

```text
{
 "name": "二室",
 "unit": "mm",
 "layers": [
  "<abs>/examples/two-rooms.muro"
 ],
 "levels": [
  {
   "name": "L1",
   "z": 0,
   "h": 2400,
   "slab": 150
  }
 ],
 "spaces": 3,
 "boundaries": 3,
 "zones": [],
 "assets": [],
 "totalFloorM2": 32.4,
 "semiOutdoorM2": 0,
 "floorsM2": {
  "L1": {
   "rooms": 2,
   "subtotalM2": 32.4
  }
 },
 "byUseM2": {
  "(unspecified)": 32.4
 },
 "check": {
  "errors": 0,
  "warnings": 0
 },
 "hint": "Read layer contents with layers, check with check, and edit with write_layer (check is the gatekeeper). Architectural verdicts come from validate."
}
```

| フィールド | 中身 |
|---|---|
| `name` `unit` | 書かれた建物名と単位 |
| `layers` | 合成に参加した全レイヤーの絶対パス。**強度順序**である — 添字 0 が entry ([`layers`](#layers) と同じ並び) |
| `levels` | 宣言順ではなく `z` の昇順。`h` と `slab` は**書かれたときだけ**出る |
| `spaces` | 空間の数 (領域を持たない空間・`exterior`・`void` も含む) |
| `boundaries` | **導出後**の境界の本数 |
| `zones` | `path`・`name` (書かれたときだけ)・`site: true` (敷地ゾーンのときだけ)・`areaM2` |
| `assets` | 建具アセットの `name` / `kind` (`door` または `window`) / `attrs` 全部 |
| `totalFloorM2` | 屋内の延べ床面積 |
| `semiOutdoorM2` | 半屋外の面積。**延べ床には入っていない** |
| `floorsM2` | レベル別の `{rooms, subtotalM2}` |
| `byUseM2` | `use` 別の面積。`use` が決まらない空間は `(unspecified)` に寄る |
| `check` | `{errors, warnings}` の件数だけ。本文は返らない |
| `sitePolygons` | `polygon` を持つゾーンのパス。**一つも無ければキーごと出ない** |
| `hint` | エージェント向けの固定文 |

### 数え方の約束

**`boundaries` は導出後の本数である。**接する空間の既定は壁なので、`boundary` を一行も書かなくても境界は現れる。だから `layers` が返す原本の `boundary` 行数より多くなることがある。書かれた構成の側の数を見たいときは [`canonical_json`](#canonical_json) を使う。

**`totalFloorM2` は屋内だけを数える。**`exterior` と `void`、および半屋外と判定された空間は入らない。半屋外の分は `semiOutdoorM2` に別掲される。`floorsM2` に出るのも屋内の室だけで、屋内の室を一つも持たないレベルはキーごと出ない。

**`zones[].areaM2` は二通りある。**敷地ゾーン (`site:1`) に `polygon` が書かれていれば、その多角形の面積である。それ以外は、そのパスの下にある**屋内**空間の床面積の合計である。だから庭と通路だけを従えた敷地ゾーンは `0` と出る。

```text
 "zones": [
  {
   "path": "/site",
   "name": "敷地",
   "site": true,
   "areaM2": 0
  },
  {
   "path": "/home",
   "name": "住戸",
   "areaM2": 92.75
  }
 ],
```

(`examples/house/main.muro` に掛けた同じ出力の `zones` の部分。`/site` の下は庭と通路だけなので、屋内の合計は 0 になる。敷地面積そのものを問うなら [`site`](tools-ask.md#site) を呼ぶ — そちらは `126.24` を返す。)

`polygon` を持つ例に掛ければ、多角形の面積がそのまま出て `sitePolygons` も現れる。

```text
 "zones": [
  {
   "path": "/site",
   "name": "敷地",
   "site": true,
   "areaM2": 1097.8
  },
```

```text
 "sitePolygons": [
  "/site"
 ],
```

(`examples/tower/main.muro` に掛けた同じ出力の抜粋。)

---

## layers

> Returns every layer (.muro file) taking part in the composition, in strength order (later layers are stronger), with its source — this is how you read the original

```json
{"name": "layers", "arguments": {"file": "<abs>/main.muro"}}
```

`file` のみ、必須。返るのは `{file, source}` の配列で、`source` はそのファイルの全文をそのまま持つ。

次の二枚を合成した場合。

```muro-part
# main.muro — entry
koyu 1.0
name 二層
unit mm

grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150

import ./L1.muro
```

```muro-part
# L1.muro
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out name:外部 outside:1

boundary /L1/b /out t:150
  door w:900 h:2100 edge:S name:玄関
```

`main.muro` を entry にして呼ぶと、こう返る。

```text
[
 {
  "file": "<abs>/tiny/main.muro",
  "source": "# main.muro — entry\nkoyu 1.0\nname 二層\nunit mm\n\ngrid X 0 3600 7200\ngrid Y 0 4500\nlevel L1 0 h:2400 slab:150\n\nimport ./L1.muro\n"
 },
 {
  "file": "<abs>/tiny/L1.muro",
  "source": "# L1.muro\nspace /L1/a room X1..X2 Y1..Y2 name:居室A\nspace /L1/b room X2..X3 Y1..Y2 name:居室B\nspace /out exterior name:外部\n\nboundary /L1/b /out t:150\n  door w:900 h:2100 edge:S name:玄関\n"
 }
]
```

### 並びは強度順序である

**返る配列は合成の強度順序に並ぶ** — 添字 0 が entry で最も弱く、後の層ほど強い。並べ替えはしない。上の例で `main.muro` が先に来るのはそれが entry だからで、絶対パスの辞書順なら `L1.muro` が先になる。

**どの層の意見が勝つかを決めるのはこの並びである**ので、エージェントが必要とするのはこちらである ([合成の六規則](../muro/composition.md))。同じ並びを人向けに印字するのが [`koyu layers`](../cli/layers.md) で、同じ二枚に対してこう出る。

```text
Layers (weakest first — later layers are stronger):
  0	<abs>/tiny/main.muro
  1	<abs>/tiny/L1.muro
```

どの層がどの属性の最終値を与えたかは `koyu layers --attrs` が見せる。**この面は MCP に無い。**

### 見えるのは合成に参加した層だけ

`import` で辿り着けないファイルは返らない。ディレクトリに `.muro` が転がっていても、誰も `import` していなければ `layers` には現れず、[`check`](tools-verify.md#check) も中身を見ない。

entry 自身は必ず含まれる。

---

## spaces

> List of spaces: path, type, level, area, semi-outdoor flag, and originating layer. Optionally filtered by level

```json
{"name": "spaces", "arguments": {"file": "<abs>/examples/two-rooms.muro"}}
```

| 引数 | 必須 | 中身 |
|---|---|---|
| `file` | ○ | entry の `.muro` パス |
| `level` | — | レベル名。書けばそのレベルの空間だけに絞る |

```text
[
 {
  "path": "/L1/a",
  "type": "room",
  "name": "居室A",
  "level": "L1",
  "areaM2": 16.2,
  "semiOutdoor": false,
  "layer": "<abs>/examples/two-rooms.muro"
 },
 {
  "path": "/L1/b",
  "type": "room",
  "name": "居室B",
  "level": "L1",
  "areaM2": 16.2,
  "semiOutdoor": false,
  "layer": "<abs>/examples/two-rooms.muro"
 },
 {
  "path": "/out",
  "type": "exterior",
  "name": "外部",
  "semiOutdoor": false,
  "layer": "<abs>/examples/two-rooms.muro"
 }
]
```

| フィールド | 中身 |
|---|---|
| `path` | 空間のパス |
| `type` | 書かれた型 (`room` `ldk` `hall` `exterior` `void` …) |
| `name` | `name:` があればその値、無ければパスの最終要素 |
| `level` | 所属レベル。**決まっていなければキーごと出ない** |
| `areaM2` | 壁芯の床面積。**領域を持たない空間ではキーごと出ない** |
| `semiOutdoor` | 半屋外と判定されたか |
| `layer` | その空間を宣言した層の絶対パス |

上の `/out` がその両方を見せている — `exterior` に領域もレベルも無いので、`level` も `areaM2` も出ない。

**母集団は絞られていない。**`exterior` も `void` も領域を持たない空間も、全部が並ぶ。屋内かどうかで数えたいなら `semiOutdoor` と `type` を自分で見る。面積の合計が要るだけなら [`model_summary`](#model_summary) のほうが早い。

`level` で絞ると、外部と敷地をまたいで同じレベルの空間が並ぶ。

```text
[
 {
  "path": "/site/garden",
  "type": "garden",
  "name": "南庭",
  "level": "L1",
  "areaM2": 41.12,
  "semiOutdoor": true,
  "layer": "<abs>/examples/house/site.muro"
 },
```

(`{"file": "<abs>/examples/house/main.muro", "level": "L1"}` の返りの先頭。同じ呼び出しは 6 件を返す。)

`layer` は編集の宛先を決める鍵である。ここに出たパスが、そのまま [`write_layer`](tools-write.md#write_layer) の `layer` 引数になる。

---

## canonical_json

> The canonical JSON (machine format — one composed model, byte-stable). The ground for diffing and for external connections

```json
{"name": "canonical_json", "arguments": {"file": "<abs>/examples/two-rooms.muro"}}
```

`file` のみ、必須。合成後の一棟を、機械が読む単一の JSON にして返す。

```text
{
 "format": "koyu-canonical/1.1",
 "koyu": "1.0",
 "name": "二室",
 "unit": "mm",
 "grid": {
  "X": [
   0,
   3600,
   7200
  ],
  "Y": [
   0,
   4500
  ]
 },
 "levels": {
  "L1": {
   "z": 0,
   "h": 2400,
   "slab": 150
  }
 },
```

(先頭の抜粋。同じ呼び出しは `spaces` と `boundaries` を続けて返す。)

**書かれた構成だけが入る。**導出された既定の壁は入らない。扉を一枚も書かない二室の例で、[`check`](tools-verify.md#check) は `"boundaries": 1` と答えるが、`canonical_json` の `boundaries` は空である。**「何が書かれたか」を数えたいときはこちらを見る。**

**字下げは空白 1 個で、[`koyu json`](../cli/json.md) が書くファイルとはバイト列が一致しない。**MCP のツール応答はすべて空白 1 個で書かれるからである。キーの順序と値はどちらも同じなので、読み込んで比べるぶんには一致する。バイト単位で安定した形が要るときは CLI 側を使う。

## 関連

- [書く — write_layer / new_uids](tools-write.md) — ここで読んだ層を書き換える
- [確かめる — check / validate](tools-verify.md) — 書いた後の門番
- [問う — doors / light / site / plan_svg](tools-ask.md) — 帰結を確かめる
- [koyu layers](../cli/layers.md) — 層の強度順序と属性の出所
- [koyu json](../cli/json.md) — バイト列まで安定した正準 JSON
- [koyu stats](../cli/stats.md) — 同じ面積を人向けに並べる
