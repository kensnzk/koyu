---
title: 緑の check は「使える建物」を意味しない
mode: explanation
---

# 緑の check は「使える建物」を意味しない

```text
✔ Consistent — 3 spaces / 3 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

この一行が言っているのは、**書かれたものがデータとして矛盾していない**ということだけである。壊れた JSON を JSON パーサが弾くのと同じ層にある。**判定ではなく読解の一部である。**

この頁は、その線を実例で示す。約束の正確な一覧は [約束の範囲](../reference/scope.md) にある。

## 密封された二階建て

次の 11 行は緑になる。

```muro
koyu 1.0
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:300
level L2 3000 h:2400 slab:300
space /L1/hall hall X1..X2 Y1..Y2
space /L2/bed bedroom X1..X2 Y1..Y2
space /out exterior
boundary /L1/hall /out t:150
boundary /L2/bed /out t:150
boundary /L1/hall /L2/bed type:stair
```

```text
✔ Consistent — 3 spaces / 3 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

外壁があり、階段があり、レベルが揃い、高さの不変量も成り立っている。**しかし外へ出られない。**

```sh
npx tsx src/cli.ts doors sealed.muro /L2/bed /out
```

```text
Cannot reach /out from /L2/bed
```

理由は単純である。**接する空間の既定は壁であり、扉の無い壁は通れない。**扉を一枚も宣言しなければ、二階建ては緑のまま完全に密封される ([書かないことが意味を持つ](silence.md))。

「接しているのに境界が宣言されていない」という警告はかつて存在したが、既定が壁になったことで役目を終え、廃止された。**沈黙が既定の壁を意味する体系では、沈黙は欠落ではない。**

## 判定は、別のコマンドが言う

密封は見逃されているのではない。**別の面が捕まえる。**

```sh
npx tsx src/cli.ts validate sealed.muro
```

```text
✖ [access.unreachable] sealed.muro:line 6: Cannot reach the exterior: /L1/hall (no passable boundary leads out — write a door)
✖ [access.unreachable] sealed.muro:line 7: Cannot reach the exterior: /L2/bed (no passable boundary leads out — write a door)
Validation — 2 violations / 0 cautions
```

`check` と `validate` は**別のコマンドで、別の型を返し、別の凍結状態にある。**この分け方そのものが設計判断であり、[二種類の緑](two-kinds-of-green.md) が扱う。

## 空のファイルも緑である

極端な場合として、空のファイルも `check` は緑にする。

```text
✔ Consistent — 0 spaces / 0 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

終了コードは 0 である。**成立していない構成が無いのだから、それは正しい。**

`check` は「書かれたものに矛盾が無い」ことの検査であって、「必要なものが書かれている」ことの検査ではない。**この非対称は欠陥ではなく、定義である。**

## 緑が保証すること・しないこと

**保証する** — パスと同一性の一意性、参照先の存在、レベルの定義、区画の平面と断面の重なり、合成の解決が定まること、形を作るのに必要な情報の充足、関係の健全性、導出の一意性、解釈される属性の値域、与件の健全性。

**保証しない** — 採光・面積率・容積率・外皮の連続・階段の登りやすさ・扉の設置可能性・避難・接道、その他あらゆる建築的な妥当性。そして運搬層の属性の意味。

線の引き方は一貫している。**「そこから一意な形が作れるか」までが `check` で、「その形が建築として妥当か」は `validate` である。**

だから断面の重なり (下階の天井と上階の床が同じ z を占める) は `check` にある — それは二つの空間の領域が重なるのと同じ種類の矛盾であって、そこからは一意な形が作れない。一方「階高・軒高・斜線」のような高さの判断は `check` に無い。

一覧と診断コードの対応は [約束の範囲](../reference/scope.md) にある。

## 緑を根拠に何を主張してよいか

| 主張 | 緑を根拠にできるか |
|---|---|
| このファイルは読める | **できる** |
| このファイルから一意な形が作れる | **できる** |
| このファイルの正準 JSON は安定している | **できる** |
| 外へ出られる | できない → `doors` / `validate` |
| 外皮が閉じている | できない → `validate` の `envelope.gap` |
| 採光が足りている | できない → `light` / `validate` |
| 階段が登れる | できない → `runs` / `validate` |
| 建物として使える | **できない** |

**緑を根拠に「動く」と主張しない。**これは慎重さの表明ではなく、`check` の意味の定義そのものである。

## この先

- [二種類の緑](two-kinds-of-green.md) — なぜ二つに分かれているか
- [約束の範囲](../reference/scope.md) — 保証の完全な一覧
- [判定 — koyu validate](../reference/validate/index.md)
- [koyu doors](../reference/cli/doors.md)
