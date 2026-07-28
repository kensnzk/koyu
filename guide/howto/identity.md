[English](../en/howto/identity.md) · **日本語**

# 改名を跨いで指せるようにする (uid と name)

パスは変わる。改名・階層再編・分割統合でパスが変われば、それを外部キーにしていたセンサー・BEMS・台帳との対応は切れる。**寿命がパスより長い参照が要るところにだけ、同一性を書き足す。**

以下の出力例のファイルパスは、実際には絶対パスで出る。読みやすさのためディレクトリの頭を縮めてある。

規範は [spec/scope.md §5](../../spec/scope.md)、決定の理由は [ADR-0015](../../docs/decisions/0015-identity-uid.md) と [ADR-0039](../../docs/decisions/0039-identity-generation.md)。

## 前提

- `check` がエラー0で通っている `.muro` があること。
- **必須ではない。**書かない空間はパスで対応づく。時点をまたいで指す必要がある空間にだけ書けばよい。

## 手順

### 1. どこに書けるかを知る

`uid:` を書けるのは **`space` と `zone` の二つだけ**である。この一覧は閉じている。

```muro
koyu 1.0
name 事務所
unit mm

grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2700 slab:150

space /L1/office room X1..X2 Y1..Y2 uid:u-7f3k9m2qx4b8dhtv
space /L1/meeting room X2..X3 Y1..Y2
space /out exterior

boundary /L1/office /L1/meeting t:120
  door w:900 h:2000 name:D1
boundary /L1/office /out t:150
  door w:900 h:2100 edge:S name:ENT
```

境界・開口・`seg`・`area`・柱・アセットに `uid:` を書くとエラーになる。**黙って無視されることはない。**

```muro-bad
grid X 0 3600
grid Y 0 4500
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /out exterior
boundary /L1/a /out t:150 uid:bd-1
  door w:900 h:2100 edge:S
```

```text
✖ …/bad.muro:line 6: boundary /L1/a | /out carries uid:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.uid:bd-1)
```

関係の同一性は両端の空間から導かれるので、境界に uid は要らない。開口と柱の同一性は `name:` が担う ([手順 5](#5-開口と柱は-name-で指す))。

### 2. トークンを作る

**自分で書いてもよい。**数字だけの形と空白だけが禁じられている (UID01 / UID02) ので、`sp-ldk-north` のような読める綴りも書ける。

**機械に作らせるなら、乱数のトークンを受け取る。**エージェント (MCP) からは `new_uids` を呼ぶ。

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"new_uids","arguments":{"file":"main.muro","count":2}}}
```

```text
{
 "uids": [
  "u-0qf4x7f0j0kzm8yq",
  "u-c4aa7yn1ew091p9f"
 ],
 "note": "Write these as uid: on a space or zone. …"
}
```

プログラムからは同じものが公開 API にある。

```ts
import { newUids } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const model = parseFile("main.muro");
const [uid] = newUids(model);
```

**返ってきたトークンは、そのモデルの中では衝突しない。**まだ合成されていない層や別のリポジトリとの非衝突は 80 ビットの乱数による確率的な保証なので、書き足したら `check` を通す — 一意性を実際に証明するのは UID03 だけである ([spec/scope.md §5.2](../../spec/scope.md))。

**自分から uid を付けるツールは無い。**`write_layer` も付けない。付与は明示の行為である。

### 3. 改名して、対応が残っていることを確かめる

`/L1/office` を `/L1/studio` に改名して `koyu diff` を取る。

```text
renamed /L1/office → /L1/studio (uid:u-7f3k9m2qx4b8dhtv)
```

**同じ空間の改名として報告される。**uid を書いていなければ、同じ編集はこうなる。

```text
+ space /L1/studio (room 16.20 m2)
− space /L1/office (room 16.20 m2)
+ boundary /L1/meeting | /L1/studio (wall t:120)
+ boundary /L1/studio | /out (wall t:150)
− boundary /L1/meeting | /L1/office
− boundary /L1/office | /out
```

空間が消えて生え、境界も一緒に消えて生える。外部の台帳が `/L1/office` を持っていたら、その行は宙に浮く。

### 4. uid は自分では動かない

**改名しても uid は書き換えない。**「改名後も同じ空間か」は幾何や名前から機械的には決まらない設計判断であり、uid を運ぶ行為そのものがその判断の記録である。

- **分割** — 本体側が継ぎ、他方は新しい uid を受け取る
- **統合** — 残る側が継ぐ

同一性には責任を持ち、内容には持たない。

### 5. 開口と柱は `name:` で指す

開口・`seg`・`area`・柱に uid は書けない。同一性は「**含む対象 + その中で一意な名**」から導かれる。

```muro-part
boundary /L1/office /L1/meeting t:120
  door w:900 h:2000 name:D1
```

この名が、合成の集合編集が指す先である。

```muro-part
over /L1/office /L1/meeting
  = door D1 w:1000
```

名は**含む対象の中で**一意でなければならない。二つを指していれば UID04 で落ちる ([diagnostics.md](../diagnostics.md#uid04))。

アセットから継いだ名は数えない。`asset W1 window … name:掃き出し窓` の `name` は型の名なので、同じ建具を一枚の壁に二枚並べても衝突にはならない。

### 6. 名の付いた開口を動かすと、移動として出る

`door D1` の位置を `at:X2-1200` へ動かして `koyu diff` を取る。

```text
± boundary /L1/meeting | /L1/office: door D1 at 0.5 → X2-1200
```

名が無ければ同じ編集は「消えて生えた」として出る。**名を書く行為が、同一性の宣言である。**

## 落ちるところ

| 症状 | 原因 |
|---|---|
| `uid:0123` がエラーになる | 数値の形の属性値は数値になり、書いたトークンの区別が失われる (UID01)。`uid:sp-0123` のように数字以外を混ぜる |
| `uid:` を書いたのにエラーになる | 書ける対象は `space` と `zone` だけである (ATT03)。`level` に書けば構文エラー |
| `acme.uid:` は通るが `diff` が改名を検出しない | 名前空間つきのキーは運搬層で、core は見ない ([spec/scope.md §7](../../spec/scope.md)) |
| `= window W1` が「not unique」で落ちる | 一つの境界に同じ名の開口が二つある。`check` の UID04 が同じことを言う |
| `import` で別の層と uid が衝突する (UID03) | 層ごとに接頭辞を決めるか、`new_uids` に作らせる |

---

関連: [split-into-files.md](split-into-files.md) (層に割る) · [agent-mcp.md](agent-mcp.md) (MCP の使い方) · [concepts.md §4](../concepts.md) (パスが三役を兼ねること)
