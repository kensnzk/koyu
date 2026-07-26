# koyu eval — 記法の編集可能性を測る基準台

`.muro` で書かれた建物を **LLMエージェントがどれだけ正しく編集できるか** を測る harness である。
測るのはモデルの賢さではなく、**記法**である。

---

## 1. なぜ在るのか

> 目的は、記法が変わる**前**に、いまの記法 (0.2) の数字を取ることである。
> 0.3 は導出位置 (derived positions) を導入する。記法の変更がエージェントの成功率に
> どう効いたかは、前後の比較でしか測れない。したがって**再走行性がこの harness の存在理由**である。

0.2 の測定では、空間の水平位置は **279 個の通り参照のうち導出ゼロ** — 174 の領域つき空間すべてが
自分の位置を書いている。0.3 はここを変える。だから比較対象は「空間の水平位置」であって
「開口の位置」ではない (開口の境界上位置は 0.2 で既に 63.6% が中央寄せの導出である)。
この区別は before/after を読み違えないために書き留めておく。

再走行性のために守っていること:

- 課題は JSON の宣言である。オラクルはコードではなく課題ファイルに書く。
- 採点器は CLI を叩かず公開API (`src/index.ts` / `src/parse-file.ts`) を直に呼ぶ。
  CLI 経由では終了コードという一次元の情報しか取れず「どのオラクルが落ちたか」が消える。
- 走行の記録は `eval/results/records.jsonl` に追記される。報告書はそこから何度でも作り直せる。
- 作業は必ず OS の一時ディレクトリで行う。`examples/` を含むリポジトリ内へは一切書かない
  (`run.ts` が門番として拒否する)。

---

## 2. 見出しの数字 — 「check は緑だが意味が誤り」

本 harness で最も重要な単一の指標である。

> **`check` は通ったのに、他のオラクルが落ちた走行の数。**

整合検査を通過したのに意図が実現していない編集の割合であり、これが高いほど記法は
「機械には正しく見えるが人の意図から外れた」編集を許していることになる。
報告書は素の率 (全走行に対する割合) と条件付きの率 (`check` が緑だった走行のうちの割合) の
両方を出す。後者は **`check` を単一の報酬に据えた場合の報酬ハック率の見積り**でもある。

0.2 の tower で実測した「check 緑 × 意味が誤り」の実例 (変異プローブ):

| 変異 | check | 捕まえたオラクル |
|---|---|---|
| A住戸の玄関ドアを削除 | ✅ 緑 | `doors` だけ (到達不能になる) |
| B住戸の窓を1枚削除 | ✅ 緑 | `light` だけ (B は余裕 1.48% しかない) |
| 洋室2の type を `bedroom`→`stor` | ✅ 緑 | どれも捕まえない → `diff` が要る |
| 部屋を 400mm に縮め、孤児になった境界宣言も削除 | ✅ 緑 | 面積系 (`assert` / `diff`) だけ |

最後の一行が、この harness が存在する理由そのものである。

---

## 3. なぜオラクルは複数でなければならないか

床平面の RLVR に関する研究 (arXiv 2605.14117) が報告したとおり、**単一の報酬は報酬ハックを招く**。
一つの制約だけを満たせばよいなら、モデルは部屋をゼロまで縮める。

koyu でも同じことが起きる。実測:

- **`check` 単独は止められない。** 部屋を縮めるだけなら `BND04 接していないため境界を導けません` で
  捕まるが、縮めた上で孤児になった境界宣言も消せば `check` は完全に緑になる。
- **`light` (採光) は縮小に対して逆向きに動く。** 床が減れば必要窓面積も減るので、
  部屋を 400mm に縮めても不合格は増えない。**採光を単独の報酬に据えると「部屋を縮める」が最適解になる。**
  必ず面積オラクルと対にすること。
- **`light` は「居室の取り下げ」で母集団ごと逃げられる。** `daylight` が見るのは `daylight:1` を
  書いた室だけである ([ADR-0020](../docs/decisions/0020-daylight-scope-is-declared.md))。落ちそうな室から
  `daylight:1` を消すと、その室は評価対象から外れ、`light` は残った室だけを見て緑になる。`score.ts` は
  「評価対象が0室」の真空の真だけは落とすが、**部分的に母集団を削る形は素通りする** (T03 の設計中に
  実測で見つけた穴。当時は型の付け替えが同じ逃げ道で、参照解の `/Ln/B{1,2}/ldk` を `stor` に変えるだけで
  10 オラクル全てが緑になった。ADR-0020 で入口が `daylight` 一つに畳まれ、逃げ道も一つに畳まれたが、塞がってはいない)。

したがって規則は機械で守る:

> **すべての課題は最低2つのオラクルを持たねばならない。**
> `score.ts` の `validateTask` がこれを検査し、1つしかない課題は実行を拒否する (終了コード 2)。

そして「明白な近道がどれかで必ず落ちる」ように組を選ぶ。課題ファイルの `notes` には
**どの報酬ハックをどのオラクルが塞ぐか**を書く。

> **`light` を使う課題の追加規則:** どの室が居室として評価されるかを別の `assert` で必ず固定すること。
> `daylight(m).length` を数える (T02 / T04 / T05 は 66 で固定) か、対象の室の `type` を名指しで
> 縛る (T03 は 8 層 × B1・B2 が `ldk`/`wet`/`hall` の 3 室ちょうどであることを縛る)。
> これが無い `light` は「型を付け替えれば消える」オラクルであり、第二オラクルとして数えてはならない。

### オラクルの感度 (実測)

| オラクル | 面積 | 位置 | 扉 | 窓 | type/属性 |
|---|---|---|---|---|---|
| `check` | △ 孤児境界を消されると盲目 | ◎ | ✕ | ✕ | ✕ |
| `assert` (面積) | ◎ | △ | ✕ | ✕ | ✕ |
| `light` | ◎ (逆向きにも動く) | ◎ | ✕ | ◎ | △ |
| `doors` | ✕ | △ | ◎ | ✕ | ✕ |
| `diff` (semantic) | ◎ | ◎ | ◎ | ◎ | ◎ |
| `site` | ✕ | ✕ | ✕ | ✕ | ✕ |

**`site` を第二オラクルの主役にしてはならない。** `derivedArea` は polygon 宣言があるとき
polygon からのみ導かれるので、上階をどう壊しても 1097.8 のまま動かない。`footprint` も L1 の
水平投影に支配され、L5 を丸ごと壊しても 569.6 のまま。`site` が意味を持つのは
`site.muro` / `site-geometry.muro` を触る課題だけである。
(なお `SiteReport` に `areaMatch` / `coverage` / `FAR` のフィールドは無い。
`score.ts` の `siteMetrics` が `src/mcp.ts` と同じ式・同じ丸めで計算している。)

---

## 4. 課題ファイルの形式 (規範)

`eval/tasks/<id>.json`。`run.ts` / `score.ts` とこの形式は必ず一致していること。

```json
{
  "id": "T02-widen-bed1",
  "class": { "op": "update", "kind": "spatial" },
  "fixture": "examples/tower",
  "entry": "main.muro",
  "instruction": "…エージェントに逐語で与える日本語の指示…",
  "oracles": [
    { "kind": "check", "strict": true },
    { "kind": "light" },
    { "kind": "doors", "from": "/L9/A/ldk", "to": "/out/road-s", "max": 4 },
    { "kind": "site" },
    { "kind": "assert", "expr": "zoneAreaM2(m, '/L5/A') === 61.44", "label": "…" },
    { "kind": "diff", "expected": "expected/T0X.muro" }
  ],
  "notes": "なぜこの組か / どの報酬ハックをどれが塞ぐか"
}
```

- `class` は BIM-Edit (arXiv 2606.20146) の分類を借りる。`op` = `create|update|delete`、
  `kind` = `direct|spatial|topological`。
- `fixture` はリポジトリ相対のディレクトリ。`""` なら空の作業ディレクトリから作らせる。
- `entry` は作業コピーの中の入口ファイル。

### オラクルの意味

| kind | 合格条件 |
|---|---|
| `check` | `checkDiagnostics(m)` に `severity==="error"` が無い。`strict:true` なら warning も無い |
| `light` | `daylight(m)` の全居室が合格。**評価対象が0室なら不合格** (居室を全部消す真空の真を塞ぐ) |
| `doors` | `doorsBetween(m, from, to)` が存在し、扉数が `max` 以下 (`min` があればそれ以上) |
| `site` | `siteReport(m)` から導いた `areaMatch` が true |
| `assert` | JS 式を `m` と補助関数を束ねて評価し、結果が厳密に `true` |
| `diff` | `semanticDiff(built, expected)` が空 |

省略可の拡張:

- `doors` の `path` (経路の完全一致) と `via` (必ず通る節点)。
  **扉数だけでは足りない** — tower では `/out/road-s` へも `/out/road-e` へも同じ枚数になるので、
  道路を取り違えても数字が変わらない。経路も見ること。
- 全オラクル共通の `label` (表に出る名)。
- `diff` の `expected` は**課題ファイルからの相対**で解決される。作業ディレクトリ基準にはしない —
  被験エージェントが正解ファイルを書き換えられてしまうからである。

### `assert` の scope

規範の5引数が先頭に来る: `m`, `zoneAreaM2`, `daylight`, `doorsBetween`, `siteReport`。
その後ろに実測で必要になった補助が続く:

`areaM2`, `areaOf`, `unionAreaM2`, `checkDiagnostics`, `siteMetrics`, `semanticDiff`, `renderDiff`, `parse`, `toCanonical`

`eval/` は内部専用の道具であり、課題ファイルはリポジトリ内で人が書いたものだけを読むので
`new Function` による任意コード実行を許容している。外部入力は通さない。

> ⚠ **最大の落とし穴 — `zone` と `space` の混在**
> tower の `/L5/A` は **zone**、`/L5/B`〜`/L5/F` は **space** である
> (`typical.muro` が粒度の混在を実演している — ADR-0005)。
> したがって `zoneAreaM2(m, "/L5/B")` は **0 を返す**。B〜F の面積は `areaM2(m.spaces.get("/L5/B"))` で取る。
> どちらでも動く糖衣として `areaOf(m, path)` を用意してある。**迷ったら `areaOf` を使うこと。**

> ⚠ **診断の件数は倍になる**
> `typical.muro` の 1 行は 7〜8 レベルへ展開される (space 3.07x / boundary 3.33x)。
> 部屋を一つ縮めただけで診断が 24 件出る。**`errors.length` を assert するなら「0 か非0か」に留める**か、
> `checkDiagnostics(m).some(d => d.code === "BND04")` のようにコードで見ること。

---

## 5. 走らせ方 (通し)

最初の基準測定は**人が動かす**。`run.ts` はエージェントを駆動しない。
被験系は Claude Code が MCP サーバ越しに一課題ずつ編集する形をとる。

```bash
# ① 作業ディレクトリを用意する (fixture を OS の一時ディレクトリへ複製し、パスを標準出力に出す)
WORK=$(npx tsx eval/run.ts prepare T02-widen-bed1)
echo $WORK
# 課題の指示は標準エラーへ出る。それを逐語でエージェントに与える。

# ② ここで人がエージェントを走らせる。エージェントは $WORK の中だけを編集する。
#    走行中に数えておくもの: tool呼び出し回数 / ターン数 / 消費トークン

# ③ 採点して記録する
npx tsx eval/run.ts score T02-widen-bed1 "$WORK" \
  --tool-calls 14 --tokens 52000 --turns 5 --agent "claude-code+mcp" \
  --notes "L3 のテラスに気づかず 8 レベル分まとめて編集した"

# ④ 記録から報告書を書き出す
npx tsx eval/run.ts report baseline-0.2 --latest
# → eval/results/baseline-0.2.md  (人が読む表)
#    eval/results/baseline-0.2.json (機械可読)
```

採点器だけを単体で回すこともできる:

```bash
npx tsx eval/score.ts eval/tasks/T02-widen-bed1.json "$WORK" [--json]
# 終了コード 0=全オラクル通過 / 1=不合格 / 2=使い方の誤り・課題定義の不備
```

### 人・エージェントしか知らない値の渡し方

`--tool-calls` `--tokens` `--turns` `--fail-class` `--agent` `--notes` を直接渡すか、
小さな JSON を `--meta` で渡す (個別フラグが優先される):

```json
{ "toolCalls": 14, "tokens": 52000, "turns": 5, "agent": "claude-code+mcp", "notes": "…" }
```

`--dry-run` を付けると採点だけして記録しない。`--json` で記録そのものを標準出力へ出す。

### 記録される項目

`ts` / `taskId` / `class` / `languageVersion` / `workdir` / `success` / `failureClass` /
オラクルごとの合否と説明 / `passed` / `total` / `checkGreen` / `checkGreenMeaningWrong` /
`diffLines` / `toolCalls` / `tokens` / `turns` / `agent` / `notes`

`diffLines` は**出発状態に対する `koyu diff` の行数**である。`prepare` は作業ディレクトリの隣に
出発状態の無傷の写しを隠して置き (`<root>/.base`、エージェントには見えない)、
採点時に `renderDiff(semanticDiff(base, after))` の行数を数える。
`prepare` を通さず手で作った作業ディレクトリでは `null` になる。

---

## 6. 失敗の分類

| 種別 | 意味 | 誰が判定するか |
|---|---|---|
| `syntax` | 一行の文法違反で合成できない | 自動 |
| `compose` | 層の重ね合わせで失敗 (import・パス/アセット/通りの衝突・版宣言の場所) | 自動 |
| `semantic` | 合成はできたがオラクルが落ちた | 自動 |
| `incomplete` | 途中で止まった・指示の一部しかやらなかった | 原則は人 (`--fail-class incomplete`)。ただし**入口ファイルすら無い**場合だけは自動 |
| `offtrack` | 指示と別のことをした | 人 (`--fail-class offtrack`) |

**合成できないことはオラクルの不合格ではない。** 別の結末として扱い、
`score.ts` はその場合オラクルを一つも回さず失敗種別だけを返す (例外では落ちない)。
入口ファイルが存在しないことは「重ね合わせの失敗」ではなく「何も出て来なかった」なので
`compose` ではなく `incomplete` に落とす — T06 のように白紙から書かせる課題で被験系が
一行も書かなかった場合がこれにあたる。`offtrack` と、それ以外の `incomplete` は
人にしか言えないので `--fail-class` で自動判定を上書きする。

---

## 7. BIM-Edit との比較

課題の分類は BIM-Edit (arXiv 2606.20146) から借りている。同論文は Gemini 3.0 Flash を
**部分点 49.48% / 完全正解 3.4% 未満**と報告している。koyu の数字も比較可能な形で並べる:

| 系 | 部分点 (オラクル単位) | 完全正解 (全オラクル通過) |
|---|---|---|
| Gemini 3.0 Flash (BIM-Edit 報告値) | 49.48% | <3.4% |
| koyu 0.2 (本 harness) | 報告書が出す | 報告書が出す |

課題数も操作の粒度もオラクルの厳しさも異なるため、直接の優劣は読めない。
**形を揃えて並べることだけが目的である。**

---

## 8. ファイル

| パス | 役割 |
|---|---|
| `eval/score.ts` | 採点器。課題1件 × 作業ディレクトリ1件 → オラクル別の合否。`scoreTask()` を公開 |
| `eval/run.ts` | 走行係。(a) fixture の複製 (b) オラクル実行 (c) 結果の記録 の三つだけ |
| `eval/tasks/*.json` | 課題定義 (6件) |
| `eval/fixtures/tower-uid/` | `examples/tower` の複製 + 48 個の `uid`。T05 (改名) 専用 |
| `eval/results/` | 走行記録と報告書。形式は `eval/results/README.md` |

依存は増やしていない。`tsx` (既存の devDependency) と node 標準モジュールだけで動く。
`src/` 以下は一切変更していない。

### 課題一覧

| id | op / kind | fixture | オラクル数 | 主眼 |
|---|---|---|---|---|
| `T01-floor-material` | update / direct | `examples/tower` | 6 | 属性1つの書き換えが8層へ波及する |
| `T02-widen-bed1` | update / spatial | `examples/tower` | 7 | 領域を動かすと幾何・採光・開口の指定が同時に動く |
| `T03-split-B` | create / topological | `examples/tower` | 10 | 住戸の分割。6課題で最難 |
| `T04-remove-balcony` | delete / direct | `examples/tower` | 6 | 消し残しと消しすぎ。**採光は落ちるのが正解** |
| `T05-rename-A` | update / direct | `eval/fixtures/tower-uid` | 8 | 改名。同一性は `uid` が担保する (ADR-0015) |
| `T06-generate-two-rooms` | create / direct | `""` (白紙) | 5 | 記法そのものが書けるか — 他5課題の基準線 |

6課題すべてについて参照解を書いて全オラクル通過を確認してある (`notes` に参照解の要点が入っている)。
無編集のフィクスチャでは、`check` は緑のまま課題固有のオラクルが必ず 2 つ以上落ちる —
「課題が本当に未達であること」と「フィクスチャが健全であること」を同時に確かめるための性質である。
