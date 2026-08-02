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

同梱の例が実際に使っている型は **30 語** (`space` 行 469 本、うち 43 本は型を書いていない) である。頻度の高い順に `shop` (85) `corridor` (66) `room` (41) `shaft` (39) `service` (33) `unit` (20) `stair` (19) `hall` (15) … と続く。これは台帳ではなく **de facto の慣用**であって契約ではない。

## 開いていない語は、一つも無い

**型の位置は完全に開いている。**core はそこを一切読まない。`stair` も `shaft` も `ldk` も `厨房` も、ツールにとって等価な自由語であり、書かなくてもよい。

かつては二語だけが例外だった。`exterior` と `void` — 外部であること・床が無いこと — が型の位置に書かれ、構造として解釈されていた。**そしてそれが、この頁の主張を嘘にしていた。**

```text
✖ near.muro:line 5: The type exteriorr looks like a misspelling of exterior …
```

この見張りは、`exteriorr` の一字で空間が外部でなくなり延床が 16.20㎡ から 32.40㎡ へ倍増しながら check が緑で通った、という実測の後に置かれたものである。だが編集距離1の拒否は**規則の代わりに置いた勘**であって、距離2まで広げることもできなかった — `void` の距離2には `road` と `wood`、人が正当に書く語が入る。守れる範囲がヒューリスティックの都合で決まっているとき、それは設計ではない。

## 二語は宣言の側へ移った

```muro-part
space /out name:南側道路 road:6000 outside:1
space /L2/hole X1..X2 Y1..Y2 name:吹抜け void:1
```

`outside` と `void` は[台帳](../reference/muro/attributes.md)の鍵になった。同じ守りが、今度は**規則として**掛かる — `outsid:1` は [ATT03](../reference/diagnostics/att.md#att03) のエラーであり、`void:2` は [ATT02](../reference/diagnostics/att.md#att02) である。見張りは消えた。守るものが型の位置から出たので、守る必要が無くなったからである。

そして著者には逃げ道がある。`acme.outside:1` は運搬層として通る — **「これは自分の語で、ツールは読まない」と綴れる**からである。これが下の三層の話であり、開いていることと信頼できることが両立する条件そのものである。

## 属性は三層に分かれている

| 層 | 例 | core の態度 |
|---|---|---|
| **構造層** | パス・区画・レベル・関係の相手・`kind` | **必ず見る。**壊れていれば読まない |
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
space /out outside:1
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
