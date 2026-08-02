---
title: 数える分節と数えない分節
mode: howto
---

# 数える分節と数えない分節

事務室の入口側 2m が土間で、床がモルタルになっている。**これは一室か、二室か。**

koyu はこれを設計判断として扱い、どちらでも書けるようにしてある。ただし**帰結が違う。**この頁は、その二つを実際に書き比べて選び方を決める。

以下の出力は実際に走らせて得たものである。

## 二つの問いで決まる

判断は次の二つだけである。

1. **面積表に一行として出したいか。**
2. **そこを通れるかどうかが問題になるか。**

どちらかが「はい」なら**数える分節** — 空間を二つ書く。どちらも「いいえ」なら**数えない分節** — 一つの空間の中の範囲として書く。

| 書き方 | 面積表 | 通行のグラフ | 何を運ぶか |
|---|---|---|---|
| [`space`](../reference/muro/space.md) を二つ | **一行ずつ出る** | **辺を張る** | 領域・型・属性のすべて |
| [`zone`](../reference/muro/zone.md) | 配下の合計が一行 | 張らない (幾何を持たない) | 集約と継承される `use:` |
| [`area`](../reference/muro/area.md) (空間の中) | **出ない** | 張らない | 領域と `name:` `floor:` `spec:` |
| [`seg`](../reference/muro/seg.md) (境界の上) | **出ない** | 張らない (壁に穴を空けない) | 区間と、その区間の属性の上書き |

**`area` と `seg` は数えない。**面積にも室数にも `koyu doors` のグラフにも一切現れない。

## 数えないで書く

土間を「事務室の中の範囲」として書く。あわせて、外壁の一部だけがカーテンウォールであることも `seg` で書く。

```muro
koyu 1.0
name 数えない分節
unit mm

grid X 0 8000
grid Y 0 5000

level L1 0 h:2700 slab:200

space /L1/office office X1..X2 Y1..Y2 name:事務室 floor:タイルカーペット
  area X1..X1+2000 Y1..Y2 name:土間 floor:モルタル
space /out name:外部 outside:1

boundary /L1/office /out t:180 spec:RC edge:S
  seg w:3000 at:X1+4000 spec:カーテンウォール
  door w:900 h:2100 at:X1+1000 name:D1
```

```text
✔ Consistent — 2 spaces / 1 boundary
```

面積表は一行である。

```text
L1
  /L1/office	事務室	office	40.00 m2
  Subtotal 40.00 m2
Total 40.00 m2 (indoor floor area)
  office: 40.00 m2
```

グラフにも土間は出ない。事務室が一つの節点で、扉が一枚外へ出ている。

```text
/L1/office (事務室)
  — 1 door → /out  (spec:RC)
/out (外部)
  — 1 door → /L1/office  (spec:RC)
```

**`area` を何枚重ねても、面積は親の空間の領域から出る。**床仕上げは範囲ごとに変わり、集計は変わらない。これが欲しいものなら、ここで終わりである。

## 数えて書く

同じ建物を、土間と執務を別の空間として書く。**親は `space` ではなく `zone` にする** — 領域を持つ空間の下に領域を持つ空間を置けば必ず重なるからである。

```muro
koyu 1.0
name 数える分節
unit mm

grid X 0 8000
grid Y 0 5000

level L1 0 h:2700 slab:200

zone /L1/office name:事務室
space /L1/office/doma  hall   X1..X1+2000 Y1..Y2 name:土間 floor:モルタル
space /L1/office/floor office X1+2000..X2 Y1..Y2 name:執務 floor:タイルカーペット
space /out name:外部 outside:1

boundary /L1/office/doma /L1/office/floor type:open

boundary /L1/office/doma /out t:180 spec:RC edge:S
  door w:900 h:2100 name:D1
boundary /L1/office/floor /out t:180 spec:RC edge:S
```

```text
✔ Consistent — 3 spaces / 3 boundaries
```

面積表は二行になり、ゾーンの小計が付く。

```text
L1
  /L1/office/doma	土間	hall	10.00 m2
  /L1/office/floor	執務	office	30.00 m2
  Subtotal 40.00 m2
Total 40.00 m2 (indoor floor area)
By zone (counted aggregation):
  /L1/office	事務室	40.00 m2
  hall: 10.00 m2
  office: 30.00 m2
```

**合計は同じ 40.00 m2 である。**割り方を変えても延床は動かない。動いたのは、面積表の行数と、問いを立てられる粒度である。

```text
1 door — /L1/office/floor → /L1/office/doma → /out
```

執務から外までの経路が言えるようになった。数えない書き方ではこの問いは立てられない。

## 二つを分ける決定的な一行

```muro-part
boundary /L1/office/doma /L1/office/floor type:open
```

**空間を二つに割った瞬間、その間には壁が導かれる。**接する空間の既定は壁であり、壁は扉が無ければ通れない。土間と執務のあいだに扉は無いので、`type:open` と書かなければ**執務は密封される。**

これが「割ると通行が問題になる」ということの中身である。割らないなら考えなくてよく、割るなら必ず書かなければならない。

## `area` に書けないもの

`area` は室ではない。だから**室の属性を持たない。**

書けるのは `name:` `floor:` `spec:` と、ドットを含む名前空間つきの鍵だけである。`use:` も `h:` も `daylight:` も書けない。

```text
✖ ar.muro:line 5: area (/L1/a) carries use:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.use:common)
```

さらに三つ。

- **境界を持てない。**扉も窓も置けない。隣接も通行も親の空間のものである。
- **一枚は一つの矩形である。**`+` による合併は書けない。複数の範囲が要るなら `area` を複数行書く。
- **領域を持たない空間には書けない。**`/out` の中に `area` は置けない。

`name:` は**同じ空間の中で一意**でなければならない。名は同一性であり、後から層を重ねて編集するときに指す言葉になる。

## `seg` が壁を割らないこと

`seg` と開口を分ける線は一つである。**開口は壁を割り、`seg` は割らない。**

```muro-part
boundary /L1/office /out t:180 spec:RC edge:S
  seg w:3000 at:X1+4000 spec:カーテンウォール
  door w:900 h:2100 at:X1+1000 name:D1
```

上の `seg` は、南面の壁のうち 3000mm の区間の `spec` だけを差し替える。そこに穴は空かず、グラフに辺は張られず、`koyu doors` の答えは変わらない。位置の書き方 (`w` `at` `edge`) は開口と同じで、置けるかどうかの判定も同じ順で走る。

**「一枚の壁の一部だけが違う」を書きたいときが `seg` の出番である。**そこを通れるようにしたいなら、それは `door` である。

## 選び直す

後から変えられる。**割り方は書かれた構成であって、導出ではない。**

**数えない → 数える。**親を `zone` に変え、`area` を `space` に書き直し、二つの空間のあいだの境界を書く。面積の合計は変わらないが、行数とグラフが変わる。

**数える → 数えない。**二つの `space` を一つにまとめ、片方の領域を `area` として親の下に字下げする。ゾーンは要らなくなる。

どちらも[正準 JSON](../reference/json/index.md) に現れる差分であり、`koyu diff` が構成の言葉で言い当てる。

## 判断の目安

| 状況 | 書き方 |
|---|---|
| 床仕上げが範囲で変わる | `area` |
| 家具や什器の置き場を記録する | `area` |
| 壁の一部だけ仕様・耐火等級が違う | `seg` |
| 面積表に一行として出したい | `space` を二つ |
| そこを通れるかを問いたい | `space` を二つ |
| 用途別集計を分けたい (`use:`) | `space` を二つ |
| 天井高が違う | `space` を二つ (`h:` は室の属性である) |
| 採光の判定を別に立てたい | `space` を二つ (`daylight:` は室の属性である) |
| 住戸・部門・敷地のような「形を持たないまとまり」 | `zone` |

## 関連

- [area — 空間の中の数えない分節](../reference/muro/area.md) — 隔離則と書ける属性
- [seg — 境界上の数えない分節](../reference/muro/seg.md) — 位置の書き方と属性の上書き
- [space](../reference/muro/space.md) — 数える分節
- [zone — 数える集約](../reference/muro/zone.md) — 形を持たないまとまり
- [よくある詰まり](troubleshooting.md#5-領域が重なっていると言われる) — 親を `space` にしたときのエラー
