---
title: パスと面積集計
mode: explanation
---

# パスと面積集計

`/L5/A/ldk` は名前ではなく住所である。そして `/` で切られた階層は、そのまま集計の単位になる。**パスは二役を兼ねている。**

この二役が、建築のデータで長年ややこしかった問題を一つ消す — **粒度をどこで切るか。**室で切るのか、住戸で切るのか、階で切るのか。koyu の答えは「全部で切る。パスがそれを同時に成立させる」である。

## 住所として

パスは人間が読める。UUID の対応表を持たずに、外の世界がこの空間を指せる。

```muro-part
space /L5/A/ldk ldk X1..X3 Y1..Y2 name:リビングダイニング
```

センサーの計測値も、予約システムも、BEMS も、`/L5/A/ldk` という文字列を外部キーにできる。**パスがそのまま意味である。**

パスの先頭セグメントは、**同名の `level` が宣言されているときにだけ**レベルになる。`/L1/` と書いただけではレベルは生まれない。

```muro-bad
grid X 0 3600
grid Y 0 4000
space /L1/x room X1..X2 Y1..Y2
```

```text
✖ p3.muro:line 3: /L1/x has a region, but its level cannot be determined (give it at the head of the path or with level:)
```

エラーであって、警告ではない。終了コードは 1 である。**レベルが決まらなければ形が作れない**ので、これは充足性の欠落として扱われる。

パスの先頭で表せるのは一つのレベルだけなので、**階を跨ぐくくり (メゾネット等) は `level:` 属性で明示する。**

## 集計の階層として

領域を持つ空間は、**領域を持つ子空間を持てない。**親子で領域が重なるからである。

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/home unit X1..X3 Y1..Y2
space /L1/home/a room X1..X2 Y1..Y2
space /L1/home/b room X2..X3 Y1..Y2
```

```text
✖ p1.muro:line 4: Space regions overlap: /L1/home and /L1/home/a
✖ p1.muro:line 4: Space regions overlap: /L1/home and /L1/home/b
```

**住戸を室に割るときは、親を `space` ではなく `zone` にする。**ゾーンは幾何を持たず、パス接頭辞で配下を束ねるだけの、数える集約である。

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
zone /L1/home name:住戸
space /L1/home/a room X1..X2 Y1..Y2
space /L1/home/b room X2..X3 Y1..Y2
```

```text
L1
  /L1/home/a	a	room	14.40 m2
  /L1/home/b	b	room	14.40 m2
  Subtotal 28.80 m2
Total 28.80 m2 (indoor floor area)
By zone (counted aggregation):
  /L1/home	住戸	28.80 m2
```

個々の室が出て、しかも住戸の合計が残る。**「間取りに割っても住戸の言葉を失わない」**というのがこの二役の効き目である。

だから設計上の指針が一つ出る — **集計したい単位が、パスの先頭側に来る。**

同梱例には二つの流儀がある。

| 流儀 | 例 | 何で束ねたいか |
|---|---|---|
| `/L1/room` — レベルを先頭に | `two-rooms` `office` `mansion` `tower` `complex` | 階ごとの面積・階ごとの検査 |
| `/home/room` + `level:L1` — 住戸を先頭に | `house` | 住戸ごとの面積・メゾネット |

優劣ではない。**何で束ねたいかの違いである。**`zone` と `space` の使い分けは [zone](../reference/muro/zone.md)。

## パスは変わる。だから uid がある

改名や階層再編でパスが変われば、それを外部キーにしていたセンサーや台帳との対応は切れる。

**寿命がパスより長い参照が要るときは `uid:` を使う。**不透明なトークンで、モデル全体で一意で、パスから導出しない。

```muro-part
space /L5/A/ldk ldk X1..X3 Y1..Y2 uid:u-7f3k9m2qx4b8dhtv
```

**パスから導出しない**ことが要である。導出すれば改名でトークンが変わり、uid の意味 — 改名を跨いで同じものを指す — が消える。機械が作るときは乱数である。

役割分担は明確である。

| 用途 | 何を使うか |
|---|---|
| リポジトリの中の参照 (`boundary` / `doors` / ゾーン集計) | **パス** |
| 集計の階層 | **パス** |
| 改名を跨ぐ長期の同一性 (センサー・実測・台帳) | **uid** |

`uid` を書けるのは `space` と `zone` の二つに閉じている。関係に書けないのは、関係の同一性が両端から導かれるからである ([境界による壁の表現](boundary-is-a-relation.md))。詳細は [同一性](../reference/identity.md)。

## 名前空間としても働く

合成で複数のファイルを重ねるとき、層ごとの名前空間接頭辞は要らない — **パスの階層がすでに名前空間である。**`L5.muro` が `/L5/...` を書き、`core.muro` が `/B2..L19/core/...` を書けば、それだけで衝突しない。

これは USD からパス名前空間という機構だけを借りた結果である ([ファイル分割と重ね合わせ](composition-is-for-time.md))。

## この先

- [zone の書き方](../reference/muro/zone.md)
- [同一性](../reference/identity.md)
- [ファイル分割と重ね合わせ](composition-is-for-time.md)
- [koyu stats](../reference/cli/stats.md)
