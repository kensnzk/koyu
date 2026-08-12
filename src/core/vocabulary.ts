// koyu core — 属性の台帳 (docs/reference/muro/attributes.md の写しであり、実装の唯一の出所)
//
// # 属性の三層 (docs/reference/scope.md)
//
//   構造 (structure)     パス・区画・レベル・関係の相手・kind。**必ず見る**。
//                        空間の**型は入らない** — 自由なラベルであり core は読まない (ADR-0051)
//                        parse が typed field へ持ち上げるので、check の時点では attrs に残らない
//   解釈 (interpreted)   台帳が値域を定義し、**見る**。h / at / daylight / road / style …
//   運搬 (carry)         **見ない。**運ぶだけ。spec / fire / sound / floor / sill …
//
// # なぜ台帳が要るのか — 「見ていない」と「見て問題がない」を区別するため
//
// ADR-0028 は解釈される属性の**値**を守った (ATT01/ATT02)。だが**キー**は無防備だった。
// 実測すると `heigh:2400` は HGT01 を、`sit:1` は敷地の判定を、`stiar:N` は縦動線を
// 丸ごと無音にし、`--strict` でも終了コード 0 だった。**書いたのに効かない**のに緑である。
//
// 塞ぐ道は一つしかない — **台帳に無いキーを拒む**。しかしそれは「語彙は開いている」
// という koyu の主張を殺す。だから運搬層に**名前空間**を与える (ADR-0033):
//
//   spec:RC              台帳のキー。名前空間は要らない。core は運ぶだけ
//   acme.sensor:23       名前空間つき。**誰でも書ける。core は絶対に見ない**
//   heigh:2400           台帳に無く名前空間も無い → **ATT03 エラー**
//
// 開いていることと信頼できることは、境界が宣言されていれば両立する。
// 宣言が無ければ、見ていないことと、見て問題がないことが区別できない。

/** 属性の層 */
export type AttrTier = "structure" | "interpreted" | "carry";

export interface AttrSpec {
  tier: AttrTier;
  /** 値がこの列挙のどれかでなければ ATT02 */
  of?: Array<string | number>;
  /** 正の数値でなければ ATT01 */
  num?: true;
  /**
   * The key may be written up to and including muro `after`, and not after it.
   *
   * **A retired key stays in the ledger.** Taking the row out would make the key unknown at
   * every version at once, because `checkAttrValues` reads `attrSpec` alone and never sees
   * `model.version` — a file declaring an older version would start failing with ATT03 for a
   * word that version legitimately has. The row is what keeps the old reading alive; VER07 is
   * what stops the new one.
   *
   * `instead` names what to write from the next version, and is carried here so that no state
   * exists where a key is retired with nothing offered in its place.
   */
  retired?: { after: string; instead: string };
}

/** 台帳を読みやすく書くための小道具 */
const num = (): AttrSpec => ({ tier: "interpreted", num: true });
const one = (...of: Array<string | number>): AttrSpec => ({ tier: "interpreted", of });
const free = (): AttrSpec => ({ tier: "interpreted" });
const carry = (): AttrSpec => ({ tier: "carry" });
const structure = (): AttrSpec => ({ tier: "structure" });
const retired = (after: string, instead: string, base: AttrSpec = free()): AttrSpec => ({
  ...base,
  retired: { after, instead },
});

/**
 * 運搬層の名前空間の綴り — **ドット区切り** (`acme.sensor` `bems.temp` `survey.measured`)。
 *
 * この形を選んだのは、属性の字句規則 (最初の `:` の左がキー) を一切変えずに済むからである。
 * 出所ごとの接頭辞 (`bems:temp:22.5`) は値に `:` を持ち込み、一律接頭辞 (`x-`) は
 * 二つの第三者が同じキー名を使ったとき衝突する。
 *
 * 名前空間の中身に core は一切の意味を与えない — 分割の規則すら持たない。
 * 一つでもドットがあれば運搬層である、というだけの規則にしてある。
 */
export const CARRY_NAMESPACE = /^[a-z][a-z0-9_-]*(\.[a-z0-9_-]+)+$/;

/** そのキーが名前空間つきの運搬層かどうか */
export function isNamespaced(key: string): boolean {
  return CARRY_NAMESPACE.test(key);
}

/**
 * 要素ごとの台帳。**ここに無いキーは名前空間を持たなければならない。**
 *
 * `structure` の印が付いたキーは parse が typed field へ持ち上げるので、
 * check の時点では attrs に残っていない。台帳に載せてあるのは、
 * 「その要素にそのキーを書いてよい」という事実そのものが契約だからである。
 */
export const ATTR_LEDGER: Record<string, Record<string, AttrSpec>> = {
  space: {
    // 構造 — parse が持ち上げる
    level: structure(), // 所属レベルの明示 (メゾネット)
    w: structure(), // 帯 (band) の要素の寸法。帯の外には書けない

    // 構成の事実 — **core が空間について読む語は、この二つだけである**
    //
    // かつては型の位置に `exterior` `void` と書いた。型の位置は開かれた語彙なので、
    // `exteriorr` の一字が外部を屋内に変え、実測で延床が 16.20㎡ から 32.40㎡ へ倍増しながら
    // check は緑だった。守りは二語の編集距離1だけを拒むヒューリスティックで、
    // `void` の距離2には `road` と `wood` — 人が正当に書く語 — が入るので広げられなかった。
    //
    // 台帳へ移せば、綴りを守るのは ATT03 (未知のキー) と ATT02 (値域) になる。
    // 開かれた語彙は殺さない — 型の位置は今や完全に自由で、core はそこを一切読まない。
    outside: one(0, 1), // 1 = 建物の外部。延べ面積に算入せず、領域が無くてよく、接道の相手になる
    void: one(0, 1), // 1 = 吹抜け。床が無いので延べ面積に算入せず、床も張られない

    // 解釈 — core が読む
    h: num(), // 天井高 mm。高さ不変量と矩計が読む
    // Retired after muro 1.2. It was never a use: ADR-0005 introduced it to answer the ratio of
    // common to exclusive area, and it held one grouping per space, so tenancy, fire compartment
    // and department all competed for it. A room's purpose is the type position; any other
    // division of the building is a namespaced key, of which a space may carry as many as it likes.
    use: retired(
      "1.2",
      "a namespaced key of your own (lease.category:, fire.compartment:, dept.name:)",
    ),
    road: num(), // outside:1 の幅員 mm。接道の導出
    daylight: free(), // 採光の問いの対象 (ADR-0020)。値域は DAY01 が守るので台帳では重ねない
    ceiling: one(0, 1), // 0 = 天井を張らない (ADR-0024)
    uid: free(), // 永続同一性トークン (ADR-0015)。UID01-03 が守る
    name: free(), // 表示名 — displayName が読むので解釈層である

    // 縦動線の宣言 (ADR-0021) — キーが装置を名指し、値が上る向き
    stair: free(),
    ramp: free(),
    escalator: free(),
    lift: free(),
    form: free(), // straight / return。RUN05 が守る
    turn: one("R", "L"),
    entry: num(), // 乗り込みの床の奥行 mm
    landing: num(), // 中間踊り場の奥行 mm
    riser: num(), // 蹴上げの上限 mm
    tread: num(), // 目標踏面 mm
    lane: num(), // 一台/一車線の幅 mm
    slope: num(), // 許容勾配の分母 — **検証だけが読む閾値**だが、値域は core が守る

    // 運搬 — core は運ぶだけ
    floor: carry(), // 床仕上げ。area が区間上書きする
    spec: carry(), // 物の名
  },

  zone: {
    name: free(),
    // Retired after muro 1.2, for the reason given on the space row above.
    use: retired(
      "1.2",
      "a namespaced key of your own (lease.category:, fire.compartment:, dept.name:)",
    ),
    site: one(0, 1), // 敷地の集約 (ADR-0009)
    area: num(), // 敷地の宣言面積 ㎡ (測量値)
    uid: free(),
  },

  boundary: {
    // 構造 — parse が持ち上げる (type / t / air / edge)
    type: structure(),
    t: structure(),
    air: structure(),
    edge: structure(),

    // 解釈
    h: num(), // air:1 の境界の天端高 mm (手すり・腰壁)。軸測図が読む
    name: free(),

    // 運搬
    spec: carry(), // 物の名 (RC / LGS / カーテンウォール / 手すり…)
    fire: carry(), // 耐火。**core は見ない** — 区画の問いは検証の面に属す
    sound: carry(), // 遮音
  },

  opening: {
    // 構造 — parse が持ち上げる
    w: structure(),
    h: structure(),
    at: structure(),
    edge: structure(),
    hinge: structure(),
    swing: structure(),

    // 解釈
    style: one("hinged", "sliding", "auto"), // 平面の建具表現が変わる
    name: free(), // **境界の中で一意な名** — 開口の同一性の鍵 (docs/reference/scope.md)

    // 運搬
    sill: carry(), // 窓台高
    spec: carry(),
    fire: carry(),
  },

  area: {
    floor: carry(),
    name: free(),
    spec: carry(),
  },

  seg: {
    // 構造 — parse が持ち上げる
    w: structure(),
    at: structure(),
    edge: structure(),

    name: free(),
    spec: carry(),
    fire: carry(),
    sound: carry(),
  },

  column: {
    // 構造 — parse が持ち上げる
    d: structure(),
    x: structure(),
    y: structure(),

    name: free(),
    spec: carry(),
  },

  /** level は attrs を持たない (すべて typed field) ので、台帳外のキーは parse が拒む */
  level: {
    h: structure(),
    slab: structure(),
    pitch: structure(),
    underground: structure(),
  },

  /**
   * 測地の枠の位置 (ADR-0057)。level と同じく attrs を持たない — 台帳外のキーは parse が拒む。
   * **値はメートル**であって mm ではない。EPSG コードは解釈しない不透明な整数である
   */
  origin: {
    epsg: structure(),
    easting: structure(),
    northing: structure(),
    elevation: structure(),
    vertical: structure(),
  },
};

/** その要素で、名前空間なしに書いてよいキーか */
export function known(elem: string, key: string): boolean {
  return ATTR_LEDGER[elem]?.[key] !== undefined;
}

/** その要素・そのキーの契約 (無ければ undefined) */
export function attrSpec(elem: string, key: string): AttrSpec | undefined {
  return ATTR_LEDGER[elem]?.[key];
}

/**
 * asset は開口の既定値の束なので、開口と同じ台帳で読む (ADR-0010)。
 * 「アセットに書けて開口に書けない属性」を作らないための同一視である。
 */
export const ASSET_ELEM = "opening";
