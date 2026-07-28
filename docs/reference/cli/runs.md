---
title: koyu runs
mode: reference
---

# koyu runs

縦動線の一覧を出す。**段数も踏面も踊り場も勾配も、原本には書かれていない。**領域と階高から導かれる。何が導かれたのかを目で見るのがこのコマンドである。

## 引数

```text
koyu runs <entry.muro>
```

entry のパスを一つ取る。

## 旗

無い。

## 出力

一つの走り (run) が一行になる。走りは**階と階のあいだ**に立つので、三層を貫く階段は三行ではなく二行として出る。

```sh
npx tsx src/cli.ts runs examples/basement/main.muro
```

```text
B2→B1	lift	EV	/B2/ev
B2→B1	ramp	車路	rise 3700mm	return	slope 1/7.2	going 26800mm	/B2/ramp
B2→B1	stair	避難階段	rise 3700mm	return	21 risers of 176mm, tread 300mm	going 6000mm	/B2/st
B1→L1	lift	EV	/B1/ev
B1→L1	ramp	車路	rise 3700mm	return	slope 1/7.2	going 26800mm	/B1/ramp
B1→L1	stair	避難階段	rise 3700mm	return	21 risers of 176mm, tread 300mm	going 6000mm	/B1/st
L1→R	lift	EV	/L1/ev
```

列はタブ区切りで、装置によって長さが変わる。

| 列 | 中身 |
|---|---|
| 1 | `<下のレベル>→<上のレベル>`。上が無ければ下のレベル名だけ |
| 2 | 装置 — `stair` / `ramp` / `escalator` / `lift` |
| 3 | 表示名 |
| 4 | `rise <数>mm` — 上る高さ |
| 5 | `return` (折り返す) か `straight` (直線) |
| 6 | 階段なら `<段数> risers of <蹴上>mm, tread <踏面>mm`、斜路とエスカレーターなら `slope 1/<数>` |
| 7 | `going <数>mm` — 走り長 |
| 8 | 空間のパス |

**`lift` だけは列が二つで終わる。**昇降機には段も勾配も走り長も無いので、装置名と表示名の後は直接パスが来る。

```text
B2→B1	lift	EV	/B2/ev
```

エスカレーターは階段ではなく勾配で報告される。

```sh
npx tsx src/cli.ts runs examples/complex/main.muro
```

```text
L1→L2	escalator	エスカレーター	rise 6600mm	straight	slope 1/1.5	going 9800mm	/L1/es
```

(この建物の全出力の一部である。)

## 縦動線が無いとき

`stair` / `ramp` / `escalator` / `lift` のどれも宣言されていなければ、その旨が出る。

```sh
npx tsx src/cli.ts runs examples/two-rooms.muro
```

```text
There is no vertical circulation (write stair:N / ramp:N / escalator:N / lift:1 on a space)
```

**階段の境界 (`boundary /a /b type:stair`) を書いただけでは、ここには何も出ない。**境界の種別は「二つの空間が階段で繋がっている」という関係であって、階段そのものの形ではない。形が要るなら、階段室の空間に `stair:<上る向き>` を書く。`examples/house` は前者だけを持つので、`runs` は上の一行を返す。

## 導出であることの帰結

同じ階段室でも階高が違えば段割りが変わる。書き分けはどこにも無い — **階高を変えれば段数が変わるのが導出である。**上の `examples/basement` では B2→B1 と B1→L1 がどちらも `rise 3700mm` なので同じ 21 段になっているが、階高の違う建物では同じ階段室が階ごとに別の段割りを持つ。

**導いた結果が登りやすい寸法かどうかは、ここでは言わない。**形が一意に決まるかは [`koyu check`](check.md) の仕事で、段が窮屈でないか・勾配が常用域に収まっているかは [`koyu validate`](validate.md) の `stair.proportion` と `run.slope` が言う。

## 終了コード

| 終了コード | 意味 |
|---|---|
| 0 | 常に — **縦動線が一つも無いときも 0 である** |
| 1 | 構文・合成エラーで読めなかった |
| 2 | ファイルパスを渡していない (使い方が印字される) |

縦動線が無いことを「合格」と読まないこと。`stair:` を書き忘れても同じ出力になる。

## 関連

- [koyu validate](validate.md) — 段の窮屈さと勾配の判定 (`stair.proportion` / `run.slope`)
- [koyu check](check.md) — 縦動線の形が一意に決まるかの診断
- [koyu axo](axo.md) — 導出された縦動線を立体で見る
- [.muro リファレンス](../muro/index.md) — `stair` `ramp` `escalator` `lift` の書き方
