#!/usr/bin/env node
// 同梱例の門番。**check だけでは足りない** (AGENTS.md 掟2)。
//
// check が緑でも建物が使えるとは限らない — 接する空間の既定は壁なので、扉を一枚も
// 宣言しない建物は緑のまま完全に密封される。実際、旗艦例は check 緑のまま
// 「床の無い吹抜けにしか扉が開かない区画が20」「他人の店舗を貫通する避難路」
// 「車の出入口の無い2層の駐車場」「バックヤードの奥で孤立したエスカレーター」を
// 抱えていた。掟2 が予言した失敗を旗艦例が踏んだ。四つとも直っているが、
// 直したことと再発しないことは別である — 同じ誤りを二度やらないために、
// その四つがそのまま検査 5〜8 になった。
//
// ここが問うのは八つ。
//   1. check --strict が緑か (警告も含めて)
//   2. 領域を持つ室から外部へ**辿り着けるか** (扉の有無ではなく到達性)
//   3. 採光の対象と宣言した室が 1/7 を満たすか
//   4. 敷地があるなら接道が導けるか
//   5. 吹抜け (床の無い所) にしか扉が開かない区画が無いか
//   6. 階段室が賃貸区画を通らずに外部へ出られるか (避難は他人の店を通らない)
//   7. 駐車場から車が出られるか (幅2400mm以上の開口・open境界・斜路だけを通って)
//   8. 客が共用廊下からバックヤードを通らずに縦動線へ届くか
//
//   npm run gate:examples

import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { checkDiagnostics } from "../src/check.ts";
import { doorsBetween, passable } from "../src/graph.ts";
import { daylight } from "../src/light.ts";
import { effectiveUse } from "../src/model.ts";
import { parseFile } from "../src/parse-file.ts";
import { siteReport } from "../src/site.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const EX = join(root, "examples");

/** 車が通れる開口の最小幅 mm。人の扉 (900) では車は出られない */
const CAR_W = 2400;

/** 同梱例の入口 — ディレクトリなら main.muro、単体なら .muro そのもの */
function entries() {
  const out = [];
  for (const e of readdirSync(EX)) {
    const p = join(EX, e);
    if (statSync(p).isDirectory()) {
      const main = join(p, "main.muro");
      try {
        statSync(main);
        out.push(main);
      } catch {
        // steps/ のように入口を持たない集まりは、各ファイルを単体として見る
        for (const f of readdirSync(p)) if (f.endsWith(".muro")) out.push(join(p, f));
      }
    } else if (e.endsWith(".muro")) {
      out.push(p);
    }
  }
  return out.sort();
}

/** 件数つきの問題文。長い列挙は先頭4件で切る (既存の書式に合わせる) */
function listUp(paths) {
  return `${paths.slice(0, 4).join(" ")}${paths.length > 4 ? " …" : ""}`;
}

/**
 * from (単数または複数) から toSet のどれかへ、avoid が真になる空間を**通らずに**
 * 辿り着けるか。doorsBetween は除外を受け取れないので、ここに BFS を持つ。
 * 境界の通行判定 canPass は差し替えられる — 人 (passable) と車 (carPassable) で
 * 通れる境界が違うため。shaft (EV・PS) と void (吹抜け) は空間として連続するが
 * 人も車も通れないので、どの検査でも常に避ける。到達先そのものは avoid を問わない
 * (外部は exterior だが、着いた時点で目的は果たされている)。
 */
function reachableAvoiding(model, from, toSet, avoid = () => false, canPass = passable) {
  const seen = new Set();
  const queue = [];
  for (const f of Array.isArray(from) ? from : [from]) {
    if (toSet.has(f)) return true;
    if (model.spaces.has(f) && !seen.has(f)) {
      seen.add(f);
      queue.push(f);
    }
  }
  while (queue.length) {
    const u = queue.shift();
    for (const b of model.boundaries) {
      if (!canPass(b)) continue;
      const v = b.a === u ? b.b : b.b === u ? b.a : undefined;
      if (!v || seen.has(v)) continue;
      if (toSet.has(v)) return true;
      const s = model.spaces.get(v);
      if (!s || s.type === "shaft" || s.type === "void" || avoid(s)) continue;
      seen.add(v);
      queue.push(v);
    }
  }
  return false;
}

/** 外部の空間パスの集合。空なら到達性の検査は問えない */
function exteriorSet(model) {
  return new Set([...model.spaces.values()].filter((s) => s.type === "exterior").map((s) => s.path));
}

/** 外部へ辿り着けない室。シャフト (通行不可) と吹抜けと外部そのものは問わない */
function unreachable(model) {
  const outs = [...model.spaces.values()].filter((s) => s.type === "exterior");
  if (outs.length === 0) return [];
  const bad = [];
  for (const s of model.spaces.values()) {
    if (s.rects.length === 0 || s.type === "exterior" || s.type === "void") continue;
    // シャフト (EV等) は空間として連続するが人は通れない — 到達性を問わない
    if (s.type === "shaft") continue;
    if (!outs.some((o) => doorsBetween(model, s.path, o.path))) bad.push(s.path);
  }
  return bad;
}

/**
 * 5. 吹抜けにしか扉が開かない区画。通れる境界を持つのに、その行き先が全部
 * type:void なら、扉は床の無い穴に向かって開いている — 出入りしたつもりで
 * どこへも行けない。旗艦例はこれを20区画抱えたまま check 緑だった。
 */
function voidOnlyDoors(model) {
  const bad = [];
  for (const s of model.spaces.values()) {
    if (s.rects.length === 0) continue;
    if (s.type === "exterior" || s.type === "void" || s.type === "shaft") continue;
    let doors = 0;
    let allVoid = true;
    for (const b of model.boundaries) {
      if (!passable(b)) continue;
      const other = b.a === s.path ? b.b : b.b === s.path ? b.a : undefined;
      if (!other) continue;
      doors++;
      if (model.spaces.get(other)?.type !== "void") allVoid = false;
    }
    if (doors > 0 && allVoid) bad.push(s.path);
  }
  return bad;
}

/**
 * 6. 避難路が賃貸区画を貫く階段室。避難は他人の店を通ってはならないので、
 * 階段室ごとに「use:rentable の空間を避けても外部へ出られるか」を問う。
 * 賃貸経由でしか出られない階段は、テナントが施錠した瞬間に死ぬ。
 */
function escapeThroughRentable(model) {
  const outs = exteriorSet(model);
  if (outs.size === 0) return [];
  const bad = [];
  for (const s of model.spaces.values()) {
    if (s.type !== "stair" || s.rects.length === 0) continue;
    if (!reachableAvoiding(model, s.path, outs, (t) => effectiveUse(model, t) === "rentable")) {
      bad.push(s.path);
    }
  }
  return bad;
}

/**
 * 7. 車が出られない駐車場。人は900mmの扉と階段で出られてしまうので、検査2では
 * 見えない。車が通れるのは open 境界・幅2400mm以上の扉・斜路 (ramp: 宣言のある
 * 空間の縦連結) だけ — 階段の縦連結 (type:stair) は、斜路の宣言が無ければ車には
 * ただの段差である。
 */
function carPassable(model) {
  return (b) => {
    if (b.kind === "open") return true;
    if (b.kind === "shaft" || b.kind === "void") return false;
    if (b.kind === "stair") {
      const ra = model.spaces.get(b.a)?.attrs["ramp"];
      const rb = model.spaces.get(b.b)?.attrs["ramp"];
      return ra != null || rb != null;
    }
    return b.openings.some((o) => o.kind === "door" && o.w >= CAR_W);
  };
}

function carTrapped(model) {
  const outs = exteriorSet(model);
  if (outs.size === 0) return [];
  const canPass = carPassable(model);
  const bad = [];
  for (const s of model.spaces.values()) {
    if (s.rects.length === 0 || s.type === "exterior" || s.type === "void" || s.type === "shaft") continue;
    if (effectiveUse(model, s) !== "parking") continue;
    if (!reachableAvoiding(model, s.path, outs, () => false, canPass)) bad.push(s.path);
  }
  return bad;
}

/**
 * 8. 客が乗れない縦動線。縦動線の宣言 (stair:/escalator: — ADR-0021) を持つ共用の
 * 空間は客動線の一部なので、共用廊下からバックヤードを通らずに届かなければ孤立
 * している。共用廊下 (type:corridor use:common) が一つも無い建物には客動線の
 * 区別が無いので問わない (住宅の階段を孤立と誤検出しないため)。
 *
 * 当の空間へは**水平に**入れなければならない。自分の縦連結 (stack の type:stair
 * 境界) を経由すると「上の階から当のエスカレーターで降りてくれば乗り場に着く」
 * という循環が成り立ってしまい、旗艦例の孤立したエスカレーターを素通ししていた。
 */
function verticalCutOff(model) {
  const corridors = [...model.spaces.values()]
    .filter((s) => s.type === "corridor" && s.rects.length > 0 && effectiveUse(model, s) === "common")
    .map((s) => s.path);
  if (corridors.length === 0) return [];
  const bad = [];
  for (const s of model.spaces.values()) {
    if (s.rects.length === 0 || s.type === "shaft") continue;
    if (s.attrs["stair"] == null && s.attrs["escalator"] == null) continue;
    if (effectiveUse(model, s) !== "common") continue;
    const horizontalEntry = (b) =>
      passable(b) && !(b.kind === "stair" && (b.a === s.path || b.b === s.path));
    if (!reachableAvoiding(model, corridors, new Set([s.path]), (t) => t.type === "backyard", horizontalEntry)) {
      bad.push(s.path);
    }
  }
  return bad;
}

let failed = 0;
for (const file of entries()) {
  const name = relative(root, file);
  const problems = [];
  let model;
  try {
    model = parseFile(file);
  } catch (e) {
    console.log(`✖ ${name}\n    解析: ${e.message}`);
    failed++;
    continue;
  }

  const diags = checkDiagnostics(model);
  const errs = diags.filter((d) => d.severity === "error");
  const warns = diags.filter((d) => d.severity === "warning");
  if (errs.length) problems.push(`check エラー ${errs.length}件 — ${errs[0].code} ${errs[0].message}`);
  if (warns.length) problems.push(`check 警告 ${warns.length}件 — ${warns[0].code} ${warns[0].message}`);

  const un = unreachable(model);
  if (un.length) {
    problems.push(`外部へ到達できない室 ${un.length}件 — ${listUp(un)}`);
  }

  const day = daylight(model).filter((d) => !d.ok);
  if (day.length) {
    problems.push(`採光1/7を満たさない室 ${day.length}件 — ${day.slice(0, 3).map((d) => d.space.path).join(" ")}`);
  }

  for (const poly of model.polygons.values()) {
    const zone = model.zones.get(poly.path);
    if (zone?.attrs["site"] !== 1) continue;
    const r = siteReport(model);
    const noFront = r.roads.filter((rd) => rd.frontage < 2000);
    if (noFront.length) {
      problems.push(`接道2m未満の道路 ${noFront.length}件 — ${noFront.map((rd) => rd.road.path).join(" ")}`);
    }
  }

  const vo = voidOnlyDoors(model);
  if (vo.length) {
    problems.push(`吹抜けにしか扉が開かない区画 ${vo.length}件 — ${listUp(vo)}`);
  }

  const esc = escapeThroughRentable(model);
  if (esc.length) {
    problems.push(`賃貸区画を通らないと外部へ出られない階段室 ${esc.length}件 — ${listUp(esc)}`);
  }

  const car = carTrapped(model);
  if (car.length) {
    problems.push(`車が外部へ出られない駐車場 ${car.length}件 — ${listUp(car)}`);
  }

  const cut = verticalCutOff(model);
  if (cut.length) {
    problems.push(`共用廊下からバックヤードを通らずに届かない縦動線 ${cut.length}件 — ${listUp(cut)}`);
  }

  if (problems.length === 0) {
    console.log(`✔ ${name}`);
  } else {
    console.log(`✖ ${name}`);
    for (const p of problems) console.log(`    ${p}`);
    failed++;
  }
}

console.log(failed === 0 ? "\n門番: 全例が通った" : `\n門番: ${failed}件が落ちた`);
process.exit(failed === 0 ? 0 : 1);
