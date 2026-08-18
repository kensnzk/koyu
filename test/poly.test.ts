// 凸片の幾何 (ADR-0022 / spec/derivation.md §1) の保証。
// ここが守るのは一つの規律 — 「測る範囲」と「切る範囲」は同じでなければならない。

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  area,
  areaOf,
  clipHalf,
  crossing,
  cutsInWindow,
  hull,
  lineWindow,
  overlaps,
  rectToPoly,
  sideOfTouching,
  signedArea,
  splitByRect,
  subtract,
} from "../src/core/poly.js";

const R = (x1: number, y1: number, x2: number, y2: number) => rectToPoly({ x1, y1, x2, y2 });

test("signed area: counter-clockwise is positive, a rect is width x height", () => {
  assert.equal(signedArea(R(0, 0, 100, 50)), 5000);
  assert.equal(signedArea([...R(0, 0, 100, 50)].reverse()), -5000);
  assert.equal(area([...R(0, 0, 100, 50)].reverse()), 5000);
});

test("clipping by a half-plane: no degenerate sliver is left behind", () => {
  // 対角線で半分に切る
  const half = clipHalf(R(0, 0, 100, 100), { x: 0, y: 0 }, { x: 100, y: 100 }, true);
  assert.equal(area(half), 5000);
  // 辺に沿った線は片側を空にする (0.001mm²の破片を残さない)
  assert.deepEqual(clipHalf(R(0, 0, 100, 100), { x: 0, y: 0 }, { x: 0, y: 100 }, true), []);
});

test("subtraction: a diagonally cut convex piece can be subtracted too (not only rects)", () => {
  const base = R(0, 0, 100, 100);
  const diag = clipHalf(R(0, 0, 100, 100), { x: 0, y: 100 }, { x: 100, y: 0 }, true); // 右上の三角
  const rest = subtract(base, [diag]);
  assert.ok(Math.abs(areaOf(rest) - 5000) < 1, `half remains: ${areaOf(rest)}`);
  // 引き手が触れていなければ丸ごと残る
  assert.equal(areaOf(subtract(base, [R(200, 200, 300, 300)])), 10000);
});

test("window: along the line it is the line span, across it is the whole space (a window cutting the envelope)", () => {
  const self = { x1: 0, y1: 0, x2: 8000, y2: 40000 };
  // ほぼ縦の線 — 沿う=y は線の区間、横切る=x は空間の全体
  const w = lineWindow({ x: 0, y: 34000 }, { x: 2000, y: 40000 }, self);
  assert.deepEqual(w, { x1: 0, x2: 8000, y1: 34000, y2: 40000 });
});

test("window: redividing two spaces intersects along the line and unions across it", () => {
  const a = { x1: 0, y1: 7000, x2: 8000, y2: 15000 };
  const b = { x1: 8000, y1: 0, x2: 16000, y2: 40000 };
  const w = lineWindow({ x: 8000, y: 0 }, { x: 12000, y: 40000 }, a, b);
  assert.deepEqual(w, { x1: 0, x2: 16000, y1: 7000, y2: 15000 });
});

test("the bias is measured only on the pieces the line touches, so a distant wing cannot flip the sign", () => {
  // L字: 短い脚 (0..10000 × 0..8000) と、遠くへ伸びる長い脚 (0..7000 × 8000..40000)
  const pieces = [R(0, 0, 10000, 8000), R(0, 8000, 7000, 40000)];
  const a = { x: 8000, y: 8000 };
  const b = { x: 10000, y: 0 }; // 短い脚の外隅を落とす隅切り
  const self = { x1: 0, y1: 0, x2: 10000, y2: 40000 };
  const w = lineWindow(a, b, self);
  // 窓は線の y 区間 (0..8000) に限られるので、長い脚は測定に入らない
  assert.equal(w.y1, 0);
  assert.equal(w.y2, 8000);
  // 窓の中では「隅の三角を捨てて本体を残す」が多数派
  const side = sideOfTouching(pieces, w, a, b);
  const kept = splitByRect(pieces, w).inside.map((p) => clipHalf(p, a, b, side > 0));
  assert.ok(areaOf(kept) > 70e6, `the body remains: ${areaOf(kept)}`);
});

test("the window does not degenerate on an axis-parallel line, so the false \"nothing is cut\" report goes away", () => {
  const pieces = [R(0, 0, 16000, 16000)];
  const a = { x: 8000, y: 0 };
  const b = { x: 8000, y: 16000 }; // 真っ直ぐな縦の線
  const self = { x1: 0, y1: 0, x2: 16000, y2: 16000 };
  const w = lineWindow(a, b, self);
  assert.ok(w.x2 - w.x1 > 0 && w.y2 - w.y1 > 0, "the window does not collapse");
  assert.equal(cutsInWindow(pieces, w, a, b), true);
});

test("overlap: the test between convex pieces works on diagonals too", () => {
  const tri = clipHalf(R(0, 0, 100, 100), { x: 0, y: 100 }, { x: 100, y: 0 }, true);
  assert.equal(overlaps([tri], [R(90, 90, 100, 100)]), true);
  assert.equal(overlaps([tri], [R(0, 0, 10, 10)]), false);
});

// ---- Crossing a piece with an axis-parallel line (ADR-0064) ----
//
// A vertical plane cuts a building by meeting each body's footprint in one interval. What the
// caller needs back is not only where that interval is, but **which edge each end sits on and how
// far along it** — the body carries a height per vertex, and a ramp's height has to be read at the
// crossing rather than guessed from the ends of the whole piece.

test("crossing: a line through a rect returns the interval along it, and where on the ring each end sits", () => {
  const met = crossing(R(0, 0, 100, 50), "X", 50);
  assert.ok(met);
  assert.deepEqual(
    met.map((c) => c.at),
    [0, 50],
  );
  // Halfway along the two edges the line actually meets — that is what makes a height readable.
  assert.deepEqual(
    met.map((c) => c.t),
    [0.5, 0.5],
  );
});

test("crossing: the interval is measured along the line, so the axis decides which coordinate it is", () => {
  assert.deepEqual(crossing(R(0, 0, 100, 50), "Y", 25)?.map((c) => c.at), [0, 100]);
});

test("crossing: an edge lying on the line is returned as itself", () => {
  // A wall standing exactly on a grid line is cut along its whole length. That is a correct
  // drawing of a poor cut, and it must not come back empty.
  assert.deepEqual(crossing(R(0, 0, 100, 50), "X", 100)?.map((c) => c.at), [0, 50]);
});

test("crossing: touching one corner is not being crossed, and missing is not either", () => {
  const tri = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 0, y: 100 },
  ];
  assert.equal(crossing(tri, "X", 100), undefined);
  assert.equal(crossing(R(0, 0, 100, 50), "X", 150), undefined);
});

test("crossing: an oblique piece is met at the interpolated point", () => {
  // The half of a square cut corner to corner: the line x = 50 meets it from y 0 to y 50.
  const tri = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 0, y: 100 },
  ];
  assert.deepEqual(crossing(tri, "X", 50)?.map((c) => c.at), [0, 50]);
});

// ---- The hull (ADR-0064) ----
//
// A body of a `Form` is a prism over a convex ring whose top and bottom vary linearly, so it is a
// convex solid, and **the projection of a convex solid is the hull of its projected vertices.**
// That is what makes an elevation exact rather than an outline fitted to one.

test("hull: the corners survive, a point inside does not, and the ring is counter-clockwise", () => {
  const h = hull([
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 50 },
    { x: 0, y: 50 },
    { x: 50, y: 25 },
  ]);
  assert.equal(h.length, 4);
  assert.ok(signedArea(h) > 0);
  assert.equal(area(h), 5000);
});

test("hull: a point on an edge is not a corner", () => {
  assert.equal(hull([...R(0, 0, 100, 50), { x: 50, y: 0 }]).length, 4);
});

test("hull: a dent is filled in — the answer is the convex one", () => {
  const h = hull([
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 50, y: 50 },
    { x: 0, y: 100 },
  ]);
  assert.equal(area(h), 10000);
});
