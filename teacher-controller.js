const statusDot = document.getElementById("statusDot");
const teacherStatus = document.getElementById("teacherStatus");
const allStart = document.getElementById("allStart");
const allPause = document.getElementById("allPause");
const allStop = document.getElementById("allStop");
const speedChoices = document.querySelectorAll(".speed-choice");
const prepareTeacherAudio = document.getElementById("prepareTeacherAudio");
const teacherAudioStatus = document.getElementById("teacherAudioStatus");
const frame = document.getElementById("teacherAudioFrame");

function audioDoc() {
  try { return frame.contentDocument || frame.contentWindow.document; }
  catch (_) { return null; }
}

function audioWindow() {
  try { return frame.contentWindow || null; }
  catch (_) { return null; }
}

function clickAudio(selector) {
  const d = audioDoc();
  const b = d && d.querySelector(selector);
  if (!b) return false;
  b.click();
  return true;
}

prepareTeacherAudio.addEventListener("click", async () => {
  const w = audioWindow();
  if (!w || typeof w.chairoPrepareAudio !== "function") {
    teacherAudioStatus.textContent = "音源を読み込み中です。もう一度押してください";
    return;
  }

  teacherAudioStatus.textContent = "音を準備中…";
  const result = await w.chairoPrepareAudio();
  teacherAudioStatus.textContent = result && result.ok
    ? "✅ 音の準備OK（確認音が鳴れば成功）"
    : "⚠️ もう一度押してください";
});

allStart.addEventListener("click", async () => {
  const cfg = window.CHAIRO_GOOGLE_SYNC || {};
  const startAt = Date.now() + Number(cfg.START_DELAY_MS || 3500);
  setTimeout(() => {
    const w = audioWindow();
    if (w && typeof w.chairoTeacherStart === "function") w.chairoTeacherStart();
    else clickAudio("#startButton");
  }, Math.max(0, startAt - Date.now()));

  try {
    await window.ChairoGoogleSync.send("start", { startAt });
  } catch (e) {
    teacherStatus.textContent = "送信できません";
  }
});

allPause.addEventListener("click", async () => {
  {
    const w = audioWindow();
    if (w && typeof w.chairoTeacherPause === "function") w.chairoTeacherPause();
    else clickAudio("#pauseButton");
  }
  try { await window.ChairoGoogleSync.send("pause", {}); }
  catch (_) { teacherStatus.textContent = "送信できません"; }
});

allStop.addEventListener("click", async () => {
  {
    const w = audioWindow();
    if (w && typeof w.chairoTeacherStop === "function") w.chairoTeacherStop();
    else clickAudio("#stopButton");
  }
  try { await window.ChairoGoogleSync.send("stop", { startAt: 0 }); }
  catch (_) { teacherStatus.textContent = "送信できません"; }
});

speedChoices.forEach(button => {
  button.addEventListener("click", async () => {
    speedChoices.forEach(b => b.classList.remove("selected"));
    button.classList.add("selected");

    const w = audioWindow();
    if (w && typeof w.chairoTeacherSetSpeed === "function") {
      w.chairoTeacherSetSpeed(button.dataset.speed);
    } else {
      const d = audioDoc();
      const audioSpeed = d && d.querySelector(`.speed-button[data-speed="${button.dataset.speed}"]`);
      if (audioSpeed) audioSpeed.click();
    }

    try {
      await window.ChairoGoogleSync.send("speed", { speed: Number(button.dataset.speed) });
    } catch (_) {
      teacherStatus.textContent = "送信できません";
    }
  });
});

window.addEventListener("chairo-google-sync-status", (event) => {
  const s = event.detail || {};
  if (s.connected) {
    statusDot.classList.add("connected");
    teacherStatus.textContent = "Google同期：接続中";
  } else {
    statusDot.classList.remove("connected");
    teacherStatus.textContent = s.configured === false
      ? "Apps Script URLを設定してください"
      : "Google同期：接続待ち";
  }
});
