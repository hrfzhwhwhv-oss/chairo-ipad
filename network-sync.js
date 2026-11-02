/*
  Mac親機版 高精度同期通信
  - Macを基準時計として使用
  - /api/time を複数回測定して、各iPadとMacの時計差を推定
  - STARTは全端末で同じMac時刻を目標に実行
*/
(() => {
  const listeners = new Set();
  let version = 0;
  let running = true;
  let connected = false;

  // serverTime ≒ Date.now() + clockOffsetMs
  let clockOffsetMs = 0;
  let clockReady = false;
  let bestRttMs = Infinity;

  const clientId =
    sessionStorage.getItem("chairo-client-id") ||
    `student-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  sessionStorage.setItem("chairo-client-id", clientId);

  function currentPartLabel() {
    try {
      const instrument =
        document.querySelector(".instrument-button.selected-mode")?.textContent?.trim() || "";

      const visibleGroups = [
        document.getElementById("xylophoneModeButtons"),
        document.getElementById("bellModeButtons"),
        document.getElementById("bassModeButtons")
      ].filter((el) => el && !el.classList.contains("hidden"));

      const part =
        visibleGroups[0]?.querySelector(".part-button.selected-mode")?.textContent?.trim() || "";

      return `${instrument} ${part}`.trim();
    } catch (_) {
      return "";
    }
  }

  function announce(extra = {}) {
    window.dispatchEvent(
      new CustomEvent("chairo-network-status", {
        detail: {
          connected,
          clientId,
          clockReady,
          clockOffsetMs,
          bestRttMs: Number.isFinite(bestRttMs) ? bestRttMs : null,
          ...extra
        }
      })
    );
  }

  async function sampleClock() {
    const t0 = Date.now();
    const response = await fetch(`/api/time?_=${t0}`, { cache: "no-store" });
    const t1 = Date.now();

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    const serverNow = Number(payload.serverNow);
    const rtt = Math.max(0, t1 - t0);
    const midpoint = (t0 + t1) / 2;
    const offset = serverNow - midpoint;

    return { rtt, offset };
  }

  async function syncClock(sampleCount = 7) {
    const samples = [];

    for (let i = 0; i < sampleCount; i += 1) {
      try {
        samples.push(await sampleClock());
      } catch (_) {}

      if (i < sampleCount - 1) {
        await new Promise((resolve) => setTimeout(resolve, 70));
      }
    }

    if (!samples.length) return false;

    // Lowest RTT is usually the least network-delayed estimate.
    samples.sort((a, b) => a.rtt - b.rtt);
    const best = samples.slice(0, Math.min(3, samples.length));

    const newOffset =
      best.reduce((sum, item) => sum + item.offset, 0) / best.length;
    const newBestRtt = best[0].rtt;

    // Initial sync uses the measured value directly.
    // Later syncs are gently smoothed so the target does not jump.
    if (!clockReady) {
      clockOffsetMs = newOffset;
    } else {
      clockOffsetMs = clockOffsetMs * 0.7 + newOffset * 0.3;
    }

    bestRttMs = newBestRtt;
    clockReady = true;
    announce();
    return true;
  }

  function serverToLocalTime(serverTimestampMs) {
    return Number(serverTimestampMs) - clockOffsetMs;
  }

  function localToServerTime(localTimestampMs) {
    return Number(localTimestampMs) + clockOffsetMs;
  }

  async function poll() {
    while (running) {
      try {
        const part = encodeURIComponent(currentPartLabel());
        const url =
          `/api/poll?after=${version}&client=${encodeURIComponent(clientId)}&part=${part}`;

        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const payload = await response.json();
        connected = true;
        announce();

        if (typeof payload.version === "number") {
          version = Math.max(version, payload.version);
        }

        if (payload.command) {
          listeners.forEach((listener) => listener(payload.command));
        }
      } catch (error) {
        connected = false;
        announce({ error: error?.message || String(error) });
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
    }
  }

  async function send(command, data = {}) {
    const response = await fetch("/api/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ command, data })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function getStatus() {
    const response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  window.ChairoNetwork = {
    get connected() { return connected; },
    get clockReady() { return clockReady; },
    get clockOffsetMs() { return clockOffsetMs; },
    get bestRttMs() { return bestRttMs; },

    send,
    getStatus,
    syncClock,
    serverToLocalTime,
    localToServerTime,

    onCommand(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };

  // Do clock sync before/alongside command polling.
  syncClock(9);
  setInterval(() => syncClock(5), 15000);
  poll();
})();
