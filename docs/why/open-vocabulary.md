---
title: 属性の拡張
mode: explanation
---

# 属性の拡張

意味の与え方には二つの流儀がある。**巨大なクラス階層**か、**少数の解釈語と開かれた語彙**か。koyu は後者を採る。拡張はスキーマ改訂ではなく語の追加で済み、外の分類体系 (都市データ・不動産 ID・センサー・ネットワークデータ) と接続する受け口がそこにできる。

ただし**開き方に形がある。**開いていることと信頼できることは、境界が宣言されていれば両立する。**宣言が無ければ、見ていないことと、見て問題がないことが区別できない。**その状態の「異常なし」は何も意味しない。

## 型は自由語である

`space` の第 2 位置引数 (型) は必須だが、値は何でも通る。

```muro
grid X 0 2000
grid Y 0 2000
level L1 0 h:2400 slab:150
space /L1/a wumbo X1..X2 Y1..Y2
```

```text
✔ Consistent — 1 space / 0 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

同梱の例が実際に使っている型は **32 語** (`space` 行 469 本) である。頻度の高い順に `shop` (85) `corridor` (66) `room` (41) `shaft` (39) `exterior` (34) `service` (33) `unit` (20) `stair` (19) `hall` (15) … と続く。これは台帳ではなく **de facto の慣用**であって契約ではない。

## 開いていない二語

型のうちツールが構造として解釈するのは二つだけである。

| 型 | 解釈 |
|---|---|
| `exterior` | 外部。領域なしでよい。`road:` を付ければ接道の対象になる |
| `void` | 吹抜け。床面積に算入されず、通行できない |

**この二つ以外の型は、どれだけ意味ありげでも、ツールにとって等価な自由語である。**`stair` も `shaft` も `ldk` も、空間の型としては解釈されない。

そしてこの二語だけは**綴りが守られる。**

```text
✖ near.muro:line 5: The type exteriorr looks like a misspelling of exterior (exterior is read structurally — if a different word was meant, spell it further away)
```

`exteriorr` が黙って通れば、その空間は外部でなくなり延床が倍になる。**一字違いの代償が大きすぎるので、近い綴りだけを拒む。**遠い語 (`room` `yard` `wumbo`) には何も言わない。

## 属性は三層に分かれている

| 層 | 例 | core の態度 |
|---|---|---|
| **構造層** | パス・型・区画・レベル・関係の相手・`kind` | **必ず見る。**壊れていれば読まない |
| **解釈層** | `h` `w` `at` `edge` `daylight` `road` `site` `style` … | 台帳が値域を定義し、**見る** |
| **運搬層** | `acme.sensor` `bems.temp` `survey.measured` … | **見ない。**名前空間つきで開いている |

運搬層は**ドット区切りの名前空間**を持つ。

```muro
grid X 0 2000
grid Y 0 2000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居間 acme.sensor:23 bems.temp:22.5
```

```text
✔ Consistent — 1 space / 0 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

`acme.sensor` にも `bems.temp` にも、core は**一切の意味を与えない** — 値域も検査しないし、導出にも判定にも使わない。何を書いてもよい。

**名前空間を持たない未知のキーはエラーである。**

```muro-bad
grid X 0 2000
grid Y 0 2000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 nmae:居間
```

```text
✖ att.muro:line 5: /L1/a carries nmae:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.nmae:居間)
```

**かつてこれは黙って通っていた。**「台帳に無い語は間違いではなく、解釈されない語だ」という理屈で正準 JSON にそのまま出ていた。理屈は一貫していたが、代償が高すぎた — 同じ理屈で `heigh:2400` は高さの不変量の検査を、`sit:1` は敷地の判定を、`stiar:N` は縦動線を丸ごと無音にし、**どれも緑のまま**だった。

名前空間は、その境界の綴りである。**持てるが判定しないは正当な状態であり、それを明示することが自由の条件である。**属性の台帳は [属性](../reference/muro/attributes.md)、エラーの詳細は [ATT — 属性](../reference/diagnostics/att.md)。

## 判定の入口は型ではなく、宣言である

型が自由語であることが効いてくるのは、判定の入口がどこにあるかを見るときである。

窓の無い浴室を採光の対象にしたければ、型を変えるのではなく `daylight:1` を書く。

```muro
grid X 0 2000
grid Y 0 2000
level L1 0 h:2400 slab:150
space /L1/bath wet X1..X2 Y1..Y2 name:浴室 daylight:1
space /out exterior
boundary /L1/bath /out edge:S t:150
```

```text
✖ /L1/bath	浴室	window 0.00 m2 / floor 4.00 m2 = no window (needs 1/7 ≈ 0.57 m2)
✖ Short of 1/7: 1 of 1 room (this is a validation judgement)
```

型を `wet` から `bedroom` に替えても判定は一切動かない。**判定を掛けるかどうかは書き手が宣言することであり、室の名前から推し量るものではない。**

これは建築の実態にも合っている — 日本の建築基準法の居室も「継続的に使用する室」という実態の判断であって、室名では決まらない。ただし属性が名指しているのは**ツールの判定**であって法概念そのものではない。両者は同じ集合ではない。

## 増やすときの規律

語彙が開いていることは、何を足してもよいことを意味しない。新しい語・機能の採否は五問で決まる。

1. **それは実体を持つか。**持つなら関係か与件に座を持つ。空間には置かない
2. **それは与件か。**与件でない座標は書かない
3. **同じ場所に複数の意見がありうるか。**あるなら合成の集合編集に載せる。専用構文を作らない
4. **それは判定か。**判定なら検証の面であって、記法ではない
5. **それは形か。**形なら描画の面であって、記法ではない

**「実在の建築が書けるようになるか」は判定に使わない。**「実例が要求したら採否を決める」という留保つきの決定を書かない。留保は、そのまま拡張の入口になる。

## この先

- [属性](../reference/muro/attributes.md) — 台帳
- [ATT — 属性の診断](../reference/diagnostics/att.md)
- [判定 — koyu validate](../reference/validate/index.md)
- [check と validate の違い](two-kinds-of-green.md)
