
const statusText = document.getElementById("statusText");
const allStart = document.getElementById("allStart");
const allPause = document.getElementById("allPause");
const allStop = document.getElementById("allStop");
const speedChoices = document.querySelectorAll(".speed-choice");
const teacherAccompaniment = document.getElementById("teacherAccompaniment");

let accompanimentOn = true;

async function send(command, data = {}, label = "") {
  try {
    if (window.ChairoNetwork) {
      await window.ChairoNetwork.send(command, data);
      statusText.textContent = label || `送信しました：${command}`;
      return;
    }

    if (window.ChairoSync) {
      window.ChairoSync.send(command, data);
      statusText.textContent = (label || `送信しました：${command}`) + "（同じ端末内テスト）";
      return;
    }

    statusText.textContent = "同期機能を準備中です";
  } catch (error) {
    statusText.textContent = "送信できません：" + (error?.message || error);
  }
}

allStart.addEventListener("click", () => {
  send("start", {}, "▶ みんなスタート を送信しました");
});

allPause.addEventListener("click", () => {
  send("pause", {}, "⏸ いちじていし を送信しました");
});

allStop.addEventListener("click", () => {
  send("stop", {}, "⏹ ストップ を送信しました");
});

speedChoices.forEach((button) => {
  button.addEventListener("click", () => {
    speedChoices.forEach((item) => item.classList.remove("selected"));
    button.classList.add("selected");
    send(
      "speed",
      { speed: Number(button.dataset.speed) },
      `はやさを「${button.textContent.trim()}」にそろえました`
    );
  });
});

teacherAccompaniment.addEventListener("click", () => {
  accompanimentOn = !accompanimentOn;
  teacherAccompaniment.classList.toggle("selected", accompanimentOn);
  teacherAccompaniment.textContent = accompanimentOn ? "🎹 伴奏 ON" : "🎹 伴奏 OFF";
  send(
    "accompaniment",
    { on: accompanimentOn },
    accompanimentOn ? "🎹 伴奏ON を送信しました" : "伴奏OFF を送信しました"
  );
});


/* Mac親機との接続状態・接続台数 */
const connectedCount = document.getElementById("connectedCount");

async function refreshClientStatus() {
  if (!window.ChairoNetwork) return;

  try {
    const status = await window.ChairoNetwork.getStatus();
    if (connectedCount) connectedCount.textContent = String(status.count ?? 0);
  } catch (_) {}
}

window.addEventListener("chairo-network-status", (event) => {
  const state = event.detail || {};
  const dot = document.getElementById("statusDot");

  if (state.connected) {
    dot.style.background = "#55b96b";
    statusText.textContent = "Mac親機に接続できました";
  } else {
    dot.style.background = "#e3a63b";
    statusText.textContent = "Mac親機への再接続を待っています";
  }
});

setInterval(refreshClientStatus, 2000);
refreshClientStatus();


const syncQuality = document.getElementById("syncQuality");

window.addEventListener("chairo-network-status", (event) => {
  const state = event.detail || {};

  if (!syncQuality) return;

  if (!state.connected) {
    syncQuality.textContent = "同期時計：接続待ち";
    return;
  }

  if (!state.clockReady) {
    syncQuality.textContent = "同期時計：調整中…";
    return;
  }

  const rtt = Number(state.bestRttMs);
  if (Number.isFinite(rtt)) {
    syncQuality.textContent = `同期時計：OK（通信 ${Math.round(rtt)}ms）`;
  } else {
    syncQuality.textContent = "同期時計：OK";
  }
});
