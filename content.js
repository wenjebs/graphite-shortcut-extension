// Parse {owner, repo, number} from either a GitHub or Graphite PR URL.
function parsePr() {
  const path = location.pathname;
  // GitHub:   /owner/repo/pull/123
  // Graphite: /github/owner/repo/pull/123
  const gh = path.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  const gt = path.match(/^\/github\/([^/]+)\/([^/]+)\/pull\/(\d+)/);

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
    graphite: `https://app.graphite.com/github/${owner}/${repo}/pull/${number}`,
  };
}

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
  `;
  (document.head || document.documentElement).appendChild(style);
}

function celebrate(message) {
  injectStyles();

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
    "border:6px solid #ffd23f",
    "animation:gpr-shockwave .7s ease-out forwards",
  ].join(";");
  layer.appendChild(wave);

  // Flying particles bursting outward from center.
  const bits = ["💥", "🎉", "✨", "🚀", "⭐", "🔥", "💫", "🎊"];
  const count = 26;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 180 + Math.random() * 220;
    p.textContent = bits[i % bits.length];
    p.style.cssText = [
      "position:absolute",
      "top:50%",
      "left:50%",
      `font-size:${22 + Math.random() * 26}px`,
      `--dx:${Math.cos(angle) * dist}px`,
      `--dy:${Math.sin(angle) * dist}px`,
      `--rot:${(Math.random() * 720 - 360) | 0}deg`,
      `animation:gpr-particle ${0.7 + Math.random() * 0.5}s cubic-bezier(.17,.67,.34,1) forwards`,
    ].join(";");
    layer.appendChild(p);
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
    "background:linear-gradient(135deg,#ff4d4d 0%,#ff7a18 35%,#ffd23f 70%,#7c3aed 100%)",
    "box-shadow:0 16px 50px rgba(124,58,237,.45),0 4px 14px rgba(0,0,0,.3)",
    "text-shadow:0 3px 0 rgba(0,0,0,.18)",
    "transform:translate(-50%,-50%) scale(0)",
    "animation:gpr-pop .5s cubic-bezier(.2,1.3,.4,1) forwards",
  ].join(";");
  layer.appendChild(banner);

  document.body.appendChild(layer);

  // Hold, then fade the banner and tear down the whole layer.
  setTimeout(() => {
    banner.style.animation = "gpr-fade .4s ease-in forwards";
  }, 1100);
  setTimeout(() => layer.remove(), 1700);
}

document.addEventListener("keydown", (e) => {
  // Option+G — toggle between GitHub and Graphite views of this PR.
  if (e.altKey && e.code === "KeyG") {
    const pr = parsePr();
    if (!pr) return;
    const u = urls(pr);
    const target = pr.site === "github" ? u.graphite : u.github;
    window.open(target, "_blank");
    return;
  }

  // Ctrl+P — copy both links, nicely formatted, to the clipboard.
  if (e.ctrlKey && e.code === "KeyP") {
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
