// ponytail: fixed threshold + batch size, expose in popup if tuning ever matters
const BATCH = 8;
const DELAY_MS = 300;
const THRESHOLD = 0.5;

let enabled = false;
let filter = "";
const judged = new Map(); // id -> probability (in-memory only; reload re-judges)
const queue = new Map(); // id -> {el, text}
let flushTimer = null;
let scanTimer = null;

init();

async function init() {
  const s = await chrome.storage.local.get(["enabled", "filter"]);
  enabled = !!s.enabled;
  filter = s.filter || "";
  scan();

  chrome.storage.onChanged.addListener(() => reset());
  new MutationObserver(scheduleScan).observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// Filter/enabled changed: forget verdicts, unhide everything, rescan.
async function reset() {
  const s = await chrome.storage.local.get(["enabled", "filter"]);
  enabled = !!s.enabled;
  filter = s.filter || "";
  judged.clear();
  queue.clear();
  document.querySelectorAll('article[data-testid="tweet"]').forEach((el) => {
    el.style.display = "";
    delete el.dataset.icSeen;
  });
  scan();
}

function scheduleScan() {
  if (scanTimer) return;
  scanTimer = setTimeout(() => {
    scanTimer = null;
    scan();
  }, 100);
}

function scan() {
  if (!enabled || !filter) return;
  for (const el of document.querySelectorAll('article[data-testid="tweet"]')) {
    if (el.dataset.icSeen) continue;
    const textEl = el.querySelector('[data-testid="tweetText"]');
    if (!textEl) continue; // no text (pure media) — leave alone
    el.dataset.icSeen = "1";
    const text = textEl.textContent.trim();
    if (!text) continue;
    const id = tweetId(el) ?? text;
    const p = judged.get(id);
    if (p !== undefined) apply(el, p);
    else queue.set(id, { el, text });
  }
  if (queue.size >= BATCH) flush();
  else if (queue.size && !flushTimer) flushTimer = setTimeout(flush, DELAY_MS);
}

function tweetId(el) {
  const time = el.querySelector("time");
  const href = time?.parentElement?.href;
  return href?.match(/status\/(\d+)/)?.[1];
}

function flush() {
  clearTimeout(flushTimer);
  flushTimer = null;
  const batch = [...queue.entries()].slice(0, BATCH);
  batch.forEach(([id]) => queue.delete(id));
  if (!batch.length) return;

  chrome.runtime.sendMessage(
    {
      type: "judge",
      filter,
      tweets: batch.map(([id, t]) => ({ id, text: t.text.slice(0, 1000) })),
    },
    (res) => {
      if (chrome.runtime.lastError || !res || res.error) {
        console.warn("[internet-condom]", chrome.runtime.lastError ?? res?.error);
        return; // leave tweet visible on failure
      }
      for (const [id, t] of batch) {
        const p = res.verdicts[id];
        if (p === undefined) continue;
        judged.set(id, p);
        apply(t.el, p);
      }
      if (queue.size) scan();
    }
  );
}

function apply(el, p) {
  el.style.display = p > THRESHOLD ? "none" : "";
}
