// Home must answer inside Kino's 20 s: the rows that arrive in the budget are shown, a hung one does not hold the rest, and the last good
// Home is served when none arrives (measured on users' TV boxes: Home ran 21-26 s with Promise.all and Kino threw everything away).
import test from "node:test";
import assert from "node:assert/strict";
import { homeWithin, within } from "../src/util/home.js";

function fakeKino() {
  const mem = new Map();
  globalThis.kino = { storage: { get: (k) => (mem.has(k) ? mem.get(k) : null), set: (k, v) => { mem.set(k, v); } }, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), log() {} };
  return mem;
}
const row = (id, n = 3) => ({ id, title: id, items: Array.from({ length: n }, (_, i) => ({ id: id + i, title: id + i })) });
const never = () => new Promise(() => {});
const later = (ms, v) => () => new Promise((r) => setTimeout(() => r(v), ms));

test("rows that answer are returned in order; null and failed rows are left out", async () => {
  fakeKino();
  const rows = await homeWithin([() => row("a"), () => null, () => { throw new Error("boom"); }, later(20, row("d"))], { budgetMs: 2000 });
  assert.deepEqual(rows.map((r) => r.id), ["a", "d"]);
});

test("a row that never answers does not hold the others: Home ends at the budget with what arrived", async () => {
  fakeKino();
  const t0 = Date.now();
  const rows = await homeWithin([() => row("fast"), never, later(50, row("soon"))], { budgetMs: 400 });
  const took = Date.now() - t0;
  assert.deepEqual(rows.map((r) => r.id), ["fast", "soon"]);
  assert.ok(took >= 350 && took < 900, "took " + took);
});

test("a call that finishes early does not wait for the budget", async () => {
  fakeKino();
  const t0 = Date.now();
  await homeWithin([() => row("a"), later(30, row("b"))], { budgetMs: 5000 });
  assert.ok(Date.now() - t0 < 600, "took " + (Date.now() - t0));
});

test("when no row arrives in time the last good Home is served; with none kept the list is empty", async () => {
  fakeKino();
  assert.deepEqual(await homeWithin([never, never], { budgetMs: 200 }), []);
  await homeWithin([() => row("good", 30)], { budgetMs: 1000 });
  const again = await homeWithin([never], { budgetMs: 200 });
  assert.deepEqual(again.map((r) => r.id), ["good"]);
  assert.ok(again[0].items.length <= 20, "the kept copy is trimmed");
});

test("a kept Home older than twelve hours is not served", async () => {
  const mem = fakeKino();
  await homeWithin([() => row("old")], { budgetMs: 500 });
  const key = [...mem.keys()][0];
  const o = JSON.parse(mem.get(key));
  mem.set(key, JSON.stringify({ ...o, at: Date.now() - 13 * 3600 * 1000 }));
  assert.deepEqual(await homeWithin([never], { budgetMs: 150 }), []);
});

test("within() waits at most the time given for work that hangs, and never rejects", async () => {
  fakeKino();
  const t0 = Date.now();
  await within(250, never());
  assert.ok(Date.now() - t0 < 700);
  await within(250, Promise.reject(new Error("x")));
});
