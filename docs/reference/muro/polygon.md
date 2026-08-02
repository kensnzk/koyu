---
title: polygon — 敷地形状
mode: reference
---

# polygon — 敷地形状

```text
polygon /ゾーンパス x,y x,y x,y …
```

`polygon` は敷地の形を、mm 座標の頂点列としてそのまま書く。**この記法で唯一、格子に載らない自由な頂点で「書かれる形」である。**

koyu では形はふつう生成物である — 空間の領域は通り参照の矩形として書かれ、壁も柱も屋根もそこから導かれる。だが**敷地の形は測量に由来する所与**であって、設計の生成物ではない。だから例外として認める。

```muro-part
polygon /site -2600,-7000 38000,-7000 38000,19600 2000,21000 -2600,15000
```

頂点は `x,y` の対を3つ以上。座標系はグリッドと同じで、単位は mm、X は東が正、Y は北が正である。負の値も書ける。

## site:1 のゾーンに対応させる

第一位置引数は[ゾーン](zone.md)のパスである。そのゾーンが `site:1` を持っていれば、`koyu site` の問いの対象になる。対応するゾーンが無ければ警告になる。

```text
⚠ No zone corresponds to polygon /siteX
```

```muro
koyu 1.1
name 敷地の最小例
unit mm
grid X 0 8000
grid Y 0 6000
level L1 0 h:2700 slab:200

zone /site name:敷地 site:1 area:154.00
space /site/house room X1..X2 Y1..Y2 level:L1 name:建物
space /out/road name:前面道路 road:6000 outside:1

polygon /site -2000,-2000 12000,-2000 12000,9000 -2000,9000

boundary /site/house /out/road edge:S t:150
  door w:900 name:玄関
boundary /site/house /out/road edge:N t:150
boundary /site/house /out/road edge:E t:150
boundary /site/house /out/road edge:W t:150
```

```text
Site /site (敷地)
  Site shape: polygon with 4 vertices (a polygon declaration — given geometry)
  Site area: declared 154.00 m2 / derived 154.00 m2
  Road: /out/road (前面道路) width 6000mm / frontage 28000mm
  Building footprint (horizontal projection, rough): 48.00 m2 → building coverage ratio 31.2%
  Total floor area: 48.00 m2 → floor area ratio 31.2%
```

## ここから何が出るか

| 導出 | 何に使われるか |
|---|---|
| 面積 (シューレース) | 敷地面積。ゾーンの `area:` (測量値㎡) と照合される |
| 敷地の外形 | 建物のはみ出しの検査 |
| 敷地境界線 | 配置図 — 最下階の平面が二点鎖線で描く (通り芯は一点鎖線) |

`polygon` が無くても `site` の問いは答えを返す — そのときの敷地面積は「敷地内の空間と屋内投影の合併」から導かれる。`polygon` はそれを測量値で置き換える。

## 形の健全さは check が、建物との関係は validate が言う

**形そのものが壊れていれば形が作れない**ので、それは読解の一部として `check` が見る。

| コード | severity | 何を言うか |
|---|---|---|
| SIT01 | error | 敷地形状の重複頂点 |
| SIT02 | error | 敷地形状の自己交差 |
| SIT04 | warning | 対応するゾーンの無い `polygon` |

```text
✖ The site shape has a duplicate vertex (12000,-2000)
✖ The site shape is self-intersecting (near 5000,3500)
```

**建物と敷地の関係についての判断**は、別の面が持つ。`koyu validate` の二つの規則である。

| 規則 | level | 何を言うか |
|---|---|---|
| `site.escape` | violation | 建物が敷地形状からはみ出している |
| `site.area` | caution | 宣言面積と導出面積が食い違う (許容 ±0.05㎡) |

```text
✖ [site.escape] esc.muro:line 8: /L1/house escapes the site shape (near 0,0)
⚠ [site.area] site.muro:line 8: Declared and derived site areas disagree: declared 150 m2 / derived 154.00 m2
```

はみ出しの照合に使うのは割付ではなく**導出された領域**である。だから[描かれた線](line.md)で敷地なりに切り落とした外形はここを通る。`type:exterior` の空間と、その `polygon` のゾーンパスの配下にある空間は照合から外れる。

## 隔離レイヤーに置く

敷地形状は別のファイルに置き、`import` で重ねる運用が標準である。測量由来の所与と設計の判断は、層として分かれているほうが履歴を追いやすい。

```muro-part
import ./site-geometry.muro
```

同じパスに `polygon` を二度書くとビルドエラーになる。合成の層をまたいでも同じである。

コードから原因と直し方を引くなら [診断コードの一覧](../diagnostics/index.md) がある。

## 隣り合う頁

- [zone](zone.md) — `polygon` が対応する先
- [space](space.md) — 敷地の中に置かれるもの
- [line](line.md) — もう一つの「書かれる形」
- [koyu site](../cli/site.md) — 敷地の問いを返す
- [koyu validate](../cli/validate.md) — はみ出しと面積の食い違いを言う
