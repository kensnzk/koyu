# eval/results — 走行記録と報告書の形式

このディレクトリには **走行の生記録** と、そこから何度でも作り直せる **報告書** が入る。
0.3 (導出位置の導入) との before/after 比較がこの harness の存在理由なので、
**一次資料は `records.jsonl` であり、報告書は派生物である**。記録さえ残っていれば
集計の仕方を後から変えても基準は失われない。

| パス | 何か | 手で書き換えてよいか |
|---|---|---|
| `records.jsonl` | 走行ごとの一次記録 (追記のみ・1行1走行のJSON Lines) | ❌ 追記は `run.ts score` が行う |
| `<label>.md` | 人が読む報告書 | ❌ `run.ts report <label>` が上書きする |
| `<label>.json` | 同じ内容の機械可読版 (`records` を丸ごと同梱) | ❌ 同上 |
| `.gitkeep` | 空のディレクトリを版管理に残すための placeholder | — |
| `README.md` | この文書 | ⭕ |

```bash
npx tsx eval/run.ts score  <task-id> <workdir> [オプション]   # records.jsonl へ1行追記
npx tsx eval/run.ts report <label> [--latest]                 # <label>.md と <label>.json を書き出す
```

`--dry-run` を付けると採点だけして追記しない。`--latest` は課題ごとに最後の走行だけを残して
集計する (再走行を重ねた後に基準を一枚に畳むため)。`label` に使えるのは `[A-Za-z0-9._-]` だけである。

---

## 1. `records.jsonl` — 一次記録

1行 = 1走行。追記専用。行の順序は走行の順序であり、意味を持たない。

| フィールド | 型 | 意味 |
|---|---|---|
| `ts` | string | 採点した時刻 (ISO 8601, UTC) |
| `taskId` | string | 課題の `id` (`eval/tasks/<id>.json`) |
| `class` | `{op, kind}` | BIM-Edit (arXiv 2606.20146) の分類。`op` = `create\|update\|delete`、`kind` = `direct\|spatial\|topological` |
| `languageVersion` | string? | 合成できたモデルの `koyu` 版。**0.3 との before/after 比較の軸**。合成できなかった走行では欠落する |
| `workdir` | string | 採点した作業ディレクトリの実パス (一時ディレクトリなので後から消える。再現の手がかりとしてだけ残す) |
| `success` | boolean | 全オラクル通過 = 完全正解 |
| `failureClass` | string \| null | 下の §3。成功した走行は `null` |
| `oracles` | array | オラクルごとの `{kind, label, pass, detail}`。**順序は課題ファイルの `oracles` と同じ** |
| `passed` / `total` | number | 通過したオラクル数 / 全オラクル数。部分点の分子と分母 |
| `checkGreen` | boolean \| null | `check` オラクルが全て通ったか。課題が `check` を持たない、または合成できなかったときは `null` |
| `checkGreenMeaningWrong` | boolean | **見出しの数字**。`check` は緑なのに `check` 以外のオラクルが落ちた |
| `diffLines` | number \| null | 出発状態に対する `koyu diff` の行数 (§4) |
| `toolCalls` / `tokens` / `turns` | number \| null | 人が渡す値。harness からは見えない |
| `agent` | string \| null | 被験系の名 (例 `claude-code+mcp`) |
| `notes` | string \| null | 走行の所見 |

`oracles[].detail` は **人が読む一行**であり、機械の判定には使わない (`pass` が判定である)。
数字は丸めずに出してある — 再現の突き合わせに使うためであり、`1097.8` は `1097.80` ではない。

読み方の例:

```bash
# 完全正解の数
jq -s 'map(select(.success)) | length' eval/results/records.jsonl
# 「check は緑だが意味が誤り」の走行を並べる
jq -c 'select(.checkGreenMeaningWrong) | {taskId, passed, total}' eval/results/records.jsonl
# 落ちたオラクルだけを見る
jq -r '.oracles[] | select(.pass|not) | .label' eval/results/records.jsonl
```

---

## 2. `<label>.md` / `<label>.json` — 報告書

`.md` と `.json` は同じ集計の二つの姿である。`.json` は末尾に `records`
(集計に使った記録そのもの) を丸ごと抱えるので、**報告書1枚で再集計が完結する**。

`.json` の項目:

| フィールド | 意味 |
|---|---|
| `label` / `generatedAt` / `languageVersions` | 報告書の名前・生成時刻・記録に現れた言語版 |
| `runs` | 集計した走行数 |
| `fullCorrect` / `fullCorrectRate` | 完全正解 (全オラクル通過) の数と率 |
| `oraclePassed` / `oracleTotal` / `oracleRate` | オラクル単位の通過 = **部分点** |
| `checkGreenMeaningWrong` / `checkGreenMeaningWrongRate` | 見出しの数字と、全走行に対する率 |
| `checkGreenRuns` | `check` が緑だった走行数 |
| `checkGreenMeaningWrongConditionalRate` | 上のうち意味を外した割合 = **`check` を単一報酬に据えた場合の報酬ハック率の見積り** |
| `byClass` | `op/kind` ごとの `{runs, fullCorrect, checkGreenMeaningWrong}` |
| `byFailureClass` | 失敗種別ごとの件数 (5種すべてを 0 込みで出す) |
| `effort` | `toolCalls` / `tokens` / `turns` / `diffLines` の `{known, mean, median}` |
| `records` | 集計に使った `RunRecord` の配列 |

率は走行が 0 件のとき `null` になる (0除算を数字として出さない)。
`effort.known` は「その値が分かっている走行数」であり、`null` は平均・中央値から除かれている。

### 二つの率を取り違えないこと

- `checkGreenMeaningWrongRate` = 分母が**全走行**。合成すら失敗した走行も分母に入る。
- `checkGreenMeaningWrongConditionalRate` = 分母が **`check` が緑だった走行**。
  「整合検査を通った編集のうち、どれだけが意味を外していたか」であり、
  記法の良し悪しを版間で比べるときはこちらを見る。

### BIM-Edit と並べるときの注意

報告書は Gemini 3.0 Flash の報告値 (部分点 49.48% / 完全正解 3.4% 未満) を並べて出すが、
**課題数もオラクルの厳しさも異なるため直接の優劣は読めない**。形を揃えて並べることだけが目的である。
koyu 側の「部分点」はオラクル単位の通過率であって、BIM-Edit の部分点と同じ物差しではない。

---

## 3. 失敗種別 (`failureClass`)

| 種別 | 意味 | 誰が付けるか |
|---|---|---|
| `syntax` | 一行の文法違反で合成できない | 自動 |
| `compose` | 層の重ね合わせで失敗 (import・パス/アセット/通りの衝突・版宣言の場所) | 自動 |
| `semantic` | 合成はできたがオラクルが落ちた | 自動 |
| `incomplete` | 途中で止まった・指示の一部しかやらなかった | 原則は人 (`--fail-class incomplete`)。**入口ファイルすら無い**場合だけ自動 |
| `offtrack` | 指示と別のことをした | 人 (`--fail-class offtrack`) |

合成できなかった走行では `oracles` が空配列になり、`passed` は 0、`total` は課題のオラクル数のままである
(**分母は減らない** — 合成に失敗したことで部分点が上がってはならない)。
`--fail-class` を渡すと自動判定を上書きするが、**成功した走行には失敗種別を付けない**。

---

## 4. `diffLines` の意味

`prepare` は作業ディレクトリの隣に出発状態の無傷の写しを隠して置く
(`<root>/.base`。被験エージェントには見えない位置にある)。採点時に

```
renderDiff(semanticDiff(base, after)).length
```

を数えたものが `diffLines` である。**編集の大きさの粗い指標**であり、正しさの指標ではない。
次の場合は `null` になる:

- `prepare` を通さず手で作った作業ディレクトリ (`.base` が無い)
- `fixture: ""` の課題 (T06。出発状態が無いので全てが追加であり、行数が情報にならない)
- 編集後のモデルが合成できない

`typical.muro` の 1 行は 7〜8 レベルへ展開されるので、**1 行の編集でも `diffLines` は 8 になる**
(実測: T01 の参照解 = 8、T05 の参照解 = 48)。行数を「編集した行数」と読み違えないこと。

---

## 5. 版管理について

`records.jsonl` と報告書は**基準測定を実際に走らせたときに初めて生まれる**。
このリポジトリには `.gitkeep` とこの `README.md` だけを置いてある。
0.2 の基準を取り終えたら、その `records.jsonl` と `<label>.{md,json}` は
**0.3 との比較のために必ず版管理へ入れること** — 一時ディレクトリは消えるので、
記録が失われたらその測定は二度と再現できない。
