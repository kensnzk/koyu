// 凸片の幾何 (ADR-0027) の保証。
// ここが守るのは一つの規律 — 「測る範囲」と「切る範囲」は同じでなければならない。

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  area,
  areaOf,
  clipHalf,
  cutsInWindow,
  lineWindow,
  overlaps,
  rectToPoly,
  sideOfTouching,
  signedArea,
  splitByRect,
  subtract,
} from "../src/poly.js";

const R = (x1: number, y1: number, x2: number, y2: number) => rectToPoly({ x1, y1, x2, y2 });

test("符号つき面積: 反時計回りが正、矩形は幅×高さ", () => {
  assert.equal(signedArea(R(0, 0, 100, 50)), 5000);
  assert.equal(signedArea([...R(0, 0, 100, 50)].reverse()), -5000);
  assert.equal(area([...R(0, 0, 100, 50)].reverse()), 5000);
});

test("半平面で切る: 退化した破片は残さない", () => {
  // 対角線で半分に切る
  const half = clipHalf(R(0, 0, 100, 100), { x: 0, y: 0 }, { x: 100, y: 100 }, true);
  assert.equal(area(half), 5000);
  // 辺に沿った線は片側を空にする (0.001mm²の破片を残さない)
  assert.deepEqual(clipHalf(R(0, 0, 100, 100), { x: 0, y: 0 }, { x: 0, y: 100 }, true), []);
});

test("差集合: 斜めに切られた凸片も引ける (矩形に限らない)", () => {
  const base = R(0, 0, 100, 100);
  const diag = clipHalf(R(0, 0, 100, 100), { x: 0, y: 100 }, { x: 100, y: 0 }, true); // 右上の三角
  const rest = subtract(base, [diag]);
  assert.ok(Math.abs(areaOf(rest) - 5000) < 1, `残りは半分: ${areaOf(rest)}`);
  // 引き手が触れていなければ丸ごと残る
  assert.equal(areaOf(subtract(base, [R(200, 200, 300, 300)])), 10000);
});

test("窓: 線に沿っては線の区間、横切っては空間の全体 (外皮を切る窓)", () => {
  const self = { x1: 0, y1: 0, x2: 8000, y2: 40000 };
  // ほぼ縦の線 — 沿う=y は線の区間、横切る=x は空間の全体
  const w = lineWindow({ x: 0, y: 34000 }, { x: 2000, y: 40000 }, self);
  assert.deepEqual(w, { x1: 0, x2: 8000, y1: 34000, y2: 40000 });
});

test("窓: 二空間の分け直しは 沿っては積・横切っては和", () => {
  const a = { x1: 0, y1: 7000, x2: 8000, y2: 15000 };
  const b = { x1: 8000, y1: 0, x2: 16000, y2: 40000 };
  const w = lineWindow({ x: 8000, y: 0 }, { x: 12000, y: 40000 }, a, b);
  assert.deepEqual(w, { x1: 0, x2: 16000, y1: 7000, y2: 15000 });
});

test("偏りは線が触れる片だけで測る — 離れた翼が符号を裏返さない", () => {
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
  assert.ok(areaOf(kept) > 70e6, `本体が残る: ${areaOf(kept)}`);
});

test("軸平行の線でも窓は退化しない — 「何も切っていない」の誤報が消える", () => {
  const pieces = [R(0, 0, 16000, 16000)];
  const a = { x: 8000, y: 0 };
  const b = { x: 8000, y: 16000 }; // 真っ直ぐな縦の線
  const self = { x1: 0, y1: 0, x2: 16000, y2: 16000 };
  const w = lineWindow(a, b, self);
  assert.ok(w.x2 - w.x1 > 0 && w.y2 - w.y1 > 0, "窓が潰れない");
  assert.equal(cutsInWindow(pieces, w, a, b), true);
});

test("重なり: 凸片同士の判定は斜めでも効く", () => {
  const tri = clipHalf(R(0, 0, 100, 100), { x: 0, y: 100 }, { x: 100, y: 0 }, true);
  assert.equal(overlaps([tri], [R(90, 90, 100, 100)]), true);
  assert.equal(overlaps([tri], [R(0, 0, 10, 10)]), false);
});
