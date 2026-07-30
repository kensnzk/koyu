---
title: 確かめる — check / validate
mode: reference
---

# 確かめる — check / validate

編集のあとに呼ぶ二つ。**この二つは別のことを言う。**

- [`check`](#check) — 書かれたものがデータとして矛盾していないか。**門番。**
- [`validate`](#validate) — 建築として妥当か。**judgement であって門番ではない。**

型からして別である。`check` の診断は `{code, severity}`、`validate` の判定は `{rule, level}` で、綴りも違えば連結もできない。**`check` が緑であることを根拠に「建物が動く」と主張しない。**

この頁の出力はすべて実際に走らせて得たものである。絶対パスは `<abs>` に縮めてある。

---

## check

> The gatekeeper of the build: composes the layers and checks structural consistency. Errors and warnings carry layer:line. Call it after every edit. **This says nothing about architectural soundness** — that is the validate tool

`file` のみ、必須。**編集のたびに呼ぶ。**

### 緑のとき

```text
{
 "ok": true,
 "spaces": 3,
 "boundaries": 3,
 "errors": [],
 "warnings": [],
 "diagnostics": []
}
```

| フィールド | 中身 |
|---|---|
| `ok` | `errors` が空か。**`warnings` は `ok` を落とさない** |
| `spaces` | 合成後の空間数 |
| `boundaries` | **導出後**の境界の本数 |
| `errors` `warnings` | 出所つきの文字列の配列 |
| `diagnostics` | 構造化診断の配列。**`errors` と `warnings` を足したものと同件。**並びは走査の順で、`errors` / `warnings` はそれを severity で二本に割ったものなので、**連結して添字で対応させてはならない** |

**警告で止めたいなら自分で見る。**CLI の `--strict` に当たる旗はここに無い。`warnings.length` を読んで判断する。

### 警告があるとき

```muro-warn
koyu 1.0
name 警告
unit mm
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out exterior name:外部
```

```text
{
 "ok": true,
 "spaces": 3,
 "boundaries": 1,
 "errors": [],
 "warnings": [
  "<abs>/warn.muro:line 6: Level L1 has no slab:, so not one floor is generated on this storey"
 ],
 "diagnostics": [
  {
   "code": "SUF03",
   "severity": "warning",
   "message": "Level L1 has no slab:, so not one floor is generated on this storey",
   "line": 6,
   "file": "<abs>/warn.muro"
  }
 ]
}
```

`ok` は `true` のままである。

### エラーがあるとき

```muro-bad
koyu 1.0
name 二重宣言
unit mm
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out exterior name:外部
boundary /L1/a /L1/b t:120
boundary /L1/a /L1/b t:150
```

```text
{
 "ok": false,
 "spaces": 3,
 "boundaries": 2,
 "errors": [
  "<abs>/dup.muro:line 11: Duplicate boundary: /L1/a | /L1/b (first seen at <abs>/dup.muro:line 10)"
 ],
 "warnings": [],
 "diagnostics": [
  {
   "code": "BND02",
   "severity": "error",
   "message": "Duplicate boundary: /L1/a | /L1/b (first seen at <abs>/dup.muro:line 10)",
   "line": 11,
   "file": "<abs>/dup.muro",
   "path": [
    "/L1/a",
    "/L1/b"
   ],
   "related": [
    {
     "line": 10,
     "file": "<abs>/dup.muro"
    }
   ]
  }
 ]
}
```

**`errors` の文字列と `diagnostics` の項は同じものを指す。**前者は位置を本文の頭に貼り付けた人向けの形、後者は機械が読む形である。`errors` と `warnings` を合わせたものが `diagnostics` と同件で、`diagnostics` は走査の順に並ぶ — この例のように警告が無いときだけ、`errors` の並びが `diagnostics` の並びと一致する。**エージェントは `diagnostics` を読む。**

### 診断の形

| フィールド | いつ出るか | 中身 |
|---|---|---|
| `code` | 常に | 三文字 + 二桁。全部で 65 個 |
| `severity` | 常に | `"error"` または `"warning"` |
| `message` | 常に | 本文だけ。**位置の接頭辞は付かない** |
| `line` | 出所が判るとき | 1 始まりの行番号 |
| `file` | 出所が判るとき | 宣言があった層の絶対パス |
| `path` | 対象が空間・ゾーンのとき | 対象のパスの配列 |
| `related` | 相手のある診断のとき | もう一方の出所 `{line, file}` の配列 |

**`severity` はコードの属性である。**同じコードが場合によって `error` になったり `warning` になったりはしない。コードから原因と直し方を引く表は[診断コード](../diagnostics/index.md)にある。

**並びは走査の順である。**コードの族でまとめ直したりはしない。同じモデルからは常に同じ並びが返る。

### 構文・合成エラーはここに来ない

**ファイルが読めない、構文が壊れている、合成が成立しない — このときは `check` の返りが返らない。**ツールが例外を投げた扱いになり、`isError: true` の付いた結果としてメッセージだけが返る。

```text
<abs>/bad.muro:line 8: The region has zero width
```

**[`koyu check --json`](../cli/check.md) との違いである。**CLI はこれを `SYN01` の診断一件に写して有効な JSON を返すが、MCP では `diagnostics` の配列が返らない。エージェントは `isError` を見て、返ってきた一行を読んで直す。詳しくは[プロトコル](protocol.md)にある。

### check が言わないこと

`check` が保証するのは「書かれたものがデータとして矛盾していない」までである。**建物として使えるかは一言も見ていない。**

接する空間の既定は壁で、壁は扉が無ければ通れない。だから扉を一枚も書かない建物は、完全に密封されたまま `check` が緑になる。

```muro-fail
koyu 1.0
name 密封
unit mm
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居室A daylight:1
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out exterior name:外部
```

```text
{
 "ok": true,
 "spaces": 3,
 "boundaries": 1,
 "errors": [],
 "warnings": [],
 "diagnostics": []
}
```

同じファイルを `validate` に渡すと三つの違反が出る。

---

## validate

> Architectural verdicts: daylight, envelope continuity, stair proportions, slopes, reachability, column/door collisions, and the site. **This is a different surface from the check guarantee** — findings carry rule/level, never code/severity. The surface grows and is not frozen

`file` のみ、必須。上の密封された建物に掛けるとこうなる。

```text
{
 "findings": [
  {
   "rule": "daylight.ratio",
   "level": "violation",
   "message": "Insufficient daylight: /L1/a — effective window 0.00 m2 < required 2.31 m2 (1/7 of the 16.20 m2 floor)",
   "line": 7,
   "file": "<abs>/sealed.muro",
   "path": [
    "/L1/a"
   ]
  },
  {
   "rule": "access.unreachable",
   "level": "violation",
   "message": "Cannot reach the exterior: /L1/a (no passable boundary leads out — write a door)",
   "line": 7,
   "file": "<abs>/sealed.muro",
   "path": [
    "/L1/a"
   ]
  },
  {
   "rule": "access.unreachable",
   "level": "violation",
   "message": "Cannot reach the exterior: /L1/b (no passable boundary leads out — write a door)",
   "line": 8,
   "file": "<abs>/sealed.muro",
   "path": [
    "/L1/b"
   ]
  }
 ],
 "violations": 3,
 "cautions": 0,
 "note": "These are verdicts, not the structural-consistency guarantee of koyu check"
}
```

| フィールド | 中身 |
|---|---|
| `findings` | 判定の配列 |
| `violations` | `level` が `"violation"` の件数 |
| `cautions` | `level` が `"caution"` の件数 |
| `note` | 固定文。`check` の保証ではないことを言う |

**`ok` は返らない。**合否をこのツールは名乗らない。件数を見て判断するのは呼び手である。

### 判定の形

| フィールド | いつ出るか | 中身 |
|---|---|---|
| `rule` | 常に | 規則名。`daylight.ratio` のように `族.名` である |
| `level` | 常に | `"violation"` (守られなかった) または `"caution"` (疑わしい) |
| `message` | 常に | 本文だけ。位置の接頭辞は付かない |
| `line` `file` | 出所が判るとき | 宣言があった行と層 |
| `path` | 対象が判るとき | 対象のパスの配列 |

**`level` は規則の属性である。**同じ規則が場合によって重くなったり軽くなったりはしない。

`violation` と `caution` は一つの応答に混ざる。

```muro-caution
koyu 1.0
name 窓の高さ
unit mm
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居室A daylight:1
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out exterior name:外部
boundary /L1/a /L1/b t:120
  door w:780 h:2000
boundary /L1/a /out t:150
  window w:2600 edge:S name:腰窓
boundary /L1/b /out t:150
  door w:900 h:2100 edge:S name:玄関
```

```text
{
 "findings": [
  {
   "rule": "daylight.ratio",
   "level": "violation",
   "message": "Insufficient daylight: /L1/a — effective window 0.00 m2 < required 2.31 m2 (1/7 of the 16.20 m2 floor)",
   "line": 7,
   "file": "<abs>/win.muro",
   "path": [
    "/L1/a"
   ]
  },
  {
   "rule": "daylight.unknown",
   "level": "caution",
   "message": "Window area is not fully counted: /L1/a has a window without h: (write h: on it)",
   "line": 7,
   "file": "<abs>/win.muro",
   "path": [
    "/L1/a"
   ]
  }
 ],
 "violations": 1,
 "cautions": 1,
 "note": "These are verdicts, not the structural-consistency guarantee of koyu check"
}
```

窓に `h:` が無いので有効窓面積が数え切れておらず (`caution`)、数え切れた分では 1/7 に届いていない (`violation`)。**二つは同時に出る。**

### 返りうる規則

15 個ある。`level` は規則ごとに固定である。

| 規則 | `level` | 何を見るか |
|---|---|---|
| `daylight.ratio` | violation | 有効窓面積が床面積の 1/7 に届かない |
| `daylight.unknown` | caution | `h:` の無い窓があり、窓面積を数え切れていない |
| `envelope.gap` | caution | 外皮に穴 — 何にも面していない外周がある |
| `stair.proportion` | caution | 導出された段が窮屈 |
| `run.slope` | caution | 導出された勾配が急すぎる・常用域の外 |
| `run.disconnected` | caution | 縦動線の形はあるが上下を繋ぐ垂直境界が無い |
| `access.unreachable` | violation | 領域を持つ室から外部へ辿り着けない |
| `access.voidonly` | violation | 扉が吹抜けにしか開いていない |
| `access.throughtenant` | caution | 階段室からの避難が賃貸区画を通る |
| `access.parking` | violation | 駐車場から車が出られない |
| `access.backofhouse` | caution | 共用廊下からバックヤードを通らずに縦動線へ届かない |
| `column.blocksdoor` | violation | 導出された柱が導出された扉と重なる |
| `site.escape` | violation | 建物が敷地形状からはみ出す |
| `site.area` | caution | 敷地面積の宣言と導出が食い違う |
| `site.frontage` | violation | 接道長が 2m 未満 |

一件ずつの詳しい読み方と直し方は[判定 — koyu validate](../validate/index.md) にある。

### この面は増える

**`validate` の規則は凍っていない。**規則は足されるし、捨てられることもある。`check` の 65 の診断コードとは扱いが違う — あちらは凍る面である。

だから、判定の件数を CI の門にするなら、**足された規則で赤くなることを受け入れる**か、規則名で絞る。

## 関連

- [書く — write_layer / new_uids](tools-write.md) — `write_layer` の返りに載る `check`
- [問う — doors / light / site / plan_svg](tools-ask.md) — 判定ではなく数を返す面
- [プロトコル](protocol.md) — 構文エラーが `isError` で返る理由
- [診断コード](../diagnostics/index.md) — 65 コードの原因と直し方
- [判定 — koyu validate](../validate/index.md) — 15 規則の詳しい読み方
- [koyu check](../cli/check.md) — CLI 側の `--json` と `--strict`
