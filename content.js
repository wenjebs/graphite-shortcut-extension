// Parse {owner, repo, number} from either a GitHub or Graphite PR URL.
function parsePr() {
  const path = location.pathname;
  // GitHub:   /owner/repo/pull/123
  // Graphite: /github/pr/owner/repo/123  (also tolerate the older /github/owner/repo/pull/123)
  const gh = path.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  const gt =
    path.match(/^\/github\/pr\/([^/]+)\/([^/]+)\/(\d+)/) ||
    path.match(/^\/github\/([^/]+)\/([^/]+)\/pull\/(\d+)/);

  if (location.hostname.endsWith("graphite.com")) {
    if (!gt) return null;
    const [, owner, repo, number] = gt;
    return { owner, repo, number, site: "graphite" };
  }
  if (!gh) return null;
  const [, owner, repo, number] = gh;
  return { owner, repo, number, site: "github" };
}

function urls({ owner, repo, number }) {
  return {
    github: `https://github.com/${owner}/${repo}/pull/${number}`,
    graphite: `https://app.graphite.com/github/pr/${owner}/${repo}/${number}`,
  };
}

// ---- Settings (shortcuts + crane physics), synced from the popup ----------

const DEFAULTS = {
  shortcuts: {
    toggle: { altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, code: "KeyG" },
    copy: { altKey: false, ctrlKey: true, metaKey: false, shiftKey: false, code: "KeyP" },
  },
  cranes: {
    count: 100,
    sizeMin: 26,
    sizeMax: 70,
    spread: 0.55, // fraction of viewport width the burst reaches
    gravity: 80, // extra downward pull (px)
    spin: 540, // max rotation each way (deg)
    durMin: 0.9,
    durMax: 1.7,
  },
};

let shortcuts = structuredClone(DEFAULTS.shortcuts);
let cranes = structuredClone(DEFAULTS.cranes);

if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
  chrome.storage.sync.get(["shortcuts", "cranes"], (r) => {
    if (r.shortcuts) shortcuts = { ...shortcuts, ...r.shortcuts };
    if (r.cranes) cranes = { ...cranes, ...r.cranes };
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes.shortcuts) shortcuts = { ...DEFAULTS.shortcuts, ...changes.shortcuts.newValue };
    if (changes.cranes) cranes = { ...DEFAULTS.cranes, ...changes.cranes.newValue };
  });
}

// Does a keydown event match a stored shortcut combo?
function matches(e, sc) {
  return (
    !!sc &&
    e.code === sc.code &&
    e.altKey === sc.altKey &&
    e.ctrlKey === sc.ctrlKey &&
    e.metaKey === sc.metaKey &&
    e.shiftKey === sc.shiftKey
  );
}

// Crane.svg, inlined so it can be cloned 100× without a network/asset fetch.
const CRANE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 835 665.1">' +
  '<path fill="#FDBB11" d="M398.8,451.9l171.7-32.7l13.4-3.1L411.6,15.3C407.6,6.1,398.7,0.1,388.7,0v33.7L398.8,451.9z"/>' +
  '<path fill="#76BF47" d="M380.8,451.9l-173.9-32.7l-13.4-3.1L365.9,15.3c3.9-9.1,12.9-15.1,22.9-15.3v33.7L380.8,451.9z"/>' +
  '<path fill="#F48340" d="M399.1,470.5l-10.3,158.6l-0.8,14.5l90.2,20.5c21,4.8,41.9-8.4,46.7-29.4l56-205.2l3.6-13l-0.2-0.5l-14.8,3.4"/>' +
  '<path fill="#8068AD" d="M379.8,469.2l9.1,159.9l0.9,14.5l-90.2,20.5c-21,4.8-41.9-8.4-46.7-29.4l-56-205.2l-3.6-13l0.2-0.5l14.8,3.4"/>' +
  '<polygon fill="#EE4580" points="570.4,557.5 611.7,416 555.8,289.1 679,235.9 775.3,235.9"/>' +
  '<path fill="#C0BCC0" d="M756.3,321l62.1,29.5c10.1,4.8,20.4-6.1,15.1-15.9l-54-99L756.3,321z"/>' +
  '<path fill="#458FCD" d="M207.1,558.6l-41-144.8L221,289L22.9,179.6c-13.6-7.5-28.5,7.6-20.8,21.1L207.1,558.6z"/>' +
  '</svg>';
const CRANE_URL = "data:image/svg+xml;utf8," + encodeURIComponent(CRANE_SVG);

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for contexts where the async clipboard API is unavailable.
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
  return Promise.resolve();
}

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes gpr-pop {
      0%   { transform: translate(-50%, -50%) scale(0)   rotate(-12deg); opacity: 0; }
      55%  { transform: translate(-50%, -50%) scale(1.25) rotate(4deg);  opacity: 1; }
      70%  { transform: translate(-50%, -50%) scale(0.95) rotate(-2deg); }
      82%  { transform: translate(-50%, -50%) scale(1.05) rotate(1deg);  }
      100% { transform: translate(-50%, -50%) scale(1)    rotate(0deg);  opacity: 1; }
    }
    @keyframes gpr-fade {
      0%   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      100% { opacity: 0; transform: translate(-50%, -56%) scale(1.1); }
    }
    @keyframes gpr-particle {
      0%   { transform: translate(-50%, -50%) translate(0, 0) scale(1) rotate(0deg); opacity: 1; }
      100% { transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) scale(0.4) rotate(var(--rot)); opacity: 0; }
    }
    @keyframes gpr-shockwave {
      0%   { transform: translate(-50%, -50%) scale(0);   opacity: 0.9; }
      100% { transform: translate(-50%, -50%) scale(6);   opacity: 0; }
    }
    @keyframes gpr-crane {
      0%   { transform: translate(-50%, -50%) translate(0, 0) scale(0.2) rotate(0deg); opacity: 0; }
      12%  { opacity: 1; }
      100% { transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) scale(var(--scl)) rotate(var(--rot)); opacity: 0; }
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

function celebrate(message) {
  injectStyles();

  const cfg = cranes;
  const layer = document.createElement("div");
  layer.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;pointer-events:none;overflow:hidden;";

  // Expanding shockwave ring.
  const wave = document.createElement("div");
  wave.style.cssText = [
    "position:absolute",
    "top:50%",
    "left:50%",
    "width:120px",
    "height:120px",
    "border-radius:50%",
    "border:6px solid #FDBB11",
    "animation:gpr-shockwave .7s ease-out forwards",
  ].join(";");
  layer.appendChild(wave);

  // N paper cranes bursting outward from center like fireworks.
  const count = Math.max(0, Math.round(cfg.count));
  const sizeMin = Math.min(cfg.sizeMin, cfg.sizeMax);
  const sizeSpan = Math.max(0, cfg.sizeMax - cfg.sizeMin);
  const reach = Math.max(window.innerWidth, 600) * cfg.spread;
  for (let i = 0; i < count; i++) {
    const c = document.createElement("img");
    c.src = CRANE_URL;
    // Even angular spread + jitter so the burst fills the screen, not a ring.
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 120 + Math.random() * reach;
    const size = sizeMin + Math.random() * sizeSpan;
    c.style.cssText = [
      "position:absolute",
      "top:50%",
      "left:50%",
      `width:${size}px`,
      "height:auto",
      "filter:drop-shadow(0 4px 8px rgba(0,0,0,.25))",
      `--dx:${Math.cos(angle) * dist}px`,
      // Bias downward so cranes "rain" out under gravity.
      `--dy:${Math.sin(angle) * dist + cfg.gravity + Math.random() * 120}px`,
      `--rot:${(Math.random() * cfg.spin * 2 - cfg.spin) | 0}deg`,
      `--scl:${(0.5 + Math.random() * 0.5).toFixed(2)}`,
      `animation:gpr-crane ${(cfg.durMin + Math.random() * Math.max(0, cfg.durMax - cfg.durMin)).toFixed(2)}s cubic-bezier(.17,.67,.34,1) forwards`,
      `animation-delay:${(Math.random() * 0.12).toFixed(3)}s`,
    ].join(";");
    layer.appendChild(c);
  }

  // Big whimsical banner.
  const banner = document.createElement("div");
  banner.textContent = `💥 ${message} 💥`;
  banner.style.cssText = [
    "position:absolute",
    "top:50%",
    "left:50%",
    "text-align:center",
    "white-space:nowrap",
    "font:900 clamp(34px, 8vw, 72px)/1.05 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    "letter-spacing:-1px",
    "color:#fff",
    "padding:18px 34px",
    "border-radius:22px",
    "background:linear-gradient(135deg,#76BF47 0%,#FDBB11 22%,#F48340 44%,#EE4580 66%,#8068AD 84%,#458FCD 100%)",
    "box-shadow:0 16px 50px rgba(128,104,173,.45),0 4px 14px rgba(0,0,0,.3)",
    "text-shadow:0 3px 0 rgba(0,0,0,.18)",
    "transform:translate(-50%,-50%) scale(0)",
    "animation:gpr-pop .5s cubic-bezier(.2,1.3,.4,1) forwards",
  ].join(";");
  layer.appendChild(banner);

  document.body.appendChild(layer);

  // Hold, then fade the banner and tear down the whole layer.
  const life = Math.max(2000, cfg.durMax * 1000 + 300);
  setTimeout(() => {
    banner.style.animation = "gpr-fade .4s ease-in forwards";
  }, life - 600);
  setTimeout(() => layer.remove(), life);
}

document.addEventListener("keydown", (e) => {
  // Toggle between GitHub and Graphite views of this PR.
  if (matches(e, shortcuts.toggle)) {
    const pr = parsePr();
    if (!pr) return;
    e.preventDefault();
    const u = urls(pr);
    const target = pr.site === "github" ? u.graphite : u.github;
    window.open(target, "_blank");
    return;
  }

  // Copy both links, nicely formatted, to the clipboard.
  if (matches(e, shortcuts.copy)) {
    const pr = parsePr();
    if (!pr) return;
    e.preventDefault();
    const u = urls(pr);
    const text = `PR #${pr.number}\nGitHub:   ${u.github}\nGraphite: ${u.graphite}`;
    copyText(text)
      .then(() => celebrate(`COPIED PR #${pr.number}!`))
      .catch(() => celebrate("COPY FAILED"));
  }
});

// Let the popup fire a test burst on the current page.
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "gpr-test") celebrate("CRANE TEST! 🐦");
  });
}
