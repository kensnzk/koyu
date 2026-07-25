# 機械形式リファレンス — 正準JSON

koyu v0.11.0 現在。`koyu json <entry>` / `toCanonical(model)` が出力する。author形式 (.muro) が人とLLMの原本、正準JSONは機械の土台 — diff・ハッシュ・レイヤー合成・外部接続 (RDF等) はこの上に作る。

## 安定性の規則 (この形式の存在理由)

1. **同じ構成からは常にバイト同一のJSONが出る。** すべてのオブジェクトキーはソートされ、`spaces` はパス順、`boundaries` は `between` の辞書順 (同一 `between` は内容の正準順)、`zones`・`assets`・`polygons` はキー順に並ぶ。**宣言順に意味の無い配列 (openings・segs・areas・領域合併) も内容の正準順に並ぶ** — 同じ構成を別の行順で書いても同じバイト列になる (ADR-0013)。
2. **合成後の、書かれた構成である。** import・スパン・stack・**帯 (band)** は展開済みで残らない。既定境界 (derived — ADR-0014) は出ない — 正準JSONは書かれた構成のみで、意味 (既定壁を含む) は導出後のModelが持つ。消費者は `deriveDefaultBoundaries` を適用してから意味を読むこと。
3. **書かれた表記を保存する。** 位置は通り参照のまま (`"at": "Y2+1820"`)、領域は通り名4つ組、**境界の向きは `a` キー** (先に書いた空間 — `edge`/`swing` はこの側から読む。ADR-0013で追加: これが無いとJSONだけでは開き勝手を復元できない) — 正準形は語り直さない。例外は意味を持たない綴りだけ: 領域の逆順表記 (`X2..X1`) は座標昇順に正規化される。polygonの頂点列は幾何 (巡回) なので並べ替えない。帯 (band — language.md §3) が導出する内側の切り位置は、書かれた綴りが存在しないため**床規則**で綴られる: その座標以下で最も大きい通り芯からのオフセット (オフセット0なら通り名だけ)。帯の両端と直交方向の両端は書かれた綴りのままである。

## スキーマ

```jsonc
{
  "koyu": "0.2",                        // 言語版 (宣言値の素通し。schema版はツール版 — 本書ヘッダ — が契約)
  "name": "…",                          // 任意
  "unit": "mm",
  "grid": { "X": [0, 6400, …], "Y": [0, 5600, …] },   // 座標配列 (通り名は X1.. が暗黙)
  "levels": { "L1": { "z": 0, "h": 3600, "slab": 600 }, … },
  "assets": { "SD1": { "kind": "door", "attrs": { "w": 800, "style": "sliding", … } }, … },   // 任意
  "polygons": { "/site": [[-2600, -7000], [38000, -7000], …] },                               // 任意
  "zones": { "/L3/A": { "attrs": { "name": "Aタイプ", "use": "exclusive" } }, … },            // 任意
  "spaces": {
    "/L5/A/ldk": {
      "type": "ldk",
      "level": "L5",                     // 明示の level: (パス先頭と異なる所属 — メゾネット等) のみ。既定 (パス先頭) は省略
      "at": [["X1+3200","Y1","X2+3200","Y1+4000"], ["X2+3200","Y1","X3","Y1+2400"]],  // 矩形1つなら平坦な4つ組
      "attrs": { "name": "LDK", "floor": "オーク" },
      "areas": [{ "at": ["X1","Y1-4600","X2","Y1-2600"], "attrs": { … } }]            // 任意
    }, …
  },
  "boundaries": [
    {
      "between": ["/L5/A/hall", "/L5/corridor"],    // 昇順の2パス
      "a": "/L5/A/hall",                             // 書かれた向き — edge/swingはa側から読む
      "kind": "wall",                                // wall|open|stair|shaft|void
      "t": 180, "air": true, "edge": "S",            // それぞれ任意
      "attrs": { "spec": "RC" },                     // 任意
      "openings": [{ "kind": "door", "ref": "D1", "w": 900, "h": 2100,
                     "at": "X4",                     // 比率なら数値、通り参照なら文字列
                     "edge": "S", "hinge": "E", "swing": "b",   // 任意
                     "attrs": { "name": "玄関", "style": "hinged" } }],
      "segs": [{ "w": 1800, "at": "X5", "edge": "S", "attrs": { "spec": "受付ガラス" } }]
    }, …
  ]
}
```

省略規則: 値の無いキー (h・slab・t・edge・attrs等) は出力されない。空のブロック (assets/polygons/zones/areas/openings/segs) も出力されない。属性値は数値の形なら数値、それ以外は文字列。

## 実装の正

`src/model.ts` の `toCanonical()` が正であり、本書はその写しである。乖離したらどちらを直すかをその場で決め、specを合わせる。
