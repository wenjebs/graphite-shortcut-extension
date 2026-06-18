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

function toast(message) {
  const el = document.createElement("div");
  el.textContent = message;
  el.style.cssText = [
    "position:fixed",
    "bottom:24px",
    "left:50%",
    "transform:translateX(-50%)",
    "z-index:2147483647",
    "background:#1f2328",
    "color:#fff",
    "font:500 13px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
    "padding:8px 14px",
    "border-radius:6px",
    "box-shadow:0 4px 12px rgba(0,0,0,.3)",
    "pointer-events:none",
    "opacity:0",
    "transition:opacity .15s ease",
  ].join(";");
  document.body.appendChild(el);
  requestAnimationFrame(() => (el.style.opacity = "1"));
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 200);
  }, 1400);
}

document.addEventListener("keydown", (e) => {
  // Option+Shift+G — toggle between GitHub and Graphite views of this PR.
  if (e.altKey && e.shiftKey && e.code === "KeyG") {
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
      .then(() => toast(`Copied PR #${pr.number} links`))
      .catch(() => toast("Copy failed"));
  }
});
