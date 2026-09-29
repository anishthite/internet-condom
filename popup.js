const enabled = document.getElementById("enabled");
const filter = document.getElementById("filter");
const key = document.getElementById("key");

chrome.storage.local.get(["enabled", "filter", "apiKey"], (s) => {
  enabled.checked = !!s.enabled;
  filter.value = s.filter || "";
  key.value = s.apiKey || "";
});

enabled.addEventListener("change", () =>
  chrome.storage.local.set({ enabled: enabled.checked })
);
filter.addEventListener("input", () =>
  chrome.storage.local.set({ filter: filter.value })
);
key.addEventListener("input", () =>
  chrome.storage.local.set({ apiKey: key.value.trim() })
);
