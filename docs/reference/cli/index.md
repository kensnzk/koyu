---
title: koyu コマンド
mode: reference
---

# koyu コマンド

`koyu` は `.muro` を一つ受け取り、合成し、問いに答える。14 のサブコマンドはすべて同じ導出を共有していて、CLI・MCP サーバー・公開 API は同じ答えの別の入口である。

## 走らせ方

```sh
koyu check examples/two-rooms.muro
```

パッケージ (`@kensnzk/koyu`) を入れると `koyu` と `koyu-mcp` の二つの実行ファイルが入る。動作環境は Node 22 以上である。

リポジトリの中から直接走らせるなら次の二つが同じ意味を持つ。**この頁と、この下のコマンド別の頁に貼られている出力は、すべてリポジトリのルートで実際に実行して得たものである。**

```sh
npx tsx src/cli.ts check examples/two-rooms.muro
npm run koyu -- check examples/two-rooms.muro
```

**人向けの出力は英語である。**機械が読む面 (診断・Finding・MCP) と同じ言葉に揃えてあり、ロケールを切り替える引数は無い。同じ文言の台帳を二つ持たないためである。

## 共通のかたち

```text
koyu <check|validate|layers|diff|plan|axo|doors|graph|stats|levels|runs|light|site|json> <entry.muro> [args...]
```

**渡すのは常に entry のファイルパス一つである。**`import` で層に割った建物でも、base 層のファイル (`examples/house/main.muro` など) だけを渡す。合成は毎回ゼロから行われ、途中の状態はどこにも保存されない。

例外は [`diff`](diff.md) だけで、そこでは二つ目のファイルパスを続けて取る。

## entry と import の解決

`import` の相対パスは、**その `import` 行が書かれているファイルからの相対**で解決される。entry からの相対でもカレントディレクトリからの相対でもない。だから base 層のファイルだけを別の場所へコピーしても合成できない (`Cannot read file: ./assets.muro` になる)。

割られた層の一枚を単体で渡すと落ちる。その層には `grid` も `level` も無いからである。

```sh
npx tsx src/cli.ts check examples/house/L1.muro
```

```text
✖ <absolute path>/examples/house/L1.muro:line 3: Undeclared level: level:L1
```

(`<absolute path>` は解決済みの絶対パスを略した表記である。実際の出力にはフルパスが出る。)

合成に参加した層とその強度順序は [`koyu layers`](layers.md) が見せる。

## 終了コードの読み方

| 終了コード | 意味 |
|---|---|
| 0 | 成功 — 問いの答えが「はい」 |
| 1 | 失敗 — エラーがある / 不足している / 到達できない、あるいは入力が構文・合成エラーで読めなかった |
| 2 | 呼び方が違う — 引数が足りない、未知のサブコマンド、未宣言のレベル名、読めない数値 |

**`2` は「あなたの書いたモデル」ではなく「あなたの打ったコマンド」の問題である。**`0` と `1` が具体的に何を意味するかはサブコマンドごとに違うので、各頁の終了コード表を見る。とくに [`diff`](diff.md) だけは `0` = 差分なし・`1` = 差分あり・`2` = 入力が壊れているという別の流儀を持つ。

呼び方の問題を終了コード 0 で通さないことは意図された規律である。読めない縮尺を渡したときに `width="NaN"` の SVG を書いて「生成しました」と言うようなことはしない。

## --help は無い

**`--help` というフラグは実装されていない。**サブコマンド名かファイルパスを欠いた呼び出しが使い方を印字するが、それは「呼び方が違う」経路であり、**終了コードは 2 になる。**`--help` と打った場合も、`--help` がサブコマンド名・ファイルパスの位置を埋めないので同じ経路を通る。

```sh
npx tsx src/cli.ts --help
```

```text
Usage: koyu <check|validate|layers|diff|plan|axo|doors|graph|stats|levels|runs|light|site|json> <file.muro> [args...]
  check:    --json (emit Diagnostic[] as JSON) / --strict (exit 1 if there are warnings) — structural consistency only
  validate: --json (emit Finding[] as JSON) — architectural judgement (not what check guarantees)
  layers:   the layers that took part in composition, weakest first. --attrs for the provenance of each attribute
  diff:  koyu diff <a.muro> <b.muro> [--json] — the difference in the language of composition (0=no difference / 1=differences / 2=the input is broken)
```

**この使い方の表示は網羅していない。**四つのサブコマンドしか触れておらず、[`plan`](plan.md) の `-l` / `-o` も、[`axo`](axo.md) の六つの旗も、[`doors`](doors.md) の二つのパス引数も書かれていない。各コマンドの旗は、それぞれの頁が全部を書き下している。

未知のサブコマンドも終了コード 2 である。

```sh
npx tsx src/cli.ts frobnicate examples/two-rooms.muro
```

```text
Unknown command: frobnicate
```

## 14 のサブコマンド

| コマンド | 何に答えるか | 旗 | 終了コード |
|---|---|---|---|
| [`check`](check.md) | 書かれたものはデータとして矛盾していないか | `--json` `--strict` | 0 / 1 |
| [`validate`](validate.md) | 建築として妥当か (check の保証ではない) | `--json` | 0 / 1 |
| [`layers`](layers.md) | どの層が合成に参加し、どの値をどこが与えたか | `--attrs` | 0 / 1 |
| [`diff`](diff.md) | この編集で構成の何が変わったか | `--json` | 0 / 1 / 2 |
| [`plan`](plan.md) | 平面図 (SVG) | `-l` `-o` | 0 / 1 / 2 |
| [`axo`](axo.md) | 軸測図 (SVG) | `-o` `-d` `-l` `-s` `--no-walls` `--ceilings` | 0 / 1 / 2 |
| [`doors`](doors.md) | そこからそこへ、扉を何枚通るか | — | 0 / 1 / 2 |
| [`graph`](graph.md) | この空間は何と、どう繋がっているか | — | 0 / 1 |
| [`stats`](stats.md) | 面積はいくつか | — | 0 / 1 |
| [`levels`](levels.md) | 高さはどう積み上がっているか | — | 0 / 1 |
| [`runs`](runs.md) | 縦動線はどう導かれたか | — | 0 / 1 |
| [`light`](light.md) | 採光の対象は 1/7 を満たすか | — | 0 / 1 |
| [`site`](site.md) | 敷地面積・接道・建蔽率・容積率 | — | 0 / 1 |
| [`json`](json.md) | 機械が読む正準 JSON | — | 0 / 1 |

どのコマンドも、サブコマンド名かファイルパスを欠いて呼べば使い方を印字して終了コード 2 を返す。上の表はその共通の 2 を省いてある。

## 二つの緑を混同しない

`check` が緑であることと、建物として使えることは別である。接する空間の既定は壁なので、扉を一枚も宣言しない二階建ては `check` が緑のまま完全に密封される。`check` が言うのは「書かれたものがデータとして矛盾していない」までで、建築的な妥当性は [`validate`](validate.md) が別に言う。

型からして別である。`check` が返すのは `Diagnostic { code, severity }`、`validate` が返すのは `Finding { rule, level }` で、綴りも違えば連結もできない。CI に置くなら両方を置く — その組み方は [CI で門番にする](ci.md) にある。

## 関連

- [CI で門番にする](ci.md) — どのコマンドをどの終了コードで落とすか
- [VS Code 拡張](editor.md) — 保存のたびに `check` を走らせる
- [koyu-mcp](../mcp/index.md) — エージェント向けの同じ導出
- [公開 API](../api/index.md) — プログラムから同じ導出を呼ぶ
- [.muro リファレンス](../muro/index.md) — 渡すファイルの書き方
