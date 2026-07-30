---
title: stack — 縦の境界を階に渡す
mode: reference
---

# stack — 縦の境界を階に渡す

垂直に貫く空間 — 階段室・EVシャフト・吹抜け — は、階ごとに同じ関係を書き直すことになる。`stack` はその関係を**一度書いて全階に渡す**一語である。

```text
stack <名> <レベル範囲> type:stair|shaft|void [属性...]
```

`<名>` はパスの**末尾のセグメント**であり、`/` で始まらない。レベル範囲は `L1..L11` の形で、`type:` は必須である。

```muro-part
stack st1 L1..L11 type:stair
stack st2 L1..L11 type:stair
stack ev  L1..L11 type:shaft
```

これは「連続するレベルの対ごとに、垂直の境界を一本ずつ張る」と書いたのと同じである。`stack ev L1..L3 type:shaft` は次の二行になる。

```muro-part
boundary /L1/ev /L2/ev type:shaft
boundary /L2/ev /L3/ev type:shaft
```

## 型はトポロジーだけを言う

垂直の隣接の既定は**床**である。書かないかぎり、上下に重なる空間の間には床がある。`stack` が宣言するのはその例外であり、型は三つしかない。

| 型 | 意味 |
|---|---|
| `stair` | 通れる。階段も斜路もエスカレーターもここに入る |
| `shaft` | 連続するが人は通れない (EVシャフト・ダクト) |
| `void` | 床が無い (吹抜け) |

**縦の通行可能性は `stair` の一語が引き受ける。**階段も斜路もエスカレーターもトポロジーは同じなので、型は増やさない。装置の違いは空間の側の宣言 — `stair:` `ramp:` `escalator:` `lift:` — が形の生成規則として持つ ([縦動線](vertical-circulation.md))。

```text
✖ c.muro:line 13: A stack type is stair / shaft / void: undefined
✖ b.muro:line 11: A stack type is stair / shaft / void: floor
```

## 属性は全ての対に配られる

`type:` 以外の `key:value` は、生成される境界のすべてに同じ値で載る。

```muro-part
stack a L1..L3 type:stair spec:RC name:主階段
```

```json
{
  "between": ["/L1/a", "/L2/a"],
  "a": "/L1/a",
  "kind": "stair",
  "attrs": { "name": "主階段", "spec": "RC" }
}
```

境界の `name:` と、`stack` の第一引数である末尾セグメントは別物である。前者は境界の表示名、後者は空間パスの一部である。

## 対応する空間が要る

`stack` は境界を作るだけで、空間は作らない。範囲の**すべてのレベル**に `/Lk/<名>` の空間が無ければ、`check` が未定義の空間として止める。

```text
✖ b.muro:line 11: References an undefined space: /L3/st
```

空間の側は [スパン展開](#スパン展開) で一行で書けるので、対になる二行はこう並ぶ。

```muro-part
space /L1..L3/st stair X1..X2 Y1..Y2 name:階段 use:common stair:N form:return
stack st L1..L3 type:stair
```

## stack は残らない

`stack` は parse の時点で普通の `boundary` へ展開される。**モデルにも正準JSONにも `stack` は残らない。**一行で書いた版と、対ごとに手で書いた版は、同じ正準JSONを与える。

---

## スパン展開

`stack` のレベル範囲と同じ綴りが、`space` `zone` `boundary` のパスの**先頭セグメント**でも使える。

```muro-part
space /L2..L9/B unit X2..X3 Y1..Y2 name:Bタイプ use:exclusive
zone /L3..L10/A name:Aタイプ use:exclusive
boundary /L2..L9/A/ldk /L2..L9/A/hall t:100 spec:LGS
  door w:800 name:D
```

基準階を一度だけ書くための記法である。展開されるのは**先頭セグメントだけ**で、パスの途中に書いた `..` は展開されない。

### 並びは z 順であって、名前の連番ではない

`L1..L2` は「宣言済みのレベルのうち、z が両端の間 (両端を含む) にあるものを z の昇順に並べたもの」に展開される。**名前が連番かどうかは見ない。**

```muro-part
level L1 0  h:2000 slab:200
level M1 2200 h:2000 slab:200
level L2 4400 h:2700 slab:300
space /L1..L2/a room X1..X2 Y1..Y2 name:室
```

この一行は `/L1/a` `/M1/a` `/L2/a` の**三つ**の空間になる。中2階を範囲に入れたくなければ、範囲を分けて二行書く。

### 範囲の綴り

レベル名は `英字+数字` の形でなければスパンに使えない。`R` や `PH` のような数字を持たない名は、範囲の端にできない。

```text
✖ b.muro:line 11: Cannot read the level range: L1..R
```

範囲の端は宣言済みでなければならず、逆順は拒まれる。

```text
✖ b.muro:line 11: The range includes an undeclared level (declare level first): L1..L9
✖ b.muro:line 11: The range runs backwards: L2..L1
```

### 一行の中の範囲は一つに揃える

`boundary` のように一行が二つのパスを取るとき、両方のスパンは同じでなければならない。「2階から9階までの A と、1階の B を結ぶ」のような書き方はできない。

```text
✖ b.muro:line 12: Level ranges on one line must agree: L1..L3, L1..L2
```

### 字下げした行は全ての展開に載る

展開される行の下に字下げして書いた `door` / `window` / `seg` / `area` は、**展開されたすべて**に付く。扉を一度書けば全階に載る。

```muro-part
boundary /L1..L3/a /L1..L3/b t:100 spec:LGS
  door w:800 name:D
```

三階建てなら、この二行から境界が三本、扉が三枚出る。

### スパンも残らない

スパン展開も parse の時点で普通の宣言に開かれる。展開後のパスが正準JSONに並び、`..` の綴りは残らない。

---

## 縦を組む二行

垂直に貫く空間は、**空間の列**と**関係の列**の二つが揃って初めて建物になる。片方だけでは通れない。

```muro-part
space /L1..L3/st stair X1..X2 Y1..Y2 name:階段 use:common stair:N form:return
space /L1..L3/ev shaft X2..X3 Y1..Y2 name:昇降機 use:common lift:1

stack st L1..L3 type:stair
stack ev L1..L3 type:shaft
```

空間の側の `stair:` `lift:` が形を決め、`stack` の側の `type:stair` `type:shaft` がトポロジーを決める。**形があってもグラフが繋がっているとは限らない** — 形だけを書いて `stack` を落とすと、`koyu validate` が `run.disconnected` で言う。

階を跨ぐ関係はどの階の層にも属さないので、ファイルを分けて書くときは entry (base層) に置くのが自然である ([import](import.md))。

## 関連

- [縦動線](vertical-circulation.md) — `stair:` `ramp:` `escalator:` `lift:` と、形の導出
- [boundary](boundary.md) — 境界の宣言、水平と垂直の型
- [space](space.md) — 空間の宣言とパス
- [import](import.md) — 階を跨ぐ関係をどの層に置くか
