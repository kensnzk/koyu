---
title: エージェントに書かせる標準ループ
mode: howto
---

# エージェントに書かせる標準ループ

エージェントに `.muro` を編集させるときの作業の順序である。

```text
model_summary  →  layers  →  write_layer  →  check ──エラー──→ 直して write_layer へ戻る
                                               │
                                               └──緑──→ doors / light / site で帰結を確かめる
```

**この順序は git の作業と同型である。**掴む・読む・書く・門番を通す・帰結を確かめる。エージェントが暴れるのは、たいてい「読まずに書く」か「門番を通さずに次へ行く」のどちらかである。

サーバーの登録はここでは扱わない — [MCP をクライアントに登録する](install-mcp.md)にある。各ツールの引数と返りの形は[読む](../reference/mcp/tools-read.md) / [書く](../reference/mcp/tools-write.md) / [確かめる](../reference/mcp/tools-verify.md) / [問う](../reference/mcp/tools-ask.md)にある。

以下の出力は実際に走らせて得たものである。絶対パスは `<dir>/` と略した。

## 題材

二室の平屋。玄関の扉が一枚あるだけで、室と室のあいだには何も書かれていない。

```muro-part
koyu 1.1
name 平屋
unit mm

grid X 0 3600 7200
grid Y 0 4500

level L1 0 h:2400 slab:150

import ./L1.muro
```

```muro-part
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out  name:外部 outside:1

boundary /L1/b /out t:150 spec:EW edge:S
  door w:900 h:2100 name:玄関
```

## 0. コミットする

```sh
git add . && git commit -m "before the agent edits"
```

`write_layer` は全置換で書き、取り消しを持たない。**これを飛ばした作業には戻り道が無い。**

## 1. model_summary — 建物を掴む

一度の呼び出しで、レイヤー構成・レベル・ゾーン・面積・`check` の件数が返る。**次にどのファイルを読めばよいかがここで決まる。**

```text
{
 "name": "平屋",
 "unit": "mm",
 "layers": [
  "<dir>/L1.muro",
  "<dir>/main.muro"
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
 "boundaries": 2,
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
 }
}
```

(`hint` の一行は省いた。)

**`check` が 0 / 0 でも、この建物は使えない。**室 A から外へ出る道が無い。要約は「書かれたものが矛盾していない」ことしか言っていない。

`boundaries` は合成後の本数で、導出された既定の壁を含む。原本に書かれた `boundary` 行の数とは一致しない。

## 2. layers — 原本を読む

合成に参加した全レイヤーの全文が `{file, source}` で返る。`import` は自動で辿られ、**参照されていないファイルは返らない。**

エージェントが編集前に読むべきは、要約ではなくここである。要約は構造しか持たないので、綴り・並び・コメントは読めない。

## 3. write_layer — 書く

引数は entry (`file`)・書き込み先 (`layer`)・**全文** (`content`) の三つである。差分ではない。

室 A と室 B のあいだに扉を吊る編集は、`L1.muro` を丸ごと書き直す形になる。

```muro-part
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out  name:外部 outside:1

boundary /L1/a /L1/b t:120 spec:PW
  door w:800 h:2000 name:D-中扉

boundary /L1/b /out t:150 spec:EW edge:S
  door w:900 h:2100 name:玄関
```

返りには**書いた直後の `check` の結果が載る。**編集と検証が一往復で済む。

```text
{
 "written": "<dir>/L1.muro",
 "ok": true,
 "spaces": 3,
 "errors": [],
 "warnings": []
}
```

### 書き込みの前に門番が立つ

`write_layer` は差し替え後の内容で**仮想的に合成してから**書く。parse できない内容は**原本に一切触れない。**

```text
{
 "written": false,
 "target": "<dir>/rooms.muro",
 "ok": false,
 "parseError": "<dir>/rooms.muro:line 1: Undefined grid line name: X9"
}
```

parse は通るが `check` がエラーになる内容は**書かれる。**複数レイヤーにまたがる編集を段階的に進められるようにするためで、`written` にはパスが入り `ok` が false になる。次の呼び出しで直す。

```text
{
 "written": "<dir>/rooms.muro",
 "ok": false,
 "spaces": 2,
 "errors": [
  "<dir>/rooms.muro:line 3: References an undefined space: /L1/c"
 ],
 "warnings": []
}
```

書き込み先の制約と atomic 性は[書く — write_layer / new_uids](../reference/mcp/tools-write.md)にある。**新しいレイヤーを作るときは、`import` 行の追加を同じ作業単位に入れる** — どこからも import されていないファイルは合成に参加しないので、中身が一度も検査されない。

## 4. check — 門番を通す

`write_layer` の返りに載るので、緑ならそのまま次へ進める。エラーが返ったら**直して再度書く。**ここで止まらずに先へ進む段取りにすると、壊れたまま図面まで生成される。

`check` が返す `diagnostics` はコード付きの構造化診断である。人向けの出力にコードは出ないが、MCP の返りには最初から入っている。コードから直し方を引く表は[診断コード索引](../reference/diagnostics/index.md)にある。

## 5. 帰結を確かめる

**ここが最も飛ばされる段である。**`check` は動線も採光も敷地も見ていない。編集が意図した帰結を持ったことは、別の問いで確かめる。

編集前、室 A から外へは出られなかった。

```text
{
 "unreachable": true
}
```

扉を一枚吊ったあと、同じ問いはこう答える。

```text
{
 "doors": 2,
 "path": [
  "/L1/a",
  "/L1/b",
  "/out"
 ]
}
```

そして `validate` は、`check` が緑のままでも建築の側の指摘を返し続ける。

```text
{
 "findings": [
  {
   "rule": "envelope.gap",
   "level": "caution",
   "message": "Perimeter not faced by any envelope: /L1/a — S 3600mm / N 3600mm / W 4500mm (11700mm over 3 run(s)). Write a boundary to the exterior",
   "line": 1,
   "file": "<dir>/L1.muro",
   "path": [
    "/L1/a"
   ]
  },
  {
   "rule": "envelope.gap",
   "level": "caution",
   "message": "Perimeter not faced by any envelope: /L1/b — E 4500mm / N 3600mm (8100mm over 2 run(s)). Write a boundary to the exterior",
   "line": 2,
   "file": "<dir>/L1.muro",
   "path": [
    "/L1/b"
   ]
  }
 ],
 "violations": 0,
 "cautions": 2
}
```

外壁が一枚も書かれていない。`check` はこれを一度も指摘していない — 領域を持たない空間との境界は導出されないからである。

**どの問いを立てるかは編集の種類が決める。**

| 編集したもの | 確かめる問い |
|---|---|
| 間仕切り・扉 | [`doors`](../reference/mcp/tools-ask.md#doors) — 到達可能性と扉数 |
| 窓・室の型 | [`light`](../reference/mcp/tools-ask.md#light) — 床面積と有効窓面積 |
| 領域・レベル | [`site`](../reference/mcp/tools-ask.md#site) — 建蔽率と容積率 |
| 何であれ | [`validate`](../reference/mcp/tools-verify.md#validate) — 建築の側の指摘 |

## エージェントに渡す規律

指示に添えておくと事故が減るものを並べる。

1. **書く前に `layers` で読む。**要約から書くと、綴りとコメントが失われる。
2. **`write_layer` は全置換である。**返す `content` は編集後のファイルの全文でなければならない。
3. **`ok: false` が返ったら、次の行動は「直して再度書く」以外に無い。**
4. **緑を根拠に「動く」と言わない。**`check` が緑でも、扉が一枚も無い建物は密封されている。
5. **`uid` は呼ばれるまで誰も書かない。**改名を跨いで空間を指し続ける必要が出たときだけ [`new_uids`](../reference/mcp/tools-write.md#new_uids) を呼び、書いたあとに `check` を通す。
6. **形は生成物である。**平面図を「書く」ことはできない。[`plan_svg`](../reference/mcp/tools-ask.md#plan_svg) が導出して返す。

## 関連

- [MCP をクライアントに登録する](install-mcp.md) — 繋ぐまでの手順
- [stdio で MCP を手で叩く](debug-mcp.md) — エージェントを外して挙動を確かめる
- [実測を計画に重ねる](write-as-built.md) — 原本を書き換えずに上書きを重ねる書き方
- [koyu-mcp](../reference/mcp/index.md) — 無状態であることと 12 のツール
- [約束の範囲](../reference/scope.md) — `check` が緑であることの意味
