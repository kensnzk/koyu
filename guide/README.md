[English](en/README.md) · **日本語**

# guide/ — koyuを学ぶ

koyu は建築をテキストで書くための記法である。空間が一次要素で、壁は物ではなく二つの空間の**境界という関係**であり、平面図は描くものではなく空間の割付から生成されるものである。一棟が数百行の `.muro` に収まり、`koyu check` がその整合の門番になる。

このフォルダは**学ぶための本**である。何が真かという規範は [spec/](../spec/README.md) が持ち、guide/ は**どの順に覚えるか**と**どうやるか**を持つ。二冊は対になっていて、guide/ が規範的な事実を述べるときは必ず spec/ の該当節へ飛ぶ。両者が食い違ったら spec/ が正しい。

## はじめての人へ

[start.md](start.md) を上から順に、書いてあるとおりに書くこと。所要 30〜45分。終わったとき手元にあるのは、30行の `.muro` ファイル一つ、各階の平面図 (SVG)、そして「二階の寝室から外まで扉は何枚か」「居室の採光は足りているか」への答えである。選択肢は出てこない — 迷わず一度通り抜けられるように作ってある。

各段の到達点は [examples/steps/](../examples/steps/) にそのまま動くファイルとして置いてあるので、途中で合わなくなったら突き合わせればよい。

## 文書の地図

**学ぶための文書** — 通して読む。上から順に。

| 文書 | 内容 | 読者 |
|---|---|---|
| [start.md](start.md) | **チュートリアル** — 一室から二階建てまでを一本道で通す。手順だけで、選択肢は無い (30〜45分) | koyuに初めて触れる人。**ここから始める** |
| [concepts.md](concepts.md) | **説明** — 構文が読めるようになるために先に要る六つの考え。書かれないことが何を意味するか (10分) | 一度書いた人・記法の形の理由を知りたい人 |
| [gallery.md](gallery.md) | **実例集** — 同梱の5例を難度順に、生成した図と実測の数字つきで。各例が初めて示すものを書く | 図から入りたい人・次に何が書けるか知りたい人 (任意) |

**引くための文書** — 必要なところだけ開く。通読しない。

| 文書 | 内容 | 読者 |
|---|---|---|
| [cheatsheet.md](cheatsheet.md) | 全構文を一枚に。各項の見出しから spec/ の該当節へ飛べる | 書き方を思い出したい人 |
| [howto/](howto/README.md) | 目的から引く手順書 10編 — 階を足す・間取りに割る・採光・扉と避難・敷地と容積率・ファイル分割・同一性・MCP接続・エディタ・詰まったとき | 手が止まった人 |
| [diagnostics.md](diagnostics.md) | 診断コード全51件を**原因**と**直し方**と最小の再現つきで。エラー文から引く | `check` に叱られた人 |
| [glossary.md](glossary.md) | 語の一文定義と、その語を規範として定義している場所・実際に使われている場所 | 語が分からなくなった人 |
| [cli.md](cli.md) | `koyu` の全サブコマンドを「何に答えるか」から。実際の出力つき | CLIを叩く人 |
| [api.md](api.md) | 公開TypeScript APIを、やりたいことの側から。全49エクスポート | koyuを組み込むプログラムを書く人 (任意) |

**この二冊の外側** — guide/ が扱わないもの。

| 文書 | 内容 | 読者 |
|---|---|---|
| [spec/](../spec/README.md) | **規範リファレンス** — 文法・意味論・語彙の台帳・正準JSON・ツール契約。現在形だけを書き、理由は書かない | 実装する人・正確な定義が要る人 |
| [docs/decisions/](../docs/decisions/) | **ADR** — なぜそう決めたか、何を棄却したか (19編) | 設計の理由を知りたい人 (任意) |
| [docs/writing-architecture.md](../docs/writing-architecture.md) | **主張の本文** — この記法が何のためにあるか | 動機から入りたい人 (任意) |
| [AGENTS.md](../AGENTS.md) | エージェント (LLM) 用の入口 — ファイルの地図・コマンド・この企ての掟 | koyuのリポジトリで作業するエージェント |

## 読む順

到着の仕方は三通りある。自分のものを選んで、その順に読めばよい。

### 書きたい人 (.muroで建物を書く)

1. [start.md](start.md) — 手を動かす。**ここを飛ばすと後が読めない**
2. [concepts.md](concepts.md) — 書けたものが何だったのかを掴む
3. [cheatsheet.md](cheatsheet.md) を手元に置く。詰まったら [howto/](howto/README.md) を目的から引く
4. `check` にエラーを出されたら [diagnostics.md](diagnostics.md)
5. 次に何が書けるかは [gallery.md](gallery.md)

### ツールを作る人 (koyuを読み書きするプログラムを書く)

1. [start.md](start.md) — 言語を一度は自分で書く。書かずに仕様だけ読むと語彙が地に足を着けない
2. [concepts.md](concepts.md) — 特に §2「境界は関係であって、物ではない」と §5「原本と導出」
3. [spec/language.md](../spec/language.md) → [spec/semantics.md](../spec/semantics.md) — 規範。文法と、導出・検査・問いの定義
4. [spec/canonical-json.md](../spec/canonical-json.md) と [spec/tools.md](../spec/tools.md) — 機械形式と、CLI/MCP/APIの契約
5. [api.md](api.md) / [cli.md](cli.md) — 呼び方と、実際に返ってくるもの
6. エージェントに繋ぐなら [howto/agent-mcp.md](howto/agent-mcp.md)

### 主張を知りたい人 (なぜこんな記法なのか)

1. [docs/writing-architecture.md](../docs/writing-architecture.md) — 本文
2. [concepts.md](concepts.md) — 主張が記法としてどう形になったか
3. [gallery.md](gallery.md) — 一棟でどこまで書けるかの実測
4. [docs/decisions/](../docs/decisions/) — 個々の判断の理由と、棄却された案
5. [spec/notation-v0.md](../spec/notation-v0.md) — 記法がDSL/YAML/JSONの書き比べから選ばれた成立記録

## 読み方の約束

- **規範的な事実は spec/ が所有する。**guide/ がそれを述べるときは必ず spec/ の該当節へリンクする。リンクの無い断言を見つけたら、それは guide/ の欠陥である。
- **guide/ が所有するのは順序・実例・手順**である。加えて診断の「原因」と「直し方」— specは意図してこれを持たない。
- **貼られた出力と図は実行して得た実測である。**手で書き換えていない。
- コードブロックの印は四種類ある。<code>```muro</code> は**そのまま通る完全なファイル**、<code>```muro-part</code> は文脈から切り出した**断片** (単体では通らない)、<code>```muro-bad</code> は**わざと誤らせたもの**で `check` がエラーで落とす、<code>```muro-warn</code> は**エラーにはならないが警告が出るもの** (`check` は通り、`check --strict` で落ちる)。誤りの例は直後の本文が実際の診断文を引用する。
- **この四つの印は `test/guide.test.ts` が実行して検証している。**<code>```muro</code> は本当に通り、<code>```muro-bad</code> は本当に落ち、<code>```muro-warn</code> は本当に警告だけを出す。印の綴りを間違えた (=検証をすり抜けた) ブロックもそこで落ちる。
