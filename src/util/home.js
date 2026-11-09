// Home inside Kino's 20 s. A TV box spends several of them on its own, and a Promise.all over the rows waits for the slowest site (each
// request may wait 15 s): measured on users' devices Home ran 21-26 s and Kino threw the whole answer away. So the rows are asked
// together, the ones that answered inside the budget are shown, the slow ones go on filling the cache for the next opening, and the last
// Home that worked is kept (12 h) for when none answers in time.
const BUDGET_MS = 11000;
const KEEP_MS = 12 * 60 * 60 * 1000;
const MAX_CHARS = 60 * 1024;

function keep(key, rows) {
  try {
    for (let per = 20; per >= 4; per -= 4) {
      const text = JSON.stringify({ at: Date.now(), rows: rows.map((r) => ({ ...r, items: Array.isArray(r.items) ? r.items.slice(0, per) : r.items })) });
      if (text.length <= MAX_CHARS) {
        kino.storage.set(key, text, { ttlMs: KEEP_MS });
        return;
      }
    }
  } catch (_) {
    // a full storage only costs the fallback
  }
}

function kept(key) {
  try {
    const o = JSON.parse(kino.storage.get(key) || "null");
    return o && Date.now() - o.at < KEEP_MS && Array.isArray(o.rows) && o.rows.length ? o.rows : null;
  } catch (_) {
    return null;
  }
}

/**
 * [jobs]: functions that each answer a row (or null). Resolves with the rows that answered within [budgetMs], in order; with none,
 * the last Home kept; else an empty list. A job that is still running when the budget ends is not cancelled: it finishes into
 * the caches (and the saved copy is refreshed the next time).
 */
export async function homeWithin(jobs, { key = "home:last", budgetMs = BUDGET_MS } = {}) {
  const out = jobs.map(() => null);
  let done = false;
  const all = Promise.all(jobs.map((job, i) => Promise.resolve().then(job).then((row) => { out[i] = row; }, () => {}))).then(() => { done = true; });
  const end = Date.now() + budgetMs;
  // Short sleeps instead of one long one, so a call that finishes early does not leave a long timer behind.
  while (!done && Date.now() < end) await Promise.race([all, kino.sleep(Math.min(250, Math.max(1, end - Date.now())))]);
  const rows = out.filter(Boolean);
  if (rows.length) {
    keep(key, rows);
    return rows;
  }
  return kept(key) || [];
}

/** Waits for [work] at most [ms] (never rejects); what it was doing goes on after that (a cover-art lookup, say, fills the cache). */
export async function within(ms, work) {
  let done = false;
  const p = Promise.resolve(work).then(() => { done = true; }, () => { done = true; });
  const end = Date.now() + ms;
  while (!done && Date.now() < end) await Promise.race([p, kino.sleep(Math.min(250, Math.max(1, end - Date.now())))]);
}
