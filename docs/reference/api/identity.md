---
title: 同一性の生成
mode: reference
---

# 同一性の生成

```ts
import { newUids } from "@kensnzk/koyu";

function newUids(model: Model, count?: number): string[]
```

改名を跨ぐ同一性トークン (`uid`) を作る。

## パスは同一性、uid は永続同一性

**空間の同一性はパスである。**`/L1/a` と書けばそれが名前であり、参照であり、集計の階層である。ほとんどの場面ではそれで足りる。

`uid` が要るのは**改名を跨ぎたいときだけ**である。`/L1/a` を `/L1/study` に改める編集は、パスだけで見れば「一つ消えて一つ生えた」である。同じ `uid` が両側にあれば、[`semanticDiff`](diff.md) はそれを**改名**として読む。

**書ける対象は `space` と `zone` の二つに閉じている。**境界にも開口にも `uid` は書けない — 境界の対応は両端の空間が継ぎ、開口の同一性は「含む対象 + その中で一意な名」から導かれるからである。

## 綴り

**接頭辞 `u-` + 16字、合わせて18字。**

字母は Crockford base32 の小文字 — `0123456789abcdefghjkmnpqrstvwxyz` で、`i` `l` `o` `u` を持たない。**接頭辞の `u` は字母に無い**ので、生成された uid は必ず一つだけ `u` を持ち、それが先頭である。

16字 × 5ビット = **80ビット**の乱数である。

接頭辞があるのは、**数字だけの綴りを構造的に不可能にするため**である。数字だけの uid は数値化でトークンの区別が失われる (`UID01` がそれを咎める)。**種別は綴りに入らない** — uid は不透明であり、綴りから何かが読めてはならない。

## 導出しない

**パスからも、モデルの中身からも導出しない。**導出すれば改名でトークンが変わり、uid の意味 — 改名を跨ぐこと — が消える。

```ts
import { newUids } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const m = parseFile("examples/two-rooms.muro");
const [uid] = newUids(m);
console.log(uid, uid.length);
console.log(newUids(m, 3));
```

```text
u-8f46209ddmchp1s3 18
[ 'u-bhg27d8dj7t99yem', 'u-nx4qx6byyffnjn25', 'u-07ezg6wz054k33tk' ]
```

**乱数なので、実行のたびに違うトークンが出る。**上の出力もその一回ぶんである。

`count` は正の整数でなければならない。

```ts
try { newUids(m, 0); } catch (e) { console.log((e as Error).name + ": " + (e as Error).message); }
```

```text
RangeError: count is a positive integer: 0
```

## 保証は二段である

1. **合成済みのこのモデルとは衝突しない。**モデルの中の既存の `uid` (空間とゾーンの両方) を集めて検査してから返すので、これは確実である。
2. **まだ合成されていない層・他のリポジトリとは、確率でしか衝突しない。**80ビットの乱数なので、100万個を集めても衝突確率は 10⁻¹² を下回る。

**確実さが要るなら、合成して検査する。**一意性を実際に証明するのは `UID03` だけである。

## 付与は明示の行為である

**この関数を呼ばないかぎり、どのツールも uid を書かない。**自動で振られることは無い。改名を跨ぐ必要が出た要素にだけ、書き手が付ける。

## 検査

`uid` は三つの診断が守っている。

| コード | 何を咎めるか |
|---|---|
| `UID01` | 数字だけの uid |
| `UID02` | 空白を含む uid |
| `UID03` | uid の重複 |

```ts
import { checkDiagnostics, parse } from "@kensnzk/koyu";

const bad = parse(`grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 uid:12345
space /L1/b room X2..X3 Y1..Y2 uid:u-abc uid2:x`);
for (const d of checkDiagnostics(bad)) console.log(d.code, d.severity, d.message);
```

```text
ATT03 error /L1/b carries uid2:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.uid2:x)
UID01 error A uid cannot be a token of digits alone: uid:12345 (write something like sp-12345)
```

**`u-abc` は咎められない。**`newUids` の綴りは生成の規則であって、受理の条件ではない — 手で書いた短いトークンも、数字だけでなく空白を含まず重複しなければ通る。

## 使う

```ts
import { newUids } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const m = parseFile("examples/house/main.muro");
const targets = ["/home/ldk", "/home/bed1"];
const uids = newUids(m, targets.length);

for (const [i, path] of targets.entries()) {
  console.log(`${path} → uid:${uids[i]}`);
}
```

出た行を `.muro` に書き足したら、**合成して検査する** — そこで初めて `UID03` が一意性を証明する。

## 関連

- [意味差分](diff.md) — uid が改名として読まれる場所
- [空間を書く](../muro/space.md) — `uid:` の書き方
- [診断リファレンス](../diagnostics/uid.md) — `UID01`〜`UID04` の直し方
