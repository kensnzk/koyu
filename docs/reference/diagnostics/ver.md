---
title: VER — 言語の版
mode: reference
---

# VER — 言語の版

VER は四つある。すべてエラーである。

| コード | severity | 何を言うか |
|---|---|---|
| VER01 | error | koyu 0.1 のファイルに、境界の宣言が無い接触ペアがある |
| VER02 | error | koyu 0.3 以前のファイルに、`daylight` の無い居室型の空間がある |
| VER03 | error | koyu 0.4 以前のファイルに 0.5 の語がある |
| VER04 | error | koyu 0.5 以前のファイルに 1.0 の語がある |

## 版の宣言

```muro-part
koyu 1.0
```

受理される版は **0.1 / 0.2 / 0.3 / 0.4 / 0.5 / 1.0** の六つ。これ以外を書くと、意味の検査に入る前にパーサが止める。

```text
Unsupported koyu version: 0.9 (this tool supports 0.1, 0.2, 0.3, 0.4, 0.5, 1.0)
```

宣言は base 層 (entry) で**一度だけ**書く。慣例として一行目に置く。`import` した層に書くとエラーになる — 合成順による黙った上書きを禁じるためである。

**版を書かなければ、そのファイルは最新版 (1.0) の意味論で読まれる。**だから VER のコードは一件も出ない。VER を見るのは、意味を固定するために版を明示したファイルだけである。

## 旧版が受理される条件

**旧版は意味が保存される場合にだけ受理される。**古い版を書いたファイルを新しい処理系が読むとき、道は二つしかない。

- 新旧で同じ意味になる — そのまま読む
- 意味が変わる — **黙って新しい意味で読まない**。エラーにして二択を示す

VER の四つは、この二番目の場所に立っている。だからメッセージは必ず「これを直すか、版を上げるか」の形をしている。

## VER01 — 0.1 に既定境界が導出される

`error`

```muro-bad
koyu 0.1
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a hall X1..X2 Y1..Y2
space /L1/b hall X2..X3 Y1..Y2
```

```text
A koyu 0.1 file has a touching pair with no declared boundary: /L1/a | /L1/b — in 0.2 a default wall is derived and the meaning changes. Declare the boundary, or raise the version to koyu 0.2
```

**原因** — 0.1 では「接しているのに境界が無い」は警告どまりで、境界は生えなかった。0.2 からは、平面で接する空間の組に宣言境界が一つも無ければ **`wall` の既定境界が導出される**。未宣言の接触は「未定義」ではなく「壁」を意味するようになった。同じファイルが版によって違う建物になる。

**直し方** — メッセージが示す二択のどちらかを選ぶ。

- 新しい意味で読ませる → 一行目を `koyu 0.2` にする
- 0.1 の意味を保つ → 指摘された対に `boundary` を明示的に書く

このコードの本文が `0.2` を挙げるのは、これが 0.1 と 0.2 の境目の規定だからである。

## VER02 — 0.3 以前に daylight の無い居室型がある

`error`

```muro-bad
koyu 0.3
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
```

```text
A koyu 0.3 file has a room with no daylight: /L1/a — 0.4 does not infer the daylight scope from the type, so it falls out of the check. Write daylight:1 (in scope) or daylight:0 (out of scope), then raise the version to koyu 0.4
```

**原因** — 0.3 以前は五つの型 — `unit` `room` `ldk` `bedroom` `living` — を採光の対象と**推定**して判定に載せていた。0.4 からは型から推定しない ([DAY01](./day.md))。`daylight` を書かないまま版を上げると、その空間は黙って対象から外れ、`koyu light` は「全室合格」と区別の付かない出力を返す。

**直し方** — 指摘された空間を判定するかどうかを書き、そのうえで版を上げる。

- 採光を判定する → `daylight:1` を足す
- 判定しない (納戸・物置・非居室として書いていた) → `daylight:0` を足す
- どちらの場合も、書き終えたら一行目を `koyu 0.4` にする

`daylight` が既に書かれている空間は新旧で意味が同じなので、このコードは出ない。

## VER03 — 0.4 以前に 0.5 の語がある

`error`

```muro-bad
koyu 0.4
grid X 0 3000
grid Y 0 8000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y1+7000 stair:N
space /L2/s stair X1..X2 Y1..Y1+7000
stack s L1..L2 type:stair
```

```text
A koyu 0.4 file uses a 0.5 word: /L1/s carries stair: (a vertical circulation) — raise the version to koyu 0.5
```

**原因** — 0.5 で入った四つの語を、0.4 以前の処理系は知らない。知らない処理系ではその語が読み飛ばされ、**形が黙って生成されない**。

| 0.5 の語 | 本文の言い方 |
|---|---|
| 縦動線の宣言 (`stair:` `ramp:` `escalator:` `lift:`) | `/L1/s carries stair: (a vertical circulation)` |
| 描かれた線 (`line`) | `/L1/a \| /L1/b carries line (a drawn line)` |
| 柱 (`column`) | `column` |
| 地下 (`underground:`) | `level B1 carries underground:` |

**直し方** — 一行目を `koyu 0.5` にする。新しい語を使わないなら 0.4 のままでよい。

## VER04 — 0.5 以前に 1.0 の語がある

`error`

```muro-bad
koyu 0.5
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out exterior
boundary /L1/a /out t:150
  door w:800 edge:S name:D1
drop /L1/b
over /L1/a /out
  - door D1
```

```text
A koyu 0.5 file uses a 1.0 word: drop /L1/b (a composition removal) — raise the version to koyu 1.0
A koyu 0.5 file uses a 1.0 word: over /L1/a /out (a composition override) — raise the version to koyu 1.0
A koyu 0.5 file uses a 1.0 word: - door D1 (a set edit under over) — raise the version to koyu 1.0
```

**原因** — 1.0 で入った合成の編集を、0.5 以前の処理系は知らない。

| 1.0 の語 | 本文の言い方 |
|---|---|
| 上書き (`over`) | `a composition override` |
| 削除 (`drop`) | `a composition removal` |
| `over` 直下の集合編集 (`+` `-` `=`) | `a set edit under over` |

VER03 と同型だが、帰結はもっと悪い。知らない処理系ではその行が語として読めず、**上書きも削除も起きないまま、黙って別の建物になる**。

**診断は編集ごとに一件出る。**上の例は三行が編集なので三件である。

**直し方** — 一行目を `koyu 1.0` にする。合成の編集を使わないなら 0.5 のままでよい。

## 版を書く意味

版を書かなければ最新版で読まれるので、VER は一度も出ない。**版を書くのは、そのファイルの意味を過去の一点に固定したいときである。**固定した以上、新しい語を混ぜれば止められる — それがこの四つのコードの仕事である。

逆に言えば、**新しい記法を使いたくなったら、版を上げるのが正しい直し方である。**メッセージが毎回その一行を示している。

## 関連

- [DAY — 採光の対象](./day.md) — VER02 が指す `daylight` の宣言
- [RUN — 縦動線](./run.md) / [LIN — 描かれた線](./lin.md) / [COL — 柱](./col.md) — VER03 が指す 0.5 の語
- [SYN — 構文と合成](./syn.md) — 受理されない版、二度の宣言、base 層でない宣言
- [koyu check](../cli/check.md)
