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
level L1 0 h:2400 slab:150
space /out exterior
space /L1/a room X1..X2 Y1..Y2 daylight:1
boundary /L1/a /out t:150
  window w:600 h:600 edge:S
```

`Insufficient daylight: /L1/a — effective window 0.36 m2 < required 2.31 m2 (1/7 of the 16.20 m2 floor)`

**原因** — 有効窓面積が床面積の 1/7 に足りない。有効窓面積は窓の `w × h` に係数を掛けた合計で、係数は窓の先が何かで決まる — 外部に直接面すれば 1.0、庇下 (上に空間がある半屋外) 越しなら 0.7、上が開いた半屋外 (庭・最上階バルコニー) 越しなら 1.0。

**直し方** — 窓を大きくするか増やす。`h` を書き忘れていないか確かめる (`h` の無い窓は数えられない)。判定の分母をどの粒度に置くか — 住戸まるごとか、割った室ごとか — は `daylight:1` を書く位置として書き手が決める。

<a id="daylight-unknown"></a>
### `daylight.unknown` — 窓面積を数え切れていません

`caution`

```muro-caution
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
space /out exterior
space /L1/a room X1..X2 Y1..Y2 daylight:1
boundary /L1/a /out t:150
  window w:3000 edge:S
```

`Window area is not fully counted: /L1/a has a window without h: (write h: on it)`

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
level L1 0 h:2700 slab:150
space /L1/a room X1..X2 Y1..Y2
space /L1/b room X2..X3 Y1..Y2
space /out exterior
boundary /L1/a /out edge:W t:200
boundary /L1/b /out t:150
```

`Perimeter not faced by any envelope: /L1/a — S 4000mm / N 4000mm (8000mm over 2 run(s)). Write a boundary to the exterior`

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

`Derived step dimensions are cramped: 17 risers of 176mm, tread 150mm (2*riser+tread = 502mm; expected 550-700mm)`

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

`Derived slope 1/1.3 is steeper than the declared 1/12 (lengthen the run or lower the storey height)`

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

`/L1/s has a vertical-circulation form but no vertical boundary connecting the levels (write stack or boundary type:stair — the form exists, but the graph cannot pass)`

**原因** — **形とトポロジーは別々に書かれる。**`stair:N` は段の形を作るが、階と階が繋がっているとは言っていない。垂直境界 (`stack` / `boundary type:stair`) が無ければ `doors` は上階へ抜ける経路を見つけない。図には階段が描かれるのに動線が通らない、という最も気付きにくい食い違いなので警告にしてある。

**直し方** — `stack s L1..L2 type:stair` を書く。逆に「形は要らないが繋がっている」場合 (EVシャフト等) は、空間の宣言を外して垂直境界だけを残す。


## 到達 — access / column

**check が緑でも建物が使えるとは限らない。**接する空間の既定は壁なので ([ADR-0014](../docs/decisions/0014-default-boundaries.md))、扉を一枚も宣言しない二階建ては緑のまま完全に密封される。この章は、その予言を旗艦例が実際に踏んだときに書かれた — 「床の無い吹抜けにしか扉が開かない区画が20」「他人の店舗を貫通する避難路」「車の出入口の無い2層の駐車場」「バックヤードの奥で孤立したエスカレーター」を、check 緑のまま抱えていたのである。

<a id="access-unreachable"></a>
### `access.unreachable` — 外部へ到達できません

`violation`

```muro-fail
grid X 0 4000
grid Y 0 5000
level L1 0 h:2700 slab:150
space /out exterior
space /L1/a room X1..X2 Y1..Y2
boundary /L1/a /out t:150
```

`Cannot reach the exterior: /L1/a (no passable boundary leads out — write a door)`

**原因** — 領域を持つ室から、通れる境界を辿って外部空間へ出られない。**問うのは扉の有無ではなく到達性である** — 扉を持っていても、その先が行き止まりなら出られない。ここでは外部への壁は書いたが、そこに開口が無い。シャフト (人が通れない)・吹抜け (床が無い)・外部そのものは対象外で、外部空間が一つも書かれていない模型では問わない。

**直し方** — 外部へ抜ける経路のどこかに `door` を書く。外部への境界は線分が複数になるので `edge:N/E/S/W` で辺を選ぶ。どこで切れているかは `koyu doors <file> <from> <to>` が最少扉数の経路で答える。

<a id="access-voidonly"></a>
### `access.voidonly` — 扉が吹抜けにしか開いていません

`violation`

```muro-fail
grid X 0 4000 8000
grid Y 0 5000
level L1 0 h:2700 slab:150
space /L1/v void X1..X2 Y1..Y2
space /L1/a room X2..X3 Y1..Y2
boundary /L1/a /L1/v type:open
```

`Doors open only onto a void: /L1/a (they open where there is no floor, so nobody can pass)`

**原因** — 通れる境界を持つのに、その行き先が全部 `type:void` である。吹抜けは空間としては連続するが床が無いので、扉は穴に向かって開いている — 出入りしたつもりでどこへも行けない。区画を吹抜けに面して並べ、廊下との境界を書き忘れると起きる。

**直し方** — 床のある隣 (廊下・階段室) へ扉を書く。吹抜けに面した縁が本当に開いているのなら、それは通行ではなく見下ろしなので `type:open` ではなく `air:1` の壁 (手すり) にする。

<a id="access-throughtenant"></a>
### `access.throughtenant` — 避難が賃貸区画を通ります

`caution`

```muro-caution
grid X 0 3000 9000
grid Y 0 6000
level L1 0 h:2700 slab:150
space /out exterior
space /L1/s stair X1..X2 Y1..Y2
space /L1/t room X2..X3 Y1..Y2 use:rentable
boundary /L1/s /L1/t
  door w:900
boundary /L1/t /out
  door w:1800 edge:S
boundary /L1/s /out t:150
```

`Escape from /L1/s passes through rentable space (if the tenant locks up, there is no way out)`

**原因** — 階段室から外部へ出るどの経路も `use:rentable` の空間を通る。テナントが施錠した瞬間、その階段は避難に使えなくなる。

**caution にしてある理由** — 通ってよいかは契約と管轄の側の事実であって、原本には書かれていない。賃貸区画の中に専用通路を通す設計は現にある。疑う値打ちはあるが、断じる根拠がここには無い。

**直し方** — 賃貸区画を避けて外部へ抜ける経路 (共用廊下・附室) を書く。階段室から直接外部へ出るなら、その境界に `door` を書く。

<a id="access-parking"></a>
### `access.parking` — 車が外部へ出られません

`violation`

```muro-fail
grid X 0 6000
grid Y 0 6000
level L1 0 h:2700 slab:150
space /out exterior
space /L1/p room X1..X2 Y1..Y2 use:parking
boundary /L1/p /out
  door w:900 edge:S
```

`No vehicle route to the exterior: /L1/p (needs an opening at least 2400mm wide, a type:open boundary, or a ramp)`

**原因** — `use:parking` の空間から車が出られない。**人は900mmの扉と階段で出られてしまうので `access.unreachable` では見えない。**車が通れるのは `type:open` の境界・幅2400mm以上の扉・斜路 (`ramp:` を持つ空間の縦連結) だけで、階段の縦連結は車にとってただの段差である。

**直し方** — 車路の開口を `door w:2400` 以上にするか、境界を `type:open` にする。地下や上階の駐車場なら、斜路の空間に `ramp:` を書いて `stack` で繋ぐ。

<a id="access-backofhouse"></a>
### `access.backofhouse` — 共用廊下からバックヤードを通らずに届きません

`caution`

```muro-caution
grid X 0 3000 6000 9000
grid Y 0 8000
level L1 0 h:2700 slab:300
level L2 3000 h:2700 slab:300
space /L1/c corridor X1..X2 Y1..Y2 use:common
space /L1/b backyard X2..X3 Y1..Y2
space /L1/e room X3..X4 Y1..Y2 use:common escalator:N
space /L2/e room X3..X4 Y1..Y2 use:common
stack e L1..L2 type:stair
boundary /L1/c /L1/b
  door w:900
boundary /L1/b /L1/e
  door w:900
```

`/L1/e cannot be reached from a common corridor without passing through back-of-house (visitors cannot use this vertical circulation)`

**原因** — 縦動線の宣言 (`stair:` / `escalator:` — [ADR-0021](../docs/decisions/0021-vertical-circulation.md)) を持つ共用の空間は客動線の一部なのに、共用廊下から `type:backyard` を通らずに届かない。当の空間へは**水平に**入れなければならない — 自分の縦連結を経由してよいことにすると「上の階からそのエスカレーターで降りてくれば乗り場に着く」という循環が成り立ち、孤立をそのまま素通しする。共用廊下 (`type:corridor` かつ `use:common`) が一つも無い建物には客動線の区別が無いので問わない。

**caution にしてある理由** — 「共用の縦動線はすべて客用」は粗い推定である。従業員用の共用階段を客用と読み違えることがある。

**直し方** — 共用廊下から直接届く位置へ動かすか、廊下との間に扉を書く。従業員用の縦動線なら `use:common` を外す。

<a id="column-blocksdoor"></a>
### `column.blocksdoor` — 柱が扉を塞いでいます

`violation`

```muro-fail
grid X 0 4000 8000
grid Y 0 5000 10000
level L1 0 h:2700 slab:150
space /L1/a room X1..X3 Y1..Y2
space /L1/b room X1..X3 Y2..Y3
column 600 L1
boundary /L1/a /L1/b
  door w:900 at:X2
```

`A column blocks a door: the door (900mm wide) on /L1/a | /L1/b overlaps the column at X2/Y2`

**原因** — **位置を書かない要素が二つあると、衝突は導出でしか分からない。**柱は通り芯の交点から ([ADR-0023](../docs/decisions/0023-columns.md))、扉は境界線分の上から (`at:` の比率か通り参照から) 導かれるので、どちらも原本には座標が無い。通り芯の交点は境界線分の上でもあるので、扉を通りに寄せると必ずぶつかる。

**直し方** — 扉を通りからずらす (`at:X2+900` のようにオフセットを足す)、柱を `x:` / `y:` で通りから外す、または壁の位置を変える。`koyu plan` の平面図で結果を確かめられる。


## 敷地 — site

<a id="site-escape"></a>
### `site.escape` — 敷地形状からはみ出しています

`violation`

```muro-fail
grid X 0 10000 14000
grid Y 0 10000
level L1 0 h:2400 slab:150
zone /site name:敷地 site:1
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
space /L1/a room X2..X3 Y1..Y2
```

`/L1/a escapes the site shape (near 14000,0)`

**原因** — 領域を持つ空間が敷地の外に出ている。四隅の内包だけでなく多角形の頂点の入り込みと辺の交差も見るので、凹んだ敷地でも正しく捕まる。境界上は内側扱い (許容1mm)。敷地ゾーン配下の空間 (`/site/…`) と `exterior` は検査の対象外である。

**直し方** — 割付を敷地内に収めるか、`polygon` の測量値を直す。メッセージが最初に見つけたはみ出し点の座標を出す。

<a id="site-area"></a>
### `site.area` — 敷地面積の宣言と導出が食い違います

`caution`

```muro-caution
grid X 0 10000
grid Y 0 10000
level L1 0 h:2400 slab:150
zone /site name:敷地 site:1 area:120.00
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X2 Y1..Y2 level:L1
```

`Declared and derived site areas disagree: declared 120 m2 / derived 100.00 m2`

**原因** — ゾーンの `area:` (測量値) と `polygon` から計算した面積が 0.05㎡ を超えてずれている。頂点の打ち間違いか、`area:` の転記ミスか、測量図の更新が片方にしか反映されていない。

**直し方** — どちらが正しいかを決めて片方を直す。`area:` は測量成果の転記なので、ふつう疑うべきは `polygon` の頂点である。`koyu site <file>` が両方の数字を並べて出す。


<a id="site-frontage"></a>
### `site.frontage` — 接道長が足りません

`violation`

```muro-fail
grid X 0 1500 10000
grid Y 0 10000 11000
level L1 0 h:2700 slab:150
zone /site name:敷地 site:1
polygon /site 0,0 10000,0 10000,10000 0,10000
space /site/yard yard X1..X3 Y1..Y2 level:L1
space /out/road-n exterior X1..X2 Y2..Y3 name:北側道路 road:4000 level:L1
boundary /site/yard /out/road-n
```

`Road frontage is too short: /out/road-n — 1500mm (needs at least 2000mm)`

**原因** — 敷地ゾーン配下の空間と、`road:` を持つ外部空間との境界線分の長さが 2m に足りない。接道長を導出しているのは core だが、**2m という下限は建築の側の規則**なので、判定はこの面が言う。

**直し方** — 道路に面する境界を書く。建物の外壁が道路に面する分は接道に数えないので、敷地 (`site:1` ゾーン配下の外構タイル) と道路の間に境界が要る。
