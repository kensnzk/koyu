---
title: CI で門番にする
mode: howto
---

# CI で門番にする

`.muro` を git に置いているなら、コミットのたびに koyu を回せる。ここでは**どのコマンドをどの終了コードで落とすか**を決める。

## check だけの CI は、判定を黙って見なくなる

最初に置きたくなるのはこれである。

```sh
koyu check building/main.muro
```

**これだけでは足りない。**`check` が保証するのは「書かれたものがデータとして矛盾していない」までで、建物として使えるかは一言も見ていない。

接する空間の既定は壁で、壁は扉が無ければ通れない。だから扉を一枚も書かない建物は、完全に密封されたまま `check` が緑になる。

```muro
koyu 1.0
name 密封
unit mm
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居室A daylight:1
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out name:外部 outside:1
```

```sh
npx tsx src/cli.ts check sealed.muro
```

```text
✔ Consistent — 3 spaces / 1 boundary
  Structural consistency only — architectural validity is what koyu validate says, separately
```

終了コード 0 である。同じファイルを [`koyu validate`](validate.md) に渡すとこうなる。

```sh
npx tsx src/cli.ts validate sealed.muro
```

```text
✖ [daylight.ratio] <absolute path>/sealed.muro:line 7: Insufficient daylight: /L1/a — effective window 0.00 m2 < required 2.31 m2 (1/7 of the 16.20 m2 floor)
✖ [access.unreachable] <absolute path>/sealed.muro:line 7: Cannot reach the exterior: /L1/a (no passable boundary leads out — write a door)
✖ [access.unreachable] <absolute path>/sealed.muro:line 8: Cannot reach the exterior: /L1/b (no passable boundary leads out — write a door)
Validation — 3 violations / 0 cautions
```

終了コード 1 である。**`check` だけを CI に置くと、この三件は永久に誰にも見られない。**

## 二本を並べる

最小の門番はこれである。

```sh
koyu check    building/main.muro --strict
koyu validate building/main.muro
```

`--strict` を付ける理由は、警告が緑のまま通り抜けるからである。「床が一枚も生成されない」「縦動線の形が生成されない」は警告なので、付けなければ終了コード 0 で通る。

```sh
npx tsx src/cli.ts check warn.muro
```

```text
⚠ <absolute path>/warn.muro:line 6: Level L1 has no slab:, so not one floor is generated on this storey
✔ Consistent — 3 spaces / 2 boundaries (1 warning)
  Structural consistency only — architectural validity is what koyu validate says, separately
```

終了コードは 0 で、`--strict` を付けると 1 になる。同じファイル、同じ警告、違う終了コードである。

## どのコマンドがどの終了コードで落ちるか

| コマンド | 0 | 1 | 2 | CI に置くか |
|---|---|---|---|---|
| [`check`](check.md) | エラーなし (`--strict` なら警告も) | エラー / 警告 (`--strict`) / 読めない | 引数不足 | **必ず。`--strict` 付き** |
| [`validate`](validate.md) | 違反なし (**疑いは 0 のまま**) | 違反あり / 読めない | 引数不足 | **必ず** |
| [`doors`](doors.md) | 到達できる | 到達できない | パスが二つ揃わない | 特定の避難経路を守りたいとき |
| [`light`](light.md) | 全室が 1/7 を満たす / **対象が無い** | 不足あり | 引数不足 | `validate` があれば不要 |
| [`site`](site.md) | 敷地レポートが出た | 敷地が無い | 引数不足 | 敷地の宣言を必須にしたいとき |
| [`levels`](levels.md) | 出せた | レベルが一つも無い | 引数不足 | ほぼ不要 (`check` が先に落ちる) |
| [`diff`](diff.md) | **差分なし** | **差分あり** | 入力が壊れている | 生成物の凍結を守りたいとき |
| [`plan`](plan.md) / [`axo`](axo.md) | 書き出した | 描けなかった | 未宣言のレベル名など | 図が生成できることを守りたいとき |
| [`graph`](graph.md) / [`stats`](stats.md) / [`runs`](runs.md) / [`layers`](layers.md) / [`json`](json.md) | 常に 0 | 読めない | 引数不足 | **門番にならない** — 合否を言わないコマンドである |

三つの落とし穴がある。

**`diff` の 0/1 は逆向きに読む。**`check` の 0 は「整合している」、`diff` の 0 は「同じ」である。`diff` を CI に置くのは「この生成物が変わっていないこと」を守りたいときで、意味が反転する。

**`light` は対象が無くても 0 を返す。**`daylight:1` を一つも書いていないモデルで `light` を CI に置くと、何も見ていないまま緑が返る。採光を守りたいなら `validate` を使うほうが安全である — `daylight.ratio` は違反として 1 を返す。

**`validate` は疑い (caution) では落ちない。**`envelope.gap` も `stair.proportion` も `site.area` も caution なので、終了コードは 0 のままである。疑いも落としたいなら `--json` を読んで自分で数える。

```sh
koyu validate building/main.muro --json | node -e '
  const f = JSON.parse(require("fs").readFileSync(0, "utf8"));
  if (f.length) { console.error(f.map(x => `${x.level} [${x.rule}] ${x.message}`).join("\n")); process.exit(1); }
'
```

## 複数の建物を回す

`.muro` の entry が複数あるなら、一つでも落ちたら止める。

```sh
for f in building/*/main.muro; do
  koyu check    "$f" --strict || exit 1
  koyu validate "$f"          || exit 1
done
```

シェルの `for` は最後のコマンドの終了コードしか返さないので、`|| exit 1` を各行に付ける。

## GitHub Actions に置く

```yaml
name: koyu
on: [push, pull_request]
jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: |
          for f in building/*/main.muro; do
            npx koyu check    "$f" --strict || exit 1
            npx koyu validate "$f"          || exit 1
          done
```

Node は 22 以上が要る。

## 落ちたときにコードを手に入れる

CI のログには人向けの出力が出る。**人向けの出力に診断コードは出ない。**コードから原因を引きたいなら `--json` を足す。

```sh
koyu check building/main.muro --json
```

```text
[
 {
  "code": "BND04",
  "severity": "error",
  "message": "The spaces do not touch, so no boundary can be derived: /L1/a | /L1/b",
  "line": 6,
  "file": "<absolute path>/bad.muro",
  "path": [
   "/L1/a",
   "/L1/b"
  ]
 }
]
```

構文エラーで読めなかったファイルも `--json` なら有効な JSON を返す (`SYN01` の一件に写される) ので、CI のログを機械で読む仕組みを作っても壊れない。

## 関連

- [koyu check](check.md) — `--strict` と `--json`
- [koyu validate](validate.md) — 15 規則と level
- [診断コード](../diagnostics/index.md) — 65 コードの原因と直し方
- [koyu コマンド](index.md) — 終了コードの共通の約束
