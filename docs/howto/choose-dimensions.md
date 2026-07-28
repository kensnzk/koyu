---
title: 書く前に寸法を決める
mode: howto
---

# 書く前に寸法を決める

グリッド・コア断面・貸室デプスを先に決めてから空間を書く。逆にすると `check` は通るが建物にならない。

**この頁は koyu の意味論ではない。**ここに並ぶ数字は、実在の機器カタログと日本の設計慣行から取った**設計の知見**であって、記法の規則でも処理系の保証でもない。[`koyu check`](../reference/cli/check.md) は整合を守るが**寸法の現実性は守らない** — 幅2mのエレベーターも奥行30mの貸室も緑になる。別の慣行で設計するなら、この表ごと差し替えてよい。

## 順序

1. **グリッドを選ぶ。**事務所・商業なら 8,400 が既定値になる。
2. **コアの断面を置く。**シャフト 2,400 + 背面帯 1,800 + 乗場ホール 4,200 の三層で読む。
3. **貸室デプスを決める。**コアから窓まで 8.4〜12.6m に収める。
4. **階高を決める。**事務所基準階は 4,200 = 天井 2,800 + 懐 1,400。
5. **そこではじめて `space` を書く。**

## 構造グリッド

| 部位 | 値 | 根拠 |
|---|---|---|
| 事務所・商業の基本スパン | **8,400** | 日本の大規模オフィスの最頻値 (6.4〜9.6m の中庸)。駐車3台 (2,800×3) とも割り切れる |
| 大スパン (宴会場・無柱) | 16,800〜25,200 | 基本スパンの2〜3倍で梁成を現実に収める |
| 柱寸法 | 低層 1,000 → 高層 700 角 | 階を追って絞る |

同梱の `examples/twin/` は全体が 8,400 のグリッドに載っている。

## 縦動線

| 部位 | 値 | 根拠 |
|---|---|---|
| エレベーター 1600kg級 かご | 2,150W × 1,600D | 実在の乗用機の標準寸法 |
| 同 昇降路 (シャフト) 1台 | 2,800W × 2,400D | かご + カウンターウェイト + 躯体余裕 |
| **3室並び = 8,400 = 1スパン** | 2,800 × 3 | 台数計画がそのままグリッドに乗る |
| 乗場ホール (対面バンク) | 幅 4,200 | 片側バンクなら 2,700〜3,500 |
| シャフト背面帯 | 1,800 | EPS・PS・DS を収める設備帯 |
| 台数の目安 | 事務所 3,000〜4,000㎡/台、ホテル 100室/台 | 交通計算の初期値 |
| エスカレーター | 幅1,200機。長さ ≒ 階高 × √3 (階高6,900 で 12,000) | 30°勾配。乗降場各2,000を足す |
| 車路スロープ | 幅 6,000 (すれ違い) / 勾配 1/6 まで | 階高4,200なら水平長 25,200 = 3スパン |

**シャフトは1機=1室で書く。**束ねると平面が EV 室の実態を失う。

## 階段室の大きさは、段の形を決める

段数も踏面も書かない。書くのは階段室の大きさで、[`koyu runs`](../reference/cli/runs.md) がそこから段を出す。**踏面は 300mm を目標に導かれ、余りは踊り場が吸う。**階段室が短いと目標に届かず、踏面が痩せる。

階高 4,200・幅 2,800・折返しの階段室で、上る向きの奥行だけを変えて `runs` を取ると次になる。

```text
4000	L1→L2	stair	S	rise 4200mm	return	24 risers of 175mm, tread 164mm	going 3600mm	/L1/s
4600	L1→L2	stair	S	rise 4200mm	return	24 risers of 175mm, tread 218mm	going 4800mm	/L1/s
5000	L1→L2	stair	S	rise 4200mm	return	24 risers of 175mm, tread 255mm	going 5600mm	/L1/s
5600	L1→L2	stair	S	rise 4200mm	return	24 risers of 175mm, tread 300mm	going 6600mm	/L1/s
6000	L1→L2	stair	S	rise 4200mm	return	24 risers of 175mm, tread 300mm	going 6600mm	/L1/s
7000	L1→L2	stair	S	rise 4200mm	return	24 risers of 175mm, tread 300mm	going 6600mm	/L1/s
```

[`koyu validate`](../reference/cli/validate.md) が窮屈な段を `stair.proportion` (caution) で言う。上の6つのうち、4,000 と 4,600 が捕まり、5,000 以上は通る。

```text
⚠ [stair.proportion] s4000.muro:line 11: Derived step dimensions are cramped: 24 risers of 175mm, tread 164mm (2*riser+tread = 514mm; expected 550-700mm)
⚠ [stair.proportion] s4600.muro:line 11: Derived step dimensions are cramped: 24 risers of 175mm, tread 218mm (2*riser+tread = 568mm; expected 550-700mm)
```

**階高が上がれば必要な奥行も上がる。**同じ幅 2,800 で階高を 6,900 (1階エントランス) にすると、7,000 の奥行でようやく踏面 253mm になる。

```text
L1→L2	stair	S	rise 6900mm	return	39 risers of 177mm, tread 253mm	going 9600mm	/L1/s
```

**2,800 × 7,000 が、特別避難階段の塊として置ける実用の寸法である** — `examples/twin/core.muro` の階段はこの寸法で書かれている。

## 断面 (階高)

| 部位 | 階高 | 内訳 |
|---|---|---|
| 事務所基準階 | **4,200** | 天井 2,800 + 懐 1,400 (`slab:1400` と書く) |
| 商業 (物販) | 4,800〜6,900 | 天井 3,000〜。1階エントランスは 6,900 (天井 6,000) |
| ホテル客室・住戸 | 3,200〜4,200 | 事務所と同じ板に載せるなら 4,200 のまま |
| 機械階 | 4,600〜6,000 | 熱源機器の据付高さ。**客の階数に現れない** (M1/M2 と名付ける) |
| 地下駐車場 | 3,300 (梁下 2,300+) | `slab:900` |

階高の積み上がりは [`koyu levels`](../reference/cli/levels.md) が矩計として返す。天井高 + 上階の床組み厚が階高を超えれば `check` が止める。

## 平面の割り

| 部位 | 値 | 根拠 |
|---|---|---|
| 事務所貸室デプス (コア→窓) | **8.4〜12.6m** | 標準 9〜13m。18m を超すと執務環境も構造も破綻する |
| ホテル客室 | 幅 4,200 × 奥行 8,400 ≈ 35㎡ | **幅 = スパンの 1/2** で割り切る |
| 共同住宅住戸 | 幅 8,400 (1スパン) × 奥行 10〜12m | 70〜90㎡ ファミリー |
| 廊下 (中廊下) | 2,400 | 事務所コア内は 2,400〜4,200 |
| 店舗モール | 幅 8,400 (吹抜含む) | 両側店舗の歩行帯 + 滞留 |
| 便所ブロック | 1スパンの半分 (4,200 × 8,400)、男女で1スパン | 事務所基準階の標準 |

## 深い床は採光で落ちる

**1/7 は面積比なので、床が深くなると窓を大きくしても届かない。**幅 8,400 の板に 5,600 × 2,600 のカーテンウォールを1枚入れ、奥行だけを 10.2m と 16.8m にして [`koyu light`](../reference/cli/light.md) を取ると、

```text
✔ /L1/shallow	奥行10.2m	window 14.56 m2 / floor 85.68 m2 = 1/5.9 (needs 1/7 ≈ 12.24 m2)
✖ /L1/deep	奥行16.8m	window 14.56 m2 / floor 141.12 m2 = 1/9.7 (needs 1/7 ≈ 20.16 m2)
✖ Short of 1/7: 1 of 2 rooms (this is a validation judgement)
```

**窓面の検算は、区画を決める前に行う。**足りない区画は、住戸にせずラウンジや倉庫に振るという判断もある。手順は [窓を開けて採光を通す](windows-and-daylight.md) にある。

## 外皮

| 部位 | 値 |
|---|---|
| カーテンウォール | 1スパン幅 (8,400) × 階高いっぱいの `window` で「その面はガラス」と言う |
| 大開口エントランス | 4枚引き自動ドア2連 = 7,200 × 5,000 |
| 住戸掃き出し | 5,600 × 2,600 (`sill:200`) |
| パラペット + 手すり | `h:1200` / `air:1` — テラス・屋上庭園の縁 |

**`air:1` を書いた縁が、その空間を半屋外にする。**採光の係数も屋外の判定もそこから導かれる。

## 収益床の現実

- 事務所単用途の**基準階**レンタブル比は 70〜80%。**建物全体では 60〜70%** に落ちる (1階ロビー・機械階が食う)。
- 巨大複合はさらに下がる。同梱の `examples/twin/` の実測は次のとおりで、延床 141,448.56㎡ に対し収益床 (rentable + exclusive) は 46.8%、駐車場を除いた地上部だけなら 52.2% である。

```text
$ npx tsx src/cli.ts stats examples/twin/main.muro
Total 141448.56 m2 (indoor floor area)
Outdoor 24911.04 m2 (plazas, open ground and the like — not counted as floor area)
Semi-outdoor 6534.08 m2 (balconies, external stairs and the like — whether they count is a matter of regulatory detail, so it is reported separately)
By use: common 60487.47 m2 (42.8%) / parking 14868.00 m2 (10.5%) / rentable 63462.21 m2 (44.9%) / exclusive 2630.88 m2 (1.9%)
```

コア2本・機械階2層・ホール・宴会場・屋上緑化テラスが全部 common に積まれた正直な数字である。

```text
$ npx tsx src/cli.ts site examples/twin/main.muro
Site /site (敷地)
  Site shape: polygon with 14 vertices (a polygon declaration — given geometry)
  Site area: declared 23167.40 m2 / derived 23167.40 m2
  Road: /road-s (南側道路) width 25000mm / frontage 168000mm
  Road: /road-e (東側道路) width 18000mm / frontage 151200mm
  Road: /road-n (北側道路) width 16000mm / frontage 168000mm
  Building footprint (horizontal projection, rough): 9596.16 m2 → building coverage ratio 41.4%
  Total floor area: 141448.56 m2 → floor area ratio 610.5%
```

**レンタブル比を上げたければ板を深くするのではなく、コア断面を絞る。**デプスを深くすると窓なし床が増えるだけである。

## 次に

- [階をつなぐ](connect-storeys.md) — 決めた寸法で階段室とシャフトを置く
- [窓を開けて採光を通す](windows-and-daylight.md) — 窓面の検算
- [基準階を一度だけ書く](typical-floors.md) — 決めた基準階を一度だけ書く
