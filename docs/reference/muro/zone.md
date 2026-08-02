---
title: zone — 数える集約
mode: reference
---

# zone — 数える集約

```muro-part
zone /L3..L10/A name:Aタイプ use:exclusive
zone /site name:敷地 site:1 area:1097.80
```

`zone <パス> [属性...]` は、**幾何を持たない集約**である。パス接頭辞で配下の[空間](space.md)を束ね、面積を合計し、属性を継承させる。住戸・部門・敷地のような「数えるが形を持たないまとまり」がここに来る。

ゾーンは形を持たないので、平面図にも軸測図にも現れず、[境界](boundary.md)を結ぶこともできない。

## パス接頭辞が配下を決める

ゾーン `/L1/A` の配下は、`/L1/A/` で始まるパスを持つ空間すべてである。ゾーン自身と同じパスの空間は配下ではない。

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
zone /L1/A name:Aタイプ use:exclusive
space /L1/A/ldk ldk X1..X2 Y1..Y2
space /L1/A/room room X2..X3 Y1..Y2 use:common
```

```text
$ npx tsx src/cli.ts stats z2.muro
L1
  /L1/A/ldk	ldk	ldk	14.40 m2
  /L1/A/room	room	room	14.40 m2
  Subtotal 28.80 m2
Total 28.80 m2 (indoor floor area)
By zone (counted aggregation):
  /L1/A	Aタイプ	28.80 m2
  ldk: 14.40 m2
  room: 14.40 m2
By use: exclusive 14.40 m2 (50.0%) / common 14.40 m2 (50.0%)
```

`use:` は配下へ継承され、**空間側の宣言が勝つ**。上の例では `/L1/A/ldk` がゾーンから `exclusive` を継ぎ、`/L1/A/room` は自分で書いた `common` を保つ。ゾーンが入れ子になっているときは、最も深いゾーンの `use:` が継承元になる。

## 間取りに割るなら親はゾーンにする

住戸を室に割るとき、**親を `space` にしてはならない。**領域つきの空間の下に領域つきの空間を置けば、二つの領域が重なって [GEO02](../diagnostics/geo.md) のエラーになる。

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/A unit X1..X3 Y1..Y2
space /L1/A/ldk ldk X1..X2 Y1..Y2
```

```text
✖ z1.muro:line 4: Space regions overlap: /L1/A and /L1/A/ldk
```

`space /L1/A unit X1..X3 Y1..Y2` を `zone /L1/A name:Aタイプ` に書き換えると通る。住戸の面積はゾーンが配下から合計するので、書かなくてよい。

## 属性の一覧

ゾーンに書ける鍵は五つと、ドットを含む名前空間つきの鍵だけである。台帳に無い鍵で名前空間も無いものは [ATT03](../diagnostics/att.md) のエラーになる。

| 鍵 | 値 | 意味 |
|---|---|---|
| `name:` | 自由語 | 表示名。一覧と集計に出る |
| `use:` | 自由語 | 集計の軸。配下の空間へ継承され、空間側の宣言が勝つ |
| `site:` | `0` / `1` | 敷地の印。`1` を書いたゾーンが `site` の問いの対象になる。モデルに一つ |
| `area:` | 正の数値 ㎡ | 敷地の宣言面積 (測量値)。導出面積と照合される |
| `uid:` | 不透明トークン | 改名を跨ぐ永続同一性。数字だけの形と空白はエラー。空間と横断してモデル全体で一意 |

`road:` は道路である `exterior` 空間の鍵であってゾーンの鍵ではない。ゾーンに書けば止められる。

```text
✖ z7.muro:line 4: zone /L1/A carries road:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.road:12000)
```

## 敷地のゾーン

`site:1` を持つゾーンが敷地である。敷地面積・接道・建蔽率・容積率は、そのゾーンを起点に導出される。

```muro
koyu 1.0
grid X 0 12000
grid Y 0 10000
level L1 0 h:3000 slab:200
zone /site name:敷地 site:1 area:120.00
space /site/bldg office X1..X2 Y1..Y2 level:L1 name:事務所
space /road road:6000 name:前面道路 outside:1
boundary /site/bldg /road edge:S t:200
polygon /site 0,0 12000,0 12000,10000 0,10000
```

```text
$ npx tsx src/cli.ts site site.muro
Site /site (敷地)
  Site shape: polygon with 4 vertices (a polygon declaration — given geometry)
  Site area: declared 120.00 m2 / derived 120.00 m2
  Road: /road (前面道路) width 6000mm / frontage 12000mm
  Building footprint (horizontal projection, rough): 120.00 m2 → building coverage ratio 100.0%
  Total floor area: 120.00 m2 → floor area ratio 100.0%
```

読みどころが三つある。

- **`area:` は測量値の宣言であり、導出面積と突き合わされる。**食い違いは `koyu check` ではなく `koyu validate` の `site.area` が言う — 構成が壊れているのではなく、与件と形が食い違っているという建築の側の話だからである。
- 敷地形状そのものは [polygon](polygon.md) が別に書く。`site:1` のゾーンに対応する polygon が無ければ導出面積は敷地内空間と建物の水平投影の合併から出る。対応するゾーンの無い polygon は [SIT04](../diagnostics/sit.md) の警告になる。
- **`/site` はレベル名ではないので、配下の空間はレベルを継がない。**上の例で `level:L1` を落とすと [SUF02](../diagnostics/suf.md) のエラーになる。

## レベルスパン

パスの先頭セグメントが `L3..L10` の形なら、[空間](space.md)と同じく宣言済みレベルの z 順の並びに展開される。基準階ごとに同じゾーンを置くための綴りである。

```muro-part
zone /L3..L10/A name:Aタイプ use:exclusive
```

## 診断

| 事象 | 出るもの |
|---|---|
| 同じパスのゾーンを二度宣言 | parse のエラー (`Duplicate zone path: /L1/A`) |
| 配下に空間が一つも無い | [ZON01](../diagnostics/zon.md) — 警告 |
| 同じパスの空間とゾーンが両方ある | [ZON02](../diagnostics/zon.md) — 警告 |
| `uid:` が数字だけ / 空白を含む / 重複 | [UID01 / UID02 / UID03](../diagnostics/uid.md) — エラー |

```text
$ npx tsx src/cli.ts check z3.muro --json
[
 {
  "code": "ZON01",
  "severity": "warning",
  "message": "There are no spaces beneath zone /L2/A",
```

ZON01 が警告にとどまるのは、層に割って書いているときに空間の層をまだ読んでいない、という状態がありうるからである。合成後も空のままなら、たいていはパスの綴り違いである。

## 正準JSON

ゾーンはパスと属性だけを持つ。面積は導出値なので保存されない。

```text
  "zones": {
    "/site": {
      "attrs": {
        "area": 120,
        "name": "敷地",
        "site": 1
      }
    }
  },
```
