// Keep these in sync with DEFAULTS in content.js.
const DEFAULTS = {
  shortcuts: {
    toggle: { altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, code: "KeyG" },
    copy: { altKey: false, ctrlKey: true, metaKey: false, shiftKey: false, code: "KeyP" },
  },
  cranes: {
    count: 100,
    sizeMin: 26,
    sizeMax: 70,
    spread: 0.55,
    gravity: 80,
    spin: 540,
    durMin: 0.9,
    durMax: 1.7,
  },
};

const SLIDERS = ["count", "sizeMin", "sizeMax", "spread", "gravity", "spin", "durMin", "durMax"];
const DECIMALS = { spread: 2, durMin: 1, durMax: 1 };

let state = structuredClone(DEFAULTS);

const isMac = navigator.platform.toUpperCase().includes("MAC");

// Render a stored combo as something human-readable, e.g. "Ctrl + P".
function comboLabel(sc) {
  if (!sc) return "Not set";
  const parts = [];
  if (sc.ctrlKey) parts.push("Ctrl");
  if (sc.altKey) parts.push(isMac ? "Option" : "Alt");
  if (sc.shiftKey) parts.push("Shift");
  if (sc.metaKey) parts.push(isMac ? "Cmd" : "Win");
  parts.push(keyName(sc.code));
  return parts.join(" + ");
}

function keyName(code) {
  if (!code) return "?";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return "Num " + code.slice(6);
  if (code.startsWith("Arrow")) return code.slice(5) + " Arrow";
  return code;
}

const MODIFIER_CODES = new Set([
  "ControlLeft", "ControlRight", "AltLeft", "AltRight",
  "ShiftLeft", "ShiftRight", "MetaLeft", "MetaRight", "OSLeft", "OSRight",
]);

function status(msg, color) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.style.color = color || "var(--green)";
}

function save() {
  chrome.storage.sync.set({ shortcuts: state.shortcuts, cranes: state.cranes });
  status("Saved ✓");
}

// ---- Shortcut recorders ---------------------------------------------------

let recordingKey = null;

function renderCombo(key) {
  const el = document.querySelector(`.combo[data-key="${key}"]`);
  el.textContent = recordingKey === key ? "Press keys…" : comboLabel(state.shortcuts[key]);
  el.classList.toggle("recording", recordingKey === key);
}

function startRecording(key) {
  recordingKey = key;
  renderCombo("toggle");
  renderCombo("copy");
  status("Recording — Esc to cancel", "var(--pink)");
}

function stopRecording() {
  const k = recordingKey;
  recordingKey = null;
  if (k) renderCombo(k);
}

document.querySelectorAll(".combo").forEach((el) => {
  const key = el.dataset.key;
  el.addEventListener("click", () => startRecording(key));
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      startRecording(key);
    }
  });
});

document.addEventListener("keydown", (e) => {
  if (!recordingKey) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.key === "Escape") {
    stopRecording();
    status("Cancelled", "var(--gray)");
    return;
  }
  // Wait for a real (non-modifier) key.
  if (MODIFIER_CODES.has(e.code)) return;
  state.shortcuts[recordingKey] = {
    altKey: e.altKey,
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey,
    shiftKey: e.shiftKey,
    code: e.code,
  };
  stopRecording();
  save();
});

// ---- Crane sliders --------------------------------------------------------

function renderSlider(id) {
  const dec = DECIMALS[id] || 0;
  document.getElementById("v-" + id).textContent = Number(state.cranes[id]).toFixed(dec);
  document.getElementById(id).value = state.cranes[id];
}

SLIDERS.forEach((id) => {
  document.getElementById(id).addEventListener("input", (e) => {
    state.cranes[id] = parseFloat(e.target.value);
    // Keep min ≤ max for size and duration pairs.
    if (id === "sizeMin" && state.cranes.sizeMin > state.cranes.sizeMax) {
      state.cranes.sizeMax = state.cranes.sizeMin;
      renderSlider("sizeMax");
    }
    if (id === "sizeMax" && state.cranes.sizeMax < state.cranes.sizeMin) {
      state.cranes.sizeMin = state.cranes.sizeMax;
      renderSlider("sizeMin");
    }
    if (id === "durMin" && state.cranes.durMin > state.cranes.durMax) {
      state.cranes.durMax = state.cranes.durMin;
      renderSlider("durMax");
    }
    if (id === "durMax" && state.cranes.durMax < state.cranes.durMin) {
      state.cranes.durMin = state.cranes.durMax;
      renderSlider("durMin");
    }
    document.getElementById("v-" + id).textContent = Number(state.cranes[id]).toFixed(DECIMALS[id] || 0);
    save();
  });
});

// ---- Buttons --------------------------------------------------------------

document.getElementById("reset").addEventListener("click", () => {
  state = structuredClone(DEFAULTS);
  renderAll();
  save();
  status("Reset to defaults ✓");
});

document.getElementById("test").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab) return;
    chrome.tabs.sendMessage(tab.id, { type: "gpr-test" }, () => {
      if (chrome.runtime.lastError) {
        status("Open a GitHub/Graphite PR tab to test", "var(--orange)");
      } else {
        status("🐦 Cranes away!");
      }
    });
  });
});

// ---- Init -----------------------------------------------------------------

function renderAll() {
  renderCombo("toggle");
  renderCombo("copy");
  SLIDERS.forEach(renderSlider);
}

chrome.storage.sync.get(["shortcuts", "cranes"], (r) => {
  if (r.shortcuts) state.shortcuts = { ...DEFAULTS.shortcuts, ...r.shortcuts };
  if (r.cranes) state.cranes = { ...DEFAULTS.cranes, ...r.cranes };
  renderAll();
});
