// 検証 — 到達可能性と、位置を書かない要素どうしの衝突
//
// **この章は、旗艦例が実際に踏んだ失敗の集まりである。**掟2 (「check が緑でも建物が
// 使えるとは限らない」) は文として書かれていたが、旗艦例は check 緑のまま
// 「床の無い吹抜けにしか扉が開かない区画が20」「他人の店舗を貫通する避難路」
// 「車の出入口の無い2層の駐車場」「バックヤードの奥で孤立したエスカレーター」を
// 抱えていた。予言された失敗を、予言した当人が踏んだのである。
//
// 直したことと再発しないことは別なので、その四つと「外部へ到達できない室」
// 「柱が塞ぐ扉」を判定として置く。**判定は MCP から呼べなければ、機械にとって
// 存在しないに等しい** (spec/validation.md) — スクリプトの中に閉じている限り、
// 同じ誤りは別の建物で何度でも起きる。
//
// core が持つのは経路そのもの (`doorsBetween` / `passable` / `placeOpening`) で、
// **どの到達不能が問題かを言うのはここである** (spec/scope.md §4)。

import { passable, placeOpening } from "../core/graph.js";
import {
  columnsFor,
  effectiveUse,
  levelsSorted,
  type Boundary,
  type Model,
  type Space,
} from "../core/model.js";
import { finding, type Finding } from "./index.js";

/** 車が通れる開口の最小幅 mm。人の扉 (900) では車は出られない */
export const CAR_WIDTH_MIN = 2400;

/** 空間としては連続するが人も車も通り抜けられない型 — どの到達性の問いでも常に避ける */
const IMPASSABLE = new Set(["shaft", "void"]);

/** 境界を通れるかの判定。人 (passable) と車 (carPassable) で通れる境界が違うので差し替える */
type CanPass = (b: Boundary) => boolean;

/**
 * from (複数可) から toSet のどれかへ、avoid が真になる空間を**通らずに**辿り着けるか。
 * 到達先そのものは avoid を問わない (外部は exterior だが、着いた時点で目的は果たされている)。
 */
function reachableAvoiding(
  model: Model,
  from: string[],
  toSet: Set<string>,
  avoid: (s: Space) => boolean = () => false,
  canPass: CanPass = passable,
): boolean {
  const seen = new Set<string>();
  const queue: string[] = [];
  for (const f of from) {
    if (toSet.has(f)) return true;
    if (model.spaces.has(f) && !seen.has(f)) {
      seen.add(f);
      queue.push(f);
    }
  }
  while (queue.length) {
    const u = queue.shift()!;
    for (const b of model.boundaries) {
      if (!canPass(b)) continue;
      const v = b.a === u ? b.b : b.b === u ? b.a : undefined;
      if (!v || seen.has(v)) continue;
      if (toSet.has(v)) return true;
      const s = model.spaces.get(v);
      if (!s || IMPASSABLE.has(s.type) || avoid(s)) continue;
      seen.add(v);
      queue.push(v);
    }
  }
  return false;
}

/** 外部の空間パスの集合。空なら到達性は問えない (外部が書かれていない模型に穴は無い) */
function exteriorSet(model: Model): Set<string> {
  return new Set([...model.spaces.values()].filter((s) => s.type === "exterior").map((s) => s.path));
}

/**
 * 通れる境界だけを辿って外部から届く空間の集合。
 *
 * ここは `doorsBetween` と同じグラフを一度だけ広げたものである — 通行は向きを持たないので
 * 「どれかの外部から s へ行けるか」は「s とどれかの外部が同じ連結成分にあるか」に等しい。
 * 空間ごとに最短経路を引き直すと室数×外部数の探索になり、延床14万㎡の例で分単位になる。
 */
function reachableFromExterior(model: Model): Set<string> {
  const seen = new Set<string>(exteriorSet(model));
  const queue = [...seen];
  while (queue.length) {
    const u = queue.shift()!;
    for (const b of model.boundaries) {
      if (!passable(b)) continue;
      const v = b.a === u ? b.b : b.b === u ? b.a : undefined;
      if (!v || seen.has(v)) continue;
      seen.add(v);
      queue.push(v);
    }
  }
  return seen;
}

/** 車が通れる境界 — open・幅 2400mm 以上の扉・斜路の縦連結だけ */
function carPassable(model: Model): CanPass {
  return (b) => {
    if (b.kind === "open") return true;
    if (b.kind === "shaft" || b.kind === "void") return false;
    if (b.kind === "stair") {
      // 階段の縦連結は、斜路の宣言が無ければ車にとってただの段差である
      const ra = model.spaces.get(b.a)?.attrs["ramp"];
      const rb = model.spaces.get(b.b)?.attrs["ramp"];
      return ra != null || rb != null;
    }
    return b.openings.some((o) => o.kind === "door" && o.w >= CAR_WIDTH_MIN);
  };
}

const at = (s: Space) => ({ line: s.line, file: s.file, path: [s.path] });

export function accessFindings(model: Model): Finding[] {
  const out: Finding[] = [];
  const outs = exteriorSet(model);

  // ---- 外部へ到達できない室 ----
  // **扉の有無ではなく到達性を問う。**扉を持っていても、その先が行き止まりなら出られない。
  // violation — 「出られない室」を建築として読める解釈は無い。シャフト (人が通れない) と
  // 吹抜け (床が無い) と外部そのものだけが対象外である。
  if (outs.size > 0) {
    const reached = reachableFromExterior(model);
    for (const s of model.spaces.values()) {
      if (s.rects.length === 0 || s.type === "exterior" || IMPASSABLE.has(s.type)) continue;
      if (reached.has(s.path)) continue;
      out.push(
        finding(
          "access.unreachable",
          `外部へ到達できません: ${s.path} (通れる境界を辿って外部空間へ出られません — 扉を書きます)`,
          at(s),
        ),
      );
    }
  }

  // ---- 吹抜けにしか扉が開かない区画 ----
  // 通れる境界を持つのに行き先が全部 type:void なら、扉は床の無い穴に向かって開いている。
  // violation — 出入りしたつもりでどこへも行けない。旗艦例はこれを20区画抱えたまま緑だった。
  for (const s of model.spaces.values()) {
    if (s.rects.length === 0 || s.type === "exterior" || IMPASSABLE.has(s.type)) continue;
    let doors = 0;
    let allVoid = true;
    for (const b of model.boundaries) {
      if (!passable(b)) continue;
      const other = b.a === s.path ? b.b : b.b === s.path ? b.a : undefined;
      if (!other) continue;
      doors++;
      if (model.spaces.get(other)?.type !== "void") allVoid = false;
    }
    if (doors > 0 && allVoid) {
      out.push(
        finding(
          "access.voidonly",
          `扉が吹抜けにしか開いていません: ${s.path} (床の無い所へ開いているので出入りできません)`,
          at(s),
        ),
      );
    }
  }

  // ---- 賃貸区画を貫く避難路 ----
  // 階段室ごとに「use:rentable を避けても外部へ出られるか」を問う。賃貸経由でしか出られない
  // 階段は、テナントが施錠した瞬間に死ぬ。
  // caution — 通ってよいかは契約と管轄の側の事実であって、原本には書かれていない
  // (専用通路として通す設計も現にある)。疑う値打ちはあるが、断じる根拠はここに無い。
  if (outs.size > 0) {
    for (const s of model.spaces.values()) {
      if (s.type !== "stair" || s.rects.length === 0) continue;
      if (reachableAvoiding(model, [s.path], outs, (t) => effectiveUse(model, t) === "rentable")) continue;
      out.push(
        finding(
          "access.throughtenant",
          `${s.path} からの避難が賃貸区画を通ります (テナントが施錠すると外部へ出られません)`,
          at(s),
        ),
      );
    }
  }

  // ---- 車が出られない駐車場 ----
  // 人は900mmの扉と階段で出られてしまうので access.unreachable では見えない。
  // violation — 車が出られない駐車場は駐車場ではない。
  if (outs.size > 0) {
    const canPass = carPassable(model);
    for (const s of model.spaces.values()) {
      if (s.rects.length === 0 || s.type === "exterior" || IMPASSABLE.has(s.type)) continue;
      if (effectiveUse(model, s) !== "parking") continue;
      if (reachableAvoiding(model, [s.path], outs, () => false, canPass)) continue;
      out.push(
        finding(
          "access.parking",
          `車が外部へ出られません: ${s.path} (幅${CAR_WIDTH_MIN}mm以上の開口・type:open の境界・斜路のいずれかが要ります)`,
          at(s),
        ),
      );
    }
  }

  // ---- 客が乗れない縦動線 ----
  // 縦動線の宣言 (stair:/escalator: — ADR-0021) を持つ共用の空間は客動線の一部なので、
  // 共用廊下からバックヤードを通らずに届かなければ孤立している。共用廊下が一つも無い建物には
  // 客動線の区別が無いので問わない (住宅の階段を孤立と誤検出しないため)。
  //
  // 当の空間へは**水平に**入れなければならない。自分の縦連結を経由すると「上の階から当の
  // エスカレーターで降りてくれば乗り場に着く」という循環が成り立ってしまう。
  //
  // caution — 「共用の縦動線はすべて客用」は粗い推定である。従業員用の共用階段を客用と
  // 読み違えることがあるので、断じずに疑う。
  const corridors = [...model.spaces.values()]
    .filter((s) => s.type === "corridor" && s.rects.length > 0 && effectiveUse(model, s) === "common")
    .map((s) => s.path);
  if (corridors.length > 0) {
    for (const s of model.spaces.values()) {
      if (s.rects.length === 0 || s.type === "shaft") continue;
      if (s.attrs["stair"] == null && s.attrs["escalator"] == null) continue;
      if (effectiveUse(model, s) !== "common") continue;
      const horizontalEntry: CanPass = (b) =>
        passable(b) && !(b.kind === "stair" && (b.a === s.path || b.b === s.path));
      if (reachableAvoiding(model, corridors, new Set([s.path]), (t) => t.type === "backyard", horizontalEntry)) {
        continue;
      }
      out.push(
        finding(
          "access.backofhouse",
          `${s.path} へ共用廊下からバックヤードを通らずに届きません (客が乗れない縦動線です)`,
          at(s),
        ),
      );
    }
  }

  // ---- 柱が塞ぐ扉 ----
  // **位置を書かない要素が二つあると、衝突は導出でしか分からない。**柱は通り芯の交点から
  // (ADR-0023)、扉は境界線分の上から (at: の比率か通り参照から) 導かれるので、どちらも
  // 原本には座標が無い。だから目で見るまで気づかない。通り芯の交点は境界線分の端でもあるので、
  // 扉を隅に寄せると必ずぶつかる。
  // violation — 物と物が同じ場所を占めている。読み方によって許される衝突ではない。
  const byLevel = new Map<string, ReturnType<typeof columnsFor>>();
  for (const l of levelsSorted(model)) byLevel.set(l.name, columnsFor(model, l.name));
  for (const b of model.boundaries) {
    const lv = model.spaces.get(b.a)?.level ?? model.spaces.get(b.b)?.level;
    if (!lv) continue;
    for (const o of b.openings) {
      if (o.kind !== "door") continue;
      const p = placeOpening(model, b, o);
      if ("error" in p) continue; // 置けない開口は core が既に言っている
      const seg = p.segment;
      const half = o.w / 2;
      for (const c of byLevel.get(lv) ?? []) {
        const cx1 = c.x - c.w / 2;
        const cx2 = c.x + c.w / 2;
        const cy1 = c.y - c.d / 2;
        const cy2 = c.y + c.d / 2;
        // 扉は線分に沿って幅を持ち、線分に直交する向きには厚みを持たない
        const along = seg.horizontal
          ? Math.max(p.cx - half, cx1) < Math.min(p.cx + half, cx2)
          : Math.max(p.cy - half, cy1) < Math.min(p.cy + half, cy2);
        const across = seg.horizontal ? cy1 < seg.y1 && seg.y1 < cy2 : cx1 < seg.x1 && seg.x1 < cx2;
        if (along && across) {
          out.push(
            finding(
              "column.blocksdoor",
              `柱が扉を塞いでいます: ${b.a} | ${b.b} の扉 (幅${o.w}mm) が ${c.grid} の柱と重なります`,
              { line: b.line, file: b.file, path: [b.a, b.b] },
            ),
          );
          break;
        }
      }
    }
  }

  return out;
}
