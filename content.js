document.addEventListener("keydown", (e) => {
  // Option+G (Mac) / Alt+G (Windows/Linux)
  if (e.altKey && e.code === "KeyG") {
    const match = location.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (match) {
      const [, owner, repo, number] = match;
      window.open(
        `https://app.graphite.com/github/${owner}/${repo}/pull/${number}`,
        "_blank"
      );
    }
  }
});
