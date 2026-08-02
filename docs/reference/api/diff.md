---
title: 意味差分
mode: reference
---

# 意味差分

二つの模型を**構成の言葉で比べる。**行順・書式・素の `wall` 宣言と省略 (既定壁) の違いは差分にしない。

```ts
import { renderDiff, semanticDiff } from "@kensnzk/koyu";
import type { ModelDiff } from "@kensnzk/koyu";
```

## semanticDiff

```ts
function semanticDiff(a: Model, b: Model): ModelDiff
```

**不変量が一つある** — [`toCanonical(a) === toCanonical(b)`](canonical.md) なら差分は空である。

```ts
import { renderDiff, semanticDiff } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const a = parseFile("examples/two-rooms.muro");
const b = parseFile("examples/two-rooms.muro");
b.spaces.get("/L1/b")!.attrs["name"] = "書斎";

console.log(renderDiff(semanticDiff(a, b)));
console.log(renderDiff(semanticDiff(a, a)));
```

```text
[ '± /L1/b: name 居室B → 書斎' ]
[]
```

## ModelDiff

```ts
interface ModelDiff {
  version?: { from: string; to: string };
  name?: { from?: string; to?: string };
  grid: GridChange[];
  levels:     { added: string[];       removed: string[];       changed: ChangedItem[] };
  assets:     { added: string[];       removed: string[];       changed: ChangedItem[] };
  polygons:   { added: string[];       removed: string[];       changed: ChangedItem[] };
  zones:      { added: string[];       removed: string[];       renamed: RenamedItem[]; changed: ChangedItem[] };
  spaces:     { added: SpaceItem[];    removed: SpaceItem[];    renamed: RenamedItem[]; changed: ChangedItem[] };
  boundaries: { added: BoundaryItem[]; removed: BoundaryItem[]; changed: BoundaryChange[] };
  columns:    { added: ColumnItem[];   removed: ColumnItem[];   changed: ChangedItem[] };
}
```

**`columns` を忘れないこと。**柱の宣言は順序が意味を持つので、集合だけでなく**順位も差分の対象である** — 二行を入れ替えると実際に立つ柱が変わる。

構成する型は次の通り。

```ts
interface FieldChange {
  field: string;
  from?: string;    // 片方が無ければ、その側に無かった (追加/削除)
  to?: string;
}

interface ChangedItem {
  path: string;     // 新しい側 (b) の名
  fields: FieldChange[];
}

interface RenamedItem {
  from: string;
  to: string;
  uid: string;
}

interface GridChange {
  axis: "X" | "Y";
  name: string;
  kind: "added" | "removed" | "moved";
  from?: number;
  to?: number;
}

interface SpaceItem {
  path: string;
  type: string;
  areaM2?: number;
}

interface BoundaryItem {
  between: [string, string];
  edge?: Edge;
  kind: string;
  t?: number;
}

interface BoundaryChange {
  between: [string, string];
  edge?: Edge;
  fields: FieldChange[];
}

interface ColumnItem {
  at: number;       // 宣言の順位 (1始まり)
  label: string;
}
```

**空の差分でも構造は全部出る。**キーが欠けることは無いので、`d.columns.added.length` のような読み方が安全である。

```ts
console.log(JSON.stringify(semanticDiff(a, a), null, 1));
```

```text
{
 "grid": [],
 "levels": {
  "added": [],
  "removed": [],
  "changed": []
 },
 "assets": {
  "added": [],
  "removed": [],
  "changed": []
 },
 "polygons": {
  "added": [],
  "removed": [],
  "changed": []
 },
 "zones": {
  "added": [],
  "removed": [],
  "renamed": [],
  "changed": []
 },
 "spaces": {
  "added": [],
  "removed": [],
  "renamed": [],
  "changed": []
 },
 "boundaries": {
  "added": [],
  "removed": [],
  "changed": []
 },
 "columns": {
  "added": [],
  "removed": [],
  "changed": []
 }
}
```

`version` と `name` だけは、変化が無ければキーごと出ない。

## 対応付けの規則

**二段構えである。**

1. **`uid` の一致**で対にする (両側から消費する)
2. 残りを**パスの一致**で対にする
3. それでも残ったものが追加・削除

**uid が一致してパスが違えば改名である。**境界の対応は uid が継ぐので、一つの改名が境界の洪水にならない。

```ts
import { parse, renderDiff, semanticDiff } from "@kensnzk/koyu";

const r1 = parse(`grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 uid:u-0123456789abcdef`);
const r2 = parse(`grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/study room X1..X2 Y1..Y2 uid:u-0123456789abcdef`);

console.log(JSON.stringify(semanticDiff(r1, r2).spaces, null, 1));
console.log(renderDiff(semanticDiff(r1, r2)));
```

```text
{
 "added": [],
 "removed": [],
 "renamed": [
  {
   "from": "/L1/a",
   "to": "/L1/study",
   "uid": "u-0123456789abcdef"
  }
 ],
 "changed": []
}
```

```text
[ 'renamed /L1/a → /L1/study (uid:u-0123456789abcdef)' ]
```

uid が片側で重複している模型 (`UID03` のエラーが出る模型) では、その uid はパス照合へ落ちる。**検査でエラーの出る模型でも差分は落ちない。**

### 開口と `seg` の対応

**名があれば名が優先である。**名の付いた扉を動かせば「同じ扉の `at` が変わった」であって「消えて生えた」ではない。名が無ければ位置で対応づける他にない — 開口は `(kind, edge, at)`、`seg` は `(edge, at, w)`。

名のある開口と無い開口は別のキー空間に落ちるので、**名を後から書き足した編集は追加/削除に見える。**名を書く行為そのものが同一性の宣言なので、それでよい。

### 境界の向き

`a` の向きが意味を持つのは `edge` と開口の `swing` / `hinge` と `seg` があるときだけである。**それ以外では向きを比べない** — 二空間を書く順を入れ替えただけの編集は差分にならない。

`derived` の印も比較の直列に出ないので、**素の `wall` 宣言と既定壁は同一の直列になる。**「明示的に `boundary /L1/a /L1/b` と書き足した」は差分にならない。

## 柱

```ts
const head = `koyu 1.0
grid X 0 6000 12000
grid Y 0 6000
level L1 0 h:4000 slab:200
space /L1/hall room X1..X3 Y1..Y2
space /out outside:1
boundary /L1/hall /out
`;
const c1 = parse(head + `column 800 L1\n`);
const c2 = parse(head + `column 900 L1 x:X1,X2\ncolumn 800 L1\n`);

const d = semanticDiff(c1, c2);
console.log(JSON.stringify(d.columns, null, 1));
console.log(renderDiff(d));
```

```text
{
 "added": [
  {
   "at": 1,
   "label": "900 square L1 x:X1,X2"
  }
 ],
 "removed": [],
 "changed": [
  {
   "path": "800 square L1",
   "fields": [
    {
     "field": "rank",
     "from": "1",
     "to": "2"
    }
   ]
  }
 ]
}
```

```text
[
  '+ column 900 square L1 x:X1,X2',
  '± column 800 square L1: rank 1 → 2'
]
```

**宣言そのものは変わっていないのに `rank` の変化が出ている。**先に一行入ったので、その宣言が交点を取る順が変わった — つまり実際に立つ柱が変わりうる。これが「宣言順は意味である」ということである。

## 敷地形状の比較

多角形は**巡回正規化**して比べる。回転 (始点の書き替え) と反転 (逆回り) で最小になる直列を取るので、**同じ形を違う頂点から書き始めた編集は差分にならない。**

## renderDiff

```ts
function renderDiff(d: ModelDiff): string[]
```

差分を読める行にして返す。**語は英語である** — 日本語が出るのは模型に書かれた値 (室名など) のときだけである。**並びは `semanticDiff` が決めた正準順のまま**で、空なら空配列である。

記号は三つ。

| 記号 | 意味 |
|---|---|
| `+` | 追加 |
| `−` | 削除 |
| `±` | 変化 |

改名だけは記号を持たず、`renamed <前> → <後> (uid:…)` の形になる。

空間のパスは**レベル順に並ぶ** — 先頭セグメントがレベルなら「残りのパス、レベルの序数」で並べるので、スパン展開で生まれた同名の空間 (`/L4/A/ldk` … `/L10/A/ldk`) が隣接して階順に出る。

## 関連

- [正準JSON](canonical.md) — 差分が空であることと同値な形式
- [同一性の生成](identity.md) — 改名を跨ぐための `uid`
- [`koyu diff`](../cli/diff.md) — 同じ差分をコマンドラインから
