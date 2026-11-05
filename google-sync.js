(() => {
  const cfg = window.CHAIRO_GOOGLE_SYNC || {};
  const params = new URLSearchParams(location.search);
  const role = params.get("role") || "student";
  const listeners = new Set();

  let running = false;
  let lastVersion = -1;
  let callbackSeq = 0;
  let pollTimer = null;

  function configured() {
    return Boolean(cfg.WEB_APP_URL);
  }

  function emitStatus(extra = {}) {
    window.dispatchEvent(new CustomEvent("chairo-google-sync-status", {
      detail: {
        configured: configured(),
        role,
        running,
        lastVersion,
        ...extra
      }
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
      emitStatus({ error: "Apps Script URL未設定" });
      return;
    }

    const cbName = "__chairoSyncCb" + (++callbackSeq);
    const script = document.createElement("script");
    let done = false;

    const cleanup = () => {
      if (done) return;
      done = true;
      try { delete window[cbName]; } catch (_) { window[cbName] = undefined; }
      script.remove();
    };

    window[cbName] = (payload) => {
      cleanup();
      running = true;
      emitStatus({ connected: true });

      const state = payload && payload.state;
      if (!state) return;

      const version = Number(state.version || 0);
      if (version === lastVersion) return;
      lastVersion = version;

      listeners.forEach((fn) => {
        try { fn(state); } catch (_) {}
      });
    };

    script.onerror = () => {
      cleanup();
      running = false;
      emitStatus({ connected: false, error: "Google同期に接続できません" });
    };

    script.src = buildUrl({
      action: "state",
      callback: cbName
    });

    document.head.appendChild(script);

    setTimeout(() => {
      if (!done) {
        cleanup();
        running = false;
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

    // GitHub Pages -> Apps Script へのCORS制限を避けるため no-cors GET。
    // 書き込み結果は次回ポーリングで確認する。
    await fetch(url, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      credentials: "omit"
    });
  }

  function startPolling() {
    if (role === "audio") return;
    if (!configured()) {
      emitStatus({ connected: false, error: "Apps Script URL未設定" });
      return;
    }
    if (pollTimer) return;

    const tick = () => {
      readStateJsonp();
      pollTimer = setTimeout(tick, Math.max(700, Number(cfg.POLL_MS || 1200)));
    };
    tick();
  }

  function onState(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  window.ChairoGoogleSync = {
    get configured() { return configured(); },
    get connected() { return running; },
    send,
    onState,
    startPolling
  };

  window.addEventListener("load", startPolling);
})();
