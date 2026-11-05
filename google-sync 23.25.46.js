(() => {
  const cfg = window.CHAIRO_GOOGLE_SYNC || {};
  const params = new URLSearchParams(location.search);
  const role = params.get("role") || "student";
  const listeners = new Set();
  let lastVersion = -1;
  let callbackSeq = 0;
  let pollTimer = null;

  function configured() {
    return Boolean(cfg.WEB_APP_URL);
  }

  function emitStatus(extra = {}) {
    window.dispatchEvent(new CustomEvent("chairo-google-sync-status", {
      detail: { configured: configured(), role, ...extra }
    }));
  }

  function buildUrl(paramsObj) {
    const u = new URL(cfg.WEB_APP_URL);
    Object.entries(paramsObj).forEach(([k, v]) => {
      if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
    });
    u.searchParams.set("_", Date.now() + "-" + Math.random().toString(36).slice(2));
    return u.toString();
  }

  function readStateJsonp() {
    if (!configured()) {
      emitStatus({ connected: false, error: "Apps Script URL未設定" });
      return;
    }

    const cbName = "__chairoSyncCb" + (++callbackSeq);
    const script = document.createElement("script");
    let finished = false;

    const cleanup = () => {
      if (finished) return;
      finished = true;
      try { delete window[cbName]; } catch (_) {}
      script.remove();
    };

    window[cbName] = (payload) => {
      cleanup();
      emitStatus({ connected: true });

      const state = payload && payload.state;
      if (!state) return;

      const version = Number(state.version || 0);
      if (version === lastVersion) return;
      lastVersion = version;

      listeners.forEach(fn => {
        try { fn(state); } catch (_) {}
      });
    };

    script.onerror = () => {
      cleanup();
      emitStatus({ connected: false, error: "同期に接続できません" });
    };

    script.src = buildUrl({ action: "state", callback: cbName });
    document.head.appendChild(script);

    setTimeout(() => {
      if (!finished) {
        cleanup();
        emitStatus({ connected: false, error: "同期応答なし" });
      }
    }, 5000);
  }

  async function send(command, data = {}) {
    if (!configured()) throw new Error("Apps Script URL未設定");

    const url = buildUrl({
      action: "set",
      command,
      speed: data.speed,
      accompaniment: data.accompaniment,
      startAt: data.startAt
    });

    await fetch(url, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      credentials: "omit"
    });
  }

  function startPolling() {
    if (role === "audio") return;
    if (pollTimer) return;

    const tick = () => {
      readStateJsonp();
      pollTimer = setTimeout(tick, Math.max(700, Number(cfg.POLL_MS || 1200)));
    };
    tick();
  }

  window.ChairoGoogleSync = {
    get configured() { return configured(); },
    send,
    onState(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    startPolling
  };

  window.addEventListener("load", startPolling);
})();
