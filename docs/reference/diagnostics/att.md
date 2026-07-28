---
title: ATT — 属性
mode: reference
---

# ATT — 属性

ATT は三つある。すべてエラーである。

| コード | severity | 何を言うか |
|---|---|---|
| ATT01 | error | 解釈される属性の値が正の数値でない |
| ATT02 | error | 解釈される属性の値が決められた集合の外 |
| ATT03 | error | 台帳に無い鍵を、名前空間なしで書いた |

**書いたのに解釈されなかったものを、黙って落とさない。**これが三つに共通する一つの主張である。

黙殺が最も高くつくのは、その属性が**別の検査の入口になっている**ときである。`site:yes` と書くと敷地に関する判定が丸ごと走らなくなり、`h:35OO` と書くと高さの不変量 ([HGT01](./hgt.md)) が消え、`heigh:2400` は同じことを一字違いで起こす。どれも答えだけが静かに無くなる。

## 属性の三層

属性は三層に分かれている。**どの層に属するかは要素ごとの台帳が決める** — 同じ綴りでも、書く場所が違えば層が違う。

| 層 | koyu は | 例 |
|---|---|---|
| **構造** | 必ず見る。`parse` が型付きのフィールドへ持ち上げる | `space` の `level:` `w:`／`boundary` の `type:` `t:` `air:` `edge:`／開口の `w:` `h:` `at:` `edge:` `hinge:` `swing:`／`column` の `d:` `x:` `y:` |
| **解釈** | 見る。値域が決まっている | `space` の `h:` `use:` `road:` `daylight:` `ceiling:` `uid:` `name:` と縦動線の一式／`zone` の `name:` `use:` `site:` `area:` `uid:`／`boundary` の `h:` `name:`／開口の `style:` `name:` |
| **運搬** | **見ない。**運ぶだけ | `space` の `floor:` `spec:`／`boundary` の `spec:` `fire:` `sound:`／開口の `sill:` `spec:` `fire:`／`area` の `floor:` `spec:`／`seg` の `spec:` `fire:` `sound:`／`column` の `spec:` |

構造と解釈の層は koyu が読むので、台帳が契約である。運搬の層は運ぶだけなので、誰が何を書いてもよい。

**では未知の鍵はどちらなのか。**この問いに字面で答えられなければ、「見ていない」と「見て問題がない」を区別できない。だから運搬層に**名前空間**を要求する。

```text
spec:RC              台帳にある鍵。名前空間は要らない。koyu は運ぶだけ
acme.sensor:23       名前空間つき。誰でも書ける。koyu は絶対に見ない
heigh:2400           台帳に無く名前空間も無い → ATT03
```

名前空間は**ドット区切り**で、`^[a-z][a-z0-9_-]*(\.[a-z0-9_-]+)+$` に合う綴りである。小文字で始まり、ドットを一つ以上含む。`acme.sensor` `bems.temp` `survey.measured` `acme.sub.key` はすべて通り、`Acme.sensor` `acme.Sensor` `acme_x` は通らない。中身に koyu は一切の意味を与えない — 分割の規則すら持たない。

## ATT01 — 属性は正の数値で書きます

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:300
level L2 3000 h:2400 slab:300
space /L1/a room X1..X2 Y1..Y2 h:35OO
space /L2/a room X1..X2 Y1..Y2
```

```text
h on /L1/a is written as a positive number: h:35OO
```

**原因** — 数値のつもりで書いた値が数値として読めていない。`35OO` (数字の 0 でなく英字の O)、`3500mm` (単位つき)、`1/12` (分数) はいずれも文字列として運ばれ、読む側は「書かれていない」と見なす。0 と負数も弾く。

**正の数値を要求する鍵**は次のとおり。

| 要素 | 鍵 |
|---|---|
| `space` | `h` (天井高 mm)・`road` (幅員 mm)・`entry`・`landing`・`riser`・`tread`・`lane`・`slope` |
| `zone` | `area` (敷地の宣言面積 ㎡) |
| `boundary` | `h` (`air:1` の境界の天端高 mm) |

**直し方** — 単位のない正の数値にする。長さはすべて mm なので単位は書かない。斜路の `slope:` は**分母だけ**を書く — `slope:12` が 1/12 である。

## ATT02 — 属性の値が語彙にありません

`error`

```muro-bad
grid X 0 5000
grid Y 0 5000
level L1 0 h:2400 slab:150
zone /site name:敷地 site:yes
polygon /site 0,0 5000,0 5000,5000 0,5000
space /site/a room X1..X2 Y1..Y2 level:L1
```

```text
site on zone /site is one of 0 / 1: site:yes
```

**原因** — 値の集合が決まっている属性に、その集合の外の綴りを書いた。該当するのは四つだけである。

| 要素 | 鍵 | 値 |
|---|---|---|
| `zone` | `site` | `0` / `1` |
| `space` | `ceiling` | `0` / `1` (0 = 天井を張らない) |
| `space` | `turn` | `R` / `L` |
| 開口・`asset` | `style` | `hinged` / `sliding` / `auto` |

**大文字小文字は区別される。**`turn:l` は `turn:L` ではない。

**直し方** — 台帳の綴りに揃える。`site:1` は「このゾーンが敷地である」という宣言で、敷地の面積・接道・はみ出しの判定と `koyu site` の入口である。`site:yes` と書くと、この入口が閉じたまま `check` が緑になる。

`daylight` はこの表に無い。値域は [DAY01](./day.md) が別に守っている。

## ATT03 — 台帳に無い属性があります

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 heigh:2200
```

```text
/L1/a carries heigh:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.heigh:2200)
```

**原因** — その要素の台帳に無い鍵を、名前空間なしで書いた。**一字違いは黙って効かない** — `heigh:2200` は天井高にならず高さの不変量を丸ごと無音にし、`sit:1` は敷地の判定を、`stiar:N` は縦動線を消す。

**綴り間違いは検出される。**`nmae:居室A` も `flooring:tile` も ATT03 である。「解釈されない属性は自由に書けてそのまま運ばれる」ということはない — 自由に書きたいなら名前空間を付ける。

**直し方** — まず綴りを確かめる。本当に自由な値 (センサー値・実測・第三者の台帳) なら、ドット区切りの名前空間を付ける。

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 h:2200 acme.sensor:23 bems.temp:22.5
```

名前空間つきの属性に koyu は一切の意味を与えない。値域も検査せず、導出にも判定にも使わない。**持てるが判定しない**ことが字面で明示された状態であり、それがこの層の目的である。

## 母集団と並び

検査されるのは**書かれた宣言**である。走査は宣言の順で、次の順に一周する。

1. 空間 — その空間自身、続けてその `area`
2. ゾーン
3. 境界 — その境界自身、続けてその開口、続けてその `seg`
4. `asset`
5. `column`

診断の本文は、どの宣言かを言い方で区別する。

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X3 Y1..Y2 ceiling:none
  area X1..X1+1000 Y1..Y1+1000 flooring:tile
zone /L1 name:一階 areaa:100
space /out exterior
boundary /L1/a /out t:150 h:tall
  window w:1200 h:1100 edge:S at:0.5 styl:sliding
  seg w:900 edge:N at:0.5 sond:D45
column 600 L1 spek:RC
```

```text
ceiling on /L1/a is one of 0 / 1: ceiling:none
area (/L1/a) carries flooring:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.flooring:tile)
zone /L1 carries areaa:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.areaa:100)
h on boundary /L1/a | /out is written as a positive number: h:tall
window (/L1/a | /out) carries styl:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.styl:sliding)
seg (/L1/a | /out) carries sond:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.sond:D45)
column 600mm carries spek:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.spek:RC)
```

`asset` は開口と同じ台帳で読まれる。「アセットには書けて開口には書けない属性」は作らない、という同一視である。

## level だけは扱いが違う

`level` は属性の袋を持たない。`h:` `slab:` `pitch:` `underground:` はすべて型付きのフィールドで、それ以外の鍵は**パーサがその場で拒む**。だから `level` に対して ATT03 は出ない。

```text
level carries spec:, which is not in the ledger (level reads h / slab / pitch / underground)
```

`check --json` ではこれは [SYN01](./syn.md) として出る。

## 関連

- [DAY — 採光の対象](./day.md) — `daylight` の値域はここが守る
- [HGT — 高さの不変量](./hgt.md) — `h:` の誤記で消える検査
- [SIT — 敷地形状](./sit.md) — `site:` の誤記で消える判定
- [SYN — 構文と合成](./syn.md) — `level` の未知の鍵、属性キーの重複、引用符
- [koyu check](../cli/check.md)
