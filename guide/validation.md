[English](en/validation.md) · **日本語**

# 判定の事典 — 検証の面

**この頁は `check` の頁ではない。**`check` が言うのは「書かれたものがデータとして矛盾していない」までであって、建築として妥当かは何も言わない ([spec/scope.md](../spec/scope.md))。採光が足りるか、外皮が閉じているか、階段が登れるか、敷地に収まるか — 建築の側の判断はすべて `koyu validate` が返す。

引き方も綴りも core と分けてある。診断は `BND04` のようなコードと `error`/`warning` を持ち、判定は `daylight.ratio` のような**規則名**と `violation`/`caution` を持つ。二つは型からして別物で、混ぜられない。

```sh
koyu validate examples/tower/main.muro          # 人向け
koyu validate examples/tower/main.muro --json   # Finding[] を JSON で
```

**この面は凍らない。**規則は増えるし、精度も上がるし、捨てられることもある。凍るのは core だけである — だからここは安く直せる。規則の台帳 (規則名・level・概要) は [spec/validation.md](../spec/validation.md) が持つ。

## level と終了コード

| level | 意味 | `koyu validate` の終了コード |
|---|---|---|
| `violation` | 判定の規則が守られていない | 1 |
| `caution` | 疑わしい・数え切れていない | 0 |

`check` の `error`/`warning` とは**別の軸である**。判定が緑でも構成が壊れていることはあるし、その逆もある。

## 採光 — daylight

採光の対象は宣言である ([ADR-0020](../docs/decisions/0020-daylight-scope-is-declared.md)) — `daylight:1` を書いた室にだけ 1/7 の判定が掛かる。core が返すのは床面積と有効窓面積という**数**だけで、1/7 を掛けるのはこの面である。補正係数は掛けない粗い判定で、基本計画の解像度に合わせた早期警報である。

<a id="daylight-ratio"></a>
### `daylight.ratio` — 採光が足りません

`violation`

```muro-fail
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400
space /out exterior
space /L1/a room X1..X2 Y1..Y2 daylight:1
boundary /L1/a /out t:150
  window w:600 h:600 edge:S
```

`採光が足りません: /L1/a — 有効窓 0.36㎡ < 必要 2.31㎡ (床 16.20㎡ の 1/7)`

**原因** — 有効窓面積が床面積の 1/7 に足りない。有効窓面積は窓の `w × h` に係数を掛けた合計で、係数は窓の先が何かで決まる — 外部に直接面すれば 1.0、庇下 (上に空間がある半屋外) 越しなら 0.7、上が開いた半屋外 (庭・最上階バルコニー) 越しなら 1.0。

**直し方** — 窓を大きくするか増やす。`h` を書き忘れていないか確かめる (`h` の無い窓は数えられない)。判定の分母をどの粒度に置くか — 住戸まるごとか、割った室ごとか — は `daylight:1` を書く位置として書き手が決める。

<a id="daylight-unknown"></a>
### `daylight.unknown` — 窓面積を数え切れていません

`caution`

```muro-caution
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400
space /out exterior
space /L1/a room X1..X2 Y1..Y2 daylight:1
boundary /L1/a /out t:150
  window w:3000 edge:S
```

`h を持たない窓があるため窓面積を数え切れていません: /L1/a (window に h: を書きます)`

**原因** — `h` を持たない `window` は面積が決まらないので数から落ちている。落ちたことを黙っていると、足りているのか数えていないのかが区別できない。

**直し方** — その窓に `h:` を書く。採光に関係しない窓 (物入れの点検口など) なら、その室から `daylight:1` を外す。

## 外皮 — envelope


壁は境界から現れるが、**外部への境界だけは導出されない** — 既定境界 (ADR-0014) は領域を持たない空間との間には導かれず、相手を名指すことが情報だからである。その結果、外部への境界の書き忘れは**黙って壁の不在**になる。図を見て気づくしかなかったものを、言葉にするためのコードである ([ADR-0025](../docs/decisions/0025-envelope-gaps.md))。

<a id="envelope-gap"></a>
### `envelope.gap` — 外皮に面していない外周があります

`caution`

```muro-caution
grid X 0 4000 8000
grid Y 0 5000
level L1 0 h:2700
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out exterior
boundary /L1/a /out edge:W t:200
boundary /L1/b /out t:150
```

`外皮に面していない外周があります: /L1/a — S 4000mm / N 4000mm (合計 8000mm・2区間)。外部への境界を書きます`

**原因** — `/L1/a` の外周のうち、隣の `/L1/b` と接する東面以外 (北・南・西の残り) が、他の空間とも宣言された境界とも向かい合っていない。西面には境界を書いたので**このレベルの外皮を書き始めている**と判断され、残りの穴が数えられる。

**検査するのは「書き始めたなら閉じきる」という整合であって、完全性ではない。**外部への境界が一本も無いレベルは、外皮をまだ模型にしていないだけなので何も言わない — 二室一扉のような最小の例に警告を出さないためである。外部空間・半屋外 (導出)・`site:1` ゾーン配下の外構タイルも、囲われていないのが正常なので数えない。

**直し方** — 残りの辺に境界を書く。`edge:N/E/S/W` で辺を選ぶか、辺を限定しない一本で残り全部を受ける。壁が要らない開放的な縁なら `type:open` を、手すりなら `air:1` を書く — **どれも「書かない」とは違う**。


## 縦動線 — stair / run

<a id="stair-proportion"></a>
### `stair.proportion` — 導出された段の寸法が窮屈です

`caution`

```muro-caution
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y1+4600 stair:N
space /L2/s stair X1..X2 Y1..Y1+4600
stack s L1..L2 type:stair
```

`導出された段の寸法が窮屈です: 17段 蹴上176mm / 踏面150mm (2×蹴上+踏面 = 502mm、目安 550〜700mm)`

**原因** — **段数も踏面も原本には書かれていない。**階高と領域から導かれる。だからこそ「導いた結果が使える寸法か」を検査する価値がある ([ADR-0021](../docs/decisions/0021-vertical-circulation.md) — 書かないが検査する)。ここでは階段室が浅すぎて踏面が150mmになった (4600mmの奥行から乗り込みの床1100mm×2を引いた2400mmを、16の踏面で割る)。

**直し方** — 階段室を走る向きに深くする、`form:return` で折り返す、`riser:` を上げて段数を減らす、のいずれか。これは寸法の警告であって法適合の判定ではない。

折返しでは走りごとに踏面が違う。検査は**最も窮屈な走り**を見るので、表示される踏面もその走りの値である。

<a id="run-slope"></a>
### `run.slope` — 導出された勾配が宣言より急です

`caution`

```muro-caution
grid X 0 3000 6000
grid Y 0 6000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/r ramp X1..X2 Y1..Y2 ramp:N slope:12
space /L2/r ramp X1..X2 Y1..Y2
stack r L1..L2 type:stair
```

`導出された勾配 1/1.3 が宣言 1/12 より急です (走り長を伸ばすか階高を下げます)`

**原因** — 勾配も書かれない。レベル差 ÷ 導出された走り長で決まる。`slope:` は**書く勾配ではなく許容する勾配の上限**で、検査のためだけにある。エスカレーターには `slope:` を書かなくても常用域 (約1/1.7 = 30度) から外れたときに同じコードが出る。

**直し方** — 斜路の領域を走る向きに伸ばす、`form:return` で折り返して走り長を倍にする、または階高を下げる。

<a id="run-disconnected"></a>
### `run.disconnected` — 上下を繋ぐ垂直境界がありません

`caution`

```muro-caution
grid X 0 3000 6000
grid Y 0 8000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/s stair X1..X2 Y1..Y1+7000 stair:N
space /L2/s stair X1..X2 Y1..Y1+7000
```

`/L1/s は縦動線の形を持ちますが、上下を繋ぐ垂直境界がありません (stack か boundary type:stair を書きます — 形はあってもグラフでは通れません)`

**原因** — **形とトポロジーは別々に書かれる。**`stair:N` は段の形を作るが、階と階が繋がっているとは言っていない。垂直境界 (`stack` / `boundary type:stair`) が無ければ `doors` は上階へ抜ける経路を見つけない。図には階段が描かれるのに動線が通らない、という最も気付きにくい食い違いなので警告にしてある。

**直し方** — `stack s L1..L2 type:stair` を書く。逆に「形は要らないが繋がっている」場合 (EVシャフト等) は、空間の宣言を外して垂直境界だけを残す。


## 敷地 — site

<a id="site-escape"></a>
### `site.escape` — 敷地形状からはみ出しています

`violation`

```muro-fail
grid X 0 10000 14000
grid Y 0 10000
level L1 0
zone /site name:敷地 site:1
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
space /L1/a room X2..X3 Y1..Y2
```

`/L1/a が敷地形状からはみ出しています (14000,0 付近)`

**原因** — 領域を持つ空間が敷地の外に出ている。四隅の内包だけでなく多角形の頂点の入り込みと辺の交差も見るので、凹んだ敷地でも正しく捕まる。境界上は内側扱い (許容1mm)。敷地ゾーン配下の空間 (`/site/…`) と `exterior` は検査の対象外である。

**直し方** — 割付を敷地内に収めるか、`polygon` の測量値を直す。メッセージが最初に見つけたはみ出し点の座標を出す。

<a id="site-area"></a>
### `site.area` — 敷地面積の宣言と導出が食い違います

`caution`

```muro-caution
grid X 0 10000
grid Y 0 10000
level L1 0
zone /site name:敷地 site:1 area:120.00
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
```

`敷地面積の宣言と導出が食い違います: 宣言 120㎡ / 導出 100.00㎡`

**原因** — ゾーンの `area:` (測量値) と `polygon` から計算した面積が 0.05㎡ を超えてずれている。頂点の打ち間違いか、`area:` の転記ミスか、測量図の更新が片方にしか反映されていない。

**直し方** — どちらが正しいかを決めて片方を直す。`area:` は測量成果の転記なので、ふつう疑うべきは `polygon` の頂点である。`koyu site <file>` が両方の数字を並べて出す。


<a id="site-frontage"></a>
### `site.frontage` — 接道長が足りません

`violation`

```muro-fail
grid X 0 1500 10000
grid Y 0 10000 11000
level L1 0 h:2700
zone /site name:敷地 site:1
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X3 Y1..Y2 level:L1
space /out/road-n exterior X1..X2 Y2..Y3 name:北側道路 road:4000 level:L1
boundary /site/yard /out/road-n
```

`接道長が足りません: /out/road-n — 1500mm (2000mm 以上)`

**原因** — 敷地ゾーン配下の空間と、`road:` を持つ外部空間との境界線分の長さが 2m に足りない。接道長を導出しているのは core だが、**2m という下限は建築の側の規則**なので、判定はこの面が言う。

**直し方** — 道路に面する境界を書く。建物の外壁が道路に面する分は接道に数えないので、敷地 (`site:1` ゾーン配下の外構タイル) と道路の間に境界が要る。
