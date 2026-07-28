---
title: koyu validate
mode: reference
---

# koyu validate

建築の側の判断を回す。採光・到達可能性・外皮の連続・階段の寸法・敷地の数字 — **`koyu check` が保証しないことを、別の名前と別の型で言う。**

## 引数

```text
koyu validate <entry.muro> [--json]
```

entry のパスを一つ取る。

## 旗

| 旗 | 効果 |
|---|---|
| `--json` | 判定を `Finding[]` の JSON で標準出力に書く |

## 出力

何も引っ掛からなければ一行だけ出る。

```sh
npx tsx src/cli.ts validate examples/house/main.muro
```

```text
✔ Nothing caught by validation (this is a judgement, not a guarantee about the composition)
```

引っ掛かれば一件ずつ並び、最後に件数が出る。`✖` が違反 (violation)、`⚠` が疑い (caution) である。

```sh
npx tsx src/cli.ts validate sealed.muro
```

```text
✖ [daylight.ratio] <absolute path>/sealed.muro:line 7: Insufficient daylight: /L1/a — effective window 0.00 m2 < required 2.31 m2 (1/7 of the 16.20 m2 floor)
✖ [access.unreachable] <absolute path>/sealed.muro:line 7: Cannot reach the exterior: /L1/a (no passable boundary leads out — write a door)
✖ [access.unreachable] <absolute path>/sealed.muro:line 8: Cannot reach the exterior: /L1/b (no passable boundary leads out — write a door)
Validation — 3 violations / 0 cautions
```

この `sealed.muro` は [`koyu check`](check.md) が緑を返すファイルである。二つのコマンドは違うことを見ている。

角括弧の中が規則名で、続く `<解決済みの絶対パス>:line <行>:` が出所である。出所を持たない判定では位置の接頭辞が付かない。

## --json のかたち

```sh
npx tsx src/cli.ts validate caution.muro --json
```

```text
[
 {
  "rule": "envelope.gap",
  "level": "caution",
  "message": "Perimeter not faced by any envelope: /L1/a — S 3600mm / N 3600mm / W 4500mm (11700mm over 3 run(s)). Write a boundary to the exterior",
  "line": 7,
  "file": "<absolute path>/caution.muro",
  "path": [
   "/L1/a"
  ]
 }
]
```

フィールドは `rule` `level` `message` が必ずあり、`line` `file` `path` は持つときだけ出る。

**`level` は規則の不変属性である。**同じ規則が場合によって違反になったり疑いになったりはしない。

## 判定の 15 規則

| 規則 | level | 何を言うか |
|---|---|---|
| `envelope.gap` | caution | 外皮に穴がある — 何にも面していない外周がある |
| `daylight.ratio` | violation | 有効窓面積が床面積の 1/7 に満たない |
| `daylight.unknown` | caution | `h` を持たない窓があり、窓面積を数え切れていない |
| `stair.proportion` | caution | 導出された段が窮屈 (踏面 240mm 未満、または 2R+T が 550〜700 の外) |
| `run.slope` | caution | 導出された勾配が宣言より急、あるいは常用域の外 |
| `run.disconnected` | caution | 縦動線の形はあるが、上下を繋ぐ垂直境界が無い |
| `access.unreachable` | violation | 領域を持つ室から外部へ辿り着けない |
| `access.voidonly` | violation | 扉が吹抜け (床の無い所) にしか開いていない |
| `access.throughtenant` | caution | 階段室からの避難が賃貸区画を通る |
| `access.parking` | violation | 駐車場から車が出られない |
| `access.backofhouse` | caution | 共用廊下からバックヤードを通らずに縦動線へ届かない |
| `column.blocksdoor` | violation | 導出された柱が導出された扉と重なる |
| `site.escape` | violation | 建物が敷地形状からはみ出す |
| `site.area` | caution | 敷地面積の宣言と導出が食い違う |
| `site.frontage` | violation | 接道長が 2m 未満 |

規則名は章 (`envelope` / `daylight` / `stair` / `run` / `access` / `column` / `site`) とその中の名でできている。章は管轄ではなく主題である。

並びは章の順で、章の中は走査の順である。

## 終了コード

| 終了コード | 意味 |
|---|---|
| 0 | 違反が無い — **疑い (caution) だけなら 0 である** |
| 1 | 違反 (violation) が一件以上ある |
| 2 | ファイルパスを渡していない (使い方が印字される) |

構文・合成エラーで読めなかったファイルは 1 で落ちる (`✖` の一行が標準エラーに出る)。`--json` はこの経路では有効な JSON を返さない — `check --json` の `SYN01` に写す仕組みは `validate` には無い。

疑いだけのときの終了コードを実際に見るとこうなる。

```sh
npx tsx src/cli.ts validate caution.muro
```

```text
⚠ [envelope.gap] <absolute path>/caution.muro:line 7: Perimeter not faced by any envelope: /L1/a — S 3600mm / N 3600mm / W 4500mm (11700mm over 3 run(s)). Write a boundary to the exterior
Validation — 0 violations / 1 caution
```

終了コードは 0 である。**CI で疑いも落としたいなら、`--json` を読んで自分で数える。**`check --strict` に当たる旗は `validate` には無い。

## check との違い

| | `koyu check` | `koyu validate` |
|---|---|---|
| 返す型 | `Diagnostic` | `Finding` |
| 名前 | `code` (`BND04` — 4文字+2桁) | `rule` (`envelope.gap` — 章と名) |
| 重さ | `severity`: `error` / `warning` | `level`: `violation` / `caution` |
| 数 | 65 コード | 15 規則 |
| 何を保証するか | 書かれたものがデータとして矛盾していない | **何も保証しない — 判断である** |
| 面としての性質 | 凍る。増減は言語の版を動かす | 凍らない。増やしてよいし捨ててよい |

フィールド名が違うので、二つの配列は取り違えようがない。連結しようとすれば型が落ちる。**「check の緑」と「validate の緑」を同じ言葉で語れないようにすることが、この分離の目的である。**

判定を足しても言語の版は動かない。`validate` の面は粗くてよく、管轄が一つしかなくてもよく、精度が足りなくてもよい — 値段が安いのは、凍らないからである。

## 関連

- [koyu check](check.md) — 構造整合の門番
- [判定の規則](../validate/index.md) — 15 規則の閾値と直し方
- [koyu light](light.md) — 採光の入力の数と 1/7 の判定を一覧で見る
- [koyu doors](doors.md) — 到達可能性を経路で確かめる
- [CI で門番にする](ci.md) — `check` だけの CI が見なくなるもの
