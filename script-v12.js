const songData = window.CHAIRO_SONG_DATA;
if (!songData) {
  throw new Error("曲データが読み込めませんでした。songs/chairo-data.js を確認してください。");
}

const noteInformation = songData.noteInformation;
const xylophoneSong = songData.parts.xylophone;
const bellSong = songData.parts.bell;
const bassSong = songData.parts.bass;

const currentNoteElement = document.getElementById("currentNote");
const waitingArea = document.getElementById("waitingArea");
const waitingText = document.getElementById("waitingText");
const melodyElement = document.getElementById("melody");
const modeMessage = document.getElementById("modeMessage");
const actionMessage = document.getElementById("actionMessage");

const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const stopButton = document.getElementById("stopButton");
const speedButtons = document.querySelectorAll(".speed-button");
const instrumentButtons = document.querySelectorAll(".instrument-button");
const xylophoneKeys = document.querySelectorAll(".xylophone-key");
const bassKeys = document.querySelectorAll("[data-bass-note]");

const xylophoneModeButtons = document.getElementById("xylophoneModeButtons");
const bellModeButtons = document.getElementById("bellModeButtons");
const bassModeButtons = document.getElementById("bassModeButtons");
const colorInstrumentArea = document.getElementById("colorInstrumentArea");
const bassKeyboardArea = document.getElementById("bassKeyboardArea");

let selectedInstrument = "xylophone";
let selectedMode = "all";
let currentSong = xylophoneSong;
let currentIndex = 0;
let timer = null;
let speed = Number(songData.defaultSpeedMs || 700);
let audioContext = null;

let lessonMode = "practice";
const pageRole = new URLSearchParams(window.location.search).get("role") || "student";
const isMacAudioSource = pageRole === "audio";
const MODE_STORAGE_KEY = "chairo-kobin-lesson-mode-v3";

/*
  音を出すかどうかの最終判定
  - Mac伴奏画面 (?role=audio) は常に音あり
  - 通常iPadは練習モードだけ音あり
  - 合奏モードのiPadは完全に無音
*/
function shouldOutputAudio() {
  return isMacAudioSource || lessonMode === "practice";
}

function setLessonMode(mode) {
  lessonMode = isMacAudioSource
    ? "practice"
    : (mode === "ensemble" ? "ensemble" : "practice");

  const practiceButton = document.getElementById("practiceModeButton");
  const ensembleButton = document.getElementById("ensembleModeButton");
  const status = document.getElementById("lessonModeStatus");

  if (isMacAudioSource) {
    if (practiceButton) {
      practiceButton.textContent = "🔊 Mac伴奏音源";
      practiceButton.classList.add("selected-mode");
    }
    if (ensembleButton) ensembleButton.style.display = "none";
    if (status) status.textContent = "このMacだけ音が鳴ります";
    return;
  }

  practiceButton?.classList.toggle("selected-mode", lessonMode === "practice");
  ensembleButton?.classList.toggle("selected-mode", lessonMode === "ensemble");

  if (status) {
    status.textContent = lessonMode === "practice"
      ? "iPadから音が鳴ります"
      : "iPadは無音・Macの伴奏で合奏します";
  }

  try {
    localStorage.setItem(MODE_STORAGE_KEY, lessonMode);
  } catch (_) {}
}

window.addEventListener("DOMContentLoaded", () => {
  const practiceButton = document.getElementById("practiceModeButton");
  const ensembleButton = document.getElementById("ensembleModeButton");

  if (isMacAudioSource) {
    document.querySelector(".lesson-mode-area")?.classList.add("mac-audio-mode");
    setLessonMode("practice");
    return;
  }

  practiceButton?.addEventListener("click", () => setLessonMode("practice"));
  ensembleButton?.addEventListener("click", () => setLessonMode("ensemble"));

  let saved = "practice";
  try {
    saved = localStorage.getItem(MODE_STORAGE_KEY) || "practice";
  } catch (_) {}

  setLessonMode(saved);
});

function partNameFromMode() {
  if (selectedInstrument === "bass") return "ベース⑥";
  if (selectedMode === "part1") return selectedInstrument === "xylophone" ? "木琴①" : "ベル①";
  if (selectedMode === "part2") return selectedInstrument === "xylophone" ? "木琴②" : "ベル②";
  if (selectedMode === "part3") return "ベル③";
  return null;
}

function partNumber(part) {
  if (part.includes("①")) return "①";
  if (part.includes("②")) return "②";
  if (part.includes("③")) return "③";
  return "⑥";
}

function eventDisplay(event) {
  return event.display || event.note;
}

function createMelodyDisplay() {
  melodyElement.innerHTML = "";
  currentSong.forEach((event, index) => {
    const box = document.createElement("div");
    box.classList.add("melody-note");
    box.dataset.index = index;

    if (event.note === "やすみ") {
      box.textContent = "休";
      box.classList.add("rest-note");
    } else {
      box.textContent = `${partNumber(event.part)}${eventDisplay(event)}`;
      box.classList.add(noteInformation[event.note].className);
    }

    box.title = `${event.section}・${event.bar}小節・${event.part}`;
    melodyElement.appendChild(box);
  });
}

function clearHighlights() {
  currentNoteElement.className = "current-note";

  xylophoneKeys.forEach((key) => {
    key.classList.remove("active");
    key.style.transform = "";
    key.style.filter = "";
    key.style.outline = "";
    key.style.opacity = "";
    key.textContent = key.dataset.note;
  });

  bassKeys.forEach((key) => key.classList.remove("active-bass"));
}

function updateMelodyPosition() {
  document.querySelectorAll(".melody-note").forEach((box, index) => {
    box.classList.remove("current", "finished");
    if (index < currentIndex) box.classList.add("finished");
    if (index === currentIndex) {
      box.classList.add("current");
      box.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  });
}

function playTone(frequency, duration = 1) {
  if (!shouldOutputAudio()) return;
  if (!audioContext) audioContext = new AudioContext();

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const soundLength = Math.max(0.35, speed / 1000 * duration * 0.7);

  oscillator.type = selectedInstrument === "bass" ? "triangle" : "sine";
  oscillator.frequency.value = selectedInstrument === "bass" ? frequency / 2 : frequency;
  gain.gain.setValueAtTime(0.18, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + soundLength);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + soundLength);
}

function showPartnerKey(key, note, number) {
  key.textContent = `${note} ${number}`;
  key.style.transform = "translateY(-6px) scale(1.03)";
  key.style.filter = "brightness(1.08)";
  key.style.outline = "4px dashed #777";
  key.style.opacity = "0.75";
}

function showCurrentEvent() {
  clearHighlights();
  updateMelodyPosition();

  if (currentIndex >= currentSong.length) {
    finishSong();
    return;
  }

  const event = currentSong[currentIndex];

  if (accompanimentOn) {
    const previous = currentIndex > 0 ? currentSong[currentIndex - 1] : null;
    if (!previous || previous.bar !== event.bar) playAccompanimentBar(event.bar);
  }

  const note = event.note;

  // 表示だけは、画面上で実際に選択されているパートボタンを使う。
  // selectedMode は変更しないので、v3で正常だった音・伴奏・同期には影響しない。
  const visibleGroup = selectedInstrument === "xylophone"
    ? xylophoneModeButtons
    : selectedInstrument === "bells"
      ? bellModeButtons
      : bassModeButtons;

  const visibleButton = visibleGroup?.querySelector(".part-button.selected-mode");
  const visibleMode = visibleButton?.dataset?.mode || selectedMode;

  let visiblePart = null;
  if (selectedInstrument === "bass") {
    visiblePart = "ベース⑥";
  } else if (visibleMode === "part1") {
    visiblePart = selectedInstrument === "xylophone" ? "木琴①" : "ベル①";
  } else if (visibleMode === "part2") {
    visiblePart = selectedInstrument === "xylophone" ? "木琴②" : "ベル②";
  } else if (visibleMode === "part3") {
    visiblePart = "ベル③";
  }

  const selectedPart = visiblePart;
  const isMyTurn =
    selectedInstrument === "bass" ||
    visibleMode === "all" ||
    event.part === selectedPart;

  if (note === "やすみ") {
    currentNoteElement.textContent = "やすみ";
    currentNoteElement.classList.add("rest-note");
    waitingArea.classList.remove("playing");
    waitingText.textContent = "まってね";
    return;
  }

  const info = noteInformation[note];
  const number = partNumber(event.part);
  const display = eventDisplay(event);

  if (isMyTurn) {
    currentNoteElement.textContent = `${display} ${number}`;
    currentNoteElement.classList.add(info.className, "flash");
    waitingArea.classList.add("playing");
    waitingText.textContent = `${event.part}の ばん！`;

    if (selectedInstrument === "bass") {
      const key = document.querySelector(`[data-bass-note="${note}"]`);
      if (key) key.classList.add("active-bass");
    } else {
      const keyArea = selectedInstrument === "bells"
        ? document.getElementById("bellKeys")
        : document.getElementById("xylophoneKeys");
      const key = keyArea?.querySelector(`.xylophone-key[data-note="${note}"]`);
      if (key) {
        key.classList.add("active");
        key.textContent = `${note} ${number}`;
      }
    }
  } else {
    currentNoteElement.textContent = "やすみ";
    currentNoteElement.classList.add("rest-note");
    waitingArea.classList.remove("playing");
    waitingText.innerHTML = `${event.part}が えんそう中<br>${partNumber(selectedPart)}は まってね`;

    const keyArea = selectedInstrument === "bells"
        ? document.getElementById("bellKeys")
        : document.getElementById("xylophoneKeys");
      const key = keyArea?.querySelector(`.xylophone-key[data-note="${note}"]`);
    if (key) showPartnerKey(key, note, number);
  }

  playTone(info.frequency, event.duration);
  setTimeout(() => currentNoteElement.classList.remove("flash"), 250);
}

function scheduleNext() {
  if (currentIndex >= currentSong.length) {
    finishSong();
    return;
  }

  const event = currentSong[currentIndex];
  showCurrentEvent();
  currentIndex += 1;
  timer = setTimeout(scheduleNext, speed * (event.duration || 1));
}

let silentStudentLeadInTimer = null;

function startSong() {
  if (timer || countInRunning || introRunning || silentStudentLeadInTimer) return;
  if (currentIndex >= currentSong.length) currentIndex = 0;

  if (accompanimentOn && currentIndex === 0) {
    runCountIn(() => {
      runIntro(() => {
        scheduleNext();
      });
    });
    return;
  }

  // 生徒用（伴奏OFF）でも曲頭では前奏分待ってから本編へ。
  // 2小節カウント(8拍) + 4小節前奏(16拍) = 24拍
  if (!accompanimentOn && currentIndex === 0 && !isTeacherAudioRole) {
    waitingArea.classList.remove("playing");
    waitingText.textContent = "前奏 4小節（まってね）";
    currentNoteElement.textContent = "やすみ";
    currentNoteElement.className = "current-note rest-note";

    silentStudentLeadInTimer = setTimeout(() => {
      silentStudentLeadInTimer = null;
      scheduleNext();
    }, 24 * Number(speed || 700));
    return;
  }

  scheduleNext();
}

function pauseSong() {
  clearAccompanimentTimers();
  if (silentStudentLeadInTimer) {
    clearTimeout(silentStudentLeadInTimer);
    silentStudentLeadInTimer = null;
  }
  if (!timer) return;
  clearTimeout(timer);
  timer = null;
  waitingArea.classList.remove("playing");
  waitingText.textContent = "いちじていし";
}

function stopSong() {
  clearAccompanimentTimers();
  if (silentStudentLeadInTimer) {
    clearTimeout(silentStudentLeadInTimer);
    silentStudentLeadInTimer = null;
  }
  if (timer) clearTimeout(timer);

  timer = null;
  currentIndex = 0;
  clearHighlights();

  currentNoteElement.textContent = selectedInstrument === "bass" ? "ど" : "み";
  currentNoteElement.classList.add(selectedInstrument === "bass" ? "note-do" : "note-mi");
  waitingArea.classList.remove("playing");
  waitingText.textContent = "まってね";
  updateMelodyPosition();
}

function finishSong() {
  if (timer) clearTimeout(timer);

  timer = null;
  clearHighlights();
  currentNoteElement.textContent = "おしまい";
  currentNoteElement.classList.add("rest-note");
  waitingArea.classList.remove("playing");
  waitingText.textContent = "できた！";

  document.querySelectorAll(".melody-note").forEach((box) => {
    box.classList.remove("current");
    box.classList.add("finished");
  });
}

function updateModeMessage() {
  if (selectedInstrument === "xylophone") {
    actionMessage.textContent = "ひかる おとを たたこう";
    modeMessage.textContent = selectedMode === "all"
      ? "もっきん①と②を こうたいで えんそうします"
      : `${partNameFromMode()}を れんしゅうします。あいてのときは きいて まちます`;
  } else if (selectedInstrument === "bells") {
    actionMessage.textContent = "ひかる おとの ベルを ならそう";
    modeMessage.textContent = selectedMode === "all"
      ? "ベル①・②・③を こうたいで えんそうします"
      : `${partNameFromMode()}を れんしゅうします。ほかのベルのときは きいて まちます`;
  } else {
    actionMessage.textContent = "ひかる けんばんを ひこう";
    modeMessage.textContent = "⑥ ベースを れんしゅうします";
  }
}

function changeInstrument(instrument, button) {
  selectedInstrument = instrument;
  selectedMode = instrument === "bass" ? "bass" : "all";
  currentSong = instrument === "xylophone" ? xylophoneSong : instrument === "bells" ? bellSong : bassSong;

  instrumentButtons.forEach((item) => item.classList.remove("selected-mode"));
  button.classList.add("selected-mode");

  xylophoneModeButtons.classList.toggle("hidden", instrument !== "xylophone");
  bellModeButtons.classList.toggle("hidden", instrument !== "bells");
  bassModeButtons.classList.toggle("hidden", instrument !== "bass");
  colorInstrumentArea.classList.toggle("hidden", instrument === "bass");
  bassKeyboardArea.classList.toggle("hidden", instrument !== "bass");

  document.querySelectorAll(".part-button").forEach((item) => item.classList.remove("selected-mode"));
  const group = instrument === "xylophone" ? xylophoneModeButtons : instrument === "bells" ? bellModeButtons : bassModeButtons;
  group.querySelector(".part-button").classList.add("selected-mode");

  stopSong();
  createMelodyDisplay();
  updateModeMessage();
}

function changeMode(mode, button) {
  selectedMode = mode;
  const group = selectedInstrument === "xylophone" ? xylophoneModeButtons : selectedInstrument === "bells" ? bellModeButtons : bassModeButtons;
  group.querySelectorAll(".part-button").forEach((item) => item.classList.remove("selected-mode"));
  button.classList.add("selected-mode");
  stopSong();
  updateModeMessage();
}

function changeSpeed(newSpeed, button) {
  speed = Number(newSpeed);
  speedButtons.forEach((item) => item.classList.remove("selected"));
  button.classList.add("selected");

  if (timer) {
    clearTimeout(timer);
    timer = null;
    scheduleNext();
  }
}


/* ===== 先生伴奏 =====
   1小節目：1・休・2・休
   2小節目：1・2・3・4
   その後：最後の4小節（13〜16小節）と同じメロディーで前奏
   本編：木琴①＋②をつないだメロディーをピアノ風の音でガイド
*/
const accompanimentButton = document.getElementById("accompanimentButton");
const accompanimentStatus = document.getElementById("accompanimentStatus");
let accompanimentOn = true;
let accompanimentTimers = [];
let countInRunning = false;
let introRunning = false;

const chordFrequencies = {
  C: [130.81, 261.63, 329.63, 392.00],
  F: [174.61, 261.63, 349.23, 440.00],
  G: [196.00, 246.94, 293.66, 392.00]
};

function clearAccompanimentTimers() {
  accompanimentTimers.forEach((id) => clearTimeout(id));
  accompanimentTimers = [];
  countInRunning = false;
  introRunning = false;
}

/* Web Audioだけで、少しピアノらしい減衰音を作る */
function playElectronicPianoTone(frequency, lengthMs = 950, volume = 0.10) {
  if (!shouldOutputAudio()) return;
  if (!audioContext) audioContext = new AudioContext();

  const now = audioContext.currentTime;
  const duration = Math.max(0.50, lengthMs / 1000);

  const master = audioContext.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(volume, now + 0.003);
  master.gain.exponentialRampToValueAtTime(volume * 0.34, now + 0.10);
  master.gain.exponentialRampToValueAtTime(volume * 0.10, now + Math.min(0.60, duration * 0.65));
  master.gain.exponentialRampToValueAtTime(0.001, now + duration);
  master.connect(audioContext.destination);

  // 少し丸いピアノ音になるよう倍音を調整
  const partials = [
    [1.000, 1.00, "triangle"],
    [2.002, 0.25, "sine"],
    [3.004, 0.10, "sine"],
    [4.006, 0.045, "sine"],
    [5.008, 0.018, "sine"]
  ];

  partials.forEach(([ratio, level, type]) => {
    const osc = audioContext.createOscillator();
    const g = audioContext.createGain();
    osc.type = type;
    osc.frequency.value = frequency * ratio;
    g.gain.value = level;
    osc.connect(g);
    g.connect(master);
    osc.start(now);
    osc.stop(now + duration);
  });

  // 鍵盤を打つ瞬間だけ、ごく短いハンマー音
  const size = Math.floor(audioContext.sampleRate * 0.018);
  const buffer = audioContext.createBuffer(1, size, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) {
    const decay = Math.pow(1 - i / size, 5);
    data[i] = (Math.random() * 2 - 1) * decay;
  }

  const noise = audioContext.createBufferSource();
  noise.buffer = buffer;
  const filter = audioContext.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 3200;
  const ng = audioContext.createGain();
  ng.gain.setValueAtTime(volume * 0.08, now);
  ng.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
  noise.connect(filter);
  filter.connect(ng);
  ng.connect(audioContext.destination);
  noise.start(now);
  noise.stop(now + 0.03);
}function playCountClick(strong = false) {
  if (!shouldOutputAudio()) return;
  if (!audioContext) audioContext = new AudioContext();

  const now = audioContext.currentTime;

  // 木のスティック同士を軽く打つような短いノイズ
  const bufferSize = Math.floor(audioContext.sampleRate * 0.045);
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    const decay = Math.pow(1 - i / bufferSize, 4);
    data[i] = (Math.random() * 2 - 1) * decay;
  }

  const noise = audioContext.createBufferSource();
  noise.buffer = buffer;

  const band = audioContext.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = strong ? 2300 : 1900;
  band.Q.value = 3.8;

  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(strong ? 0.24 : 0.17, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  noise.connect(band);
  band.connect(gain);
  gain.connect(audioContext.destination);

  noise.start(now);
  noise.stop(now + 0.055);

  // 木質感を足す短い「コツッ」
  const osc = audioContext.createOscillator();
  const og = audioContext.createGain();
  osc.type = "sine";
  osc.frequency.value = strong ? 760 : 680;
  og.gain.setValueAtTime(strong ? 0.07 : 0.05, now);
  og.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
  osc.connect(og);
  og.connect(audioContext.destination);
  osc.start(now);
  osc.stop(now + 0.04);
}


const selectedTimbre = "piano";

function playMarimbaTone(frequency, lengthMs = 700, volume = 0.10) {
  if (!shouldOutputAudio()) return;
  if (!audioContext) audioContext = new AudioContext();
  const now = audioContext.currentTime;
  const duration = Math.max(0.22, Math.min(0.85, lengthMs / 1000));

  const master = audioContext.createGain();
  master.gain.setValueAtTime(volume * 1.18, now);
  master.gain.exponentialRampToValueAtTime(0.001, now + duration);
  master.connect(audioContext.destination);

  [[1,1.0],[2.98,.18],[5.1,.06]].forEach(([ratio, level]) => {
    const o = audioContext.createOscillator();
    const g = audioContext.createGain();
    o.type = "sine";
    o.frequency.value = frequency * ratio;
    g.gain.value = level;
    o.connect(g); g.connect(master);
    o.start(now); o.stop(now + duration);
  });
}

function playOrganTone(frequency, lengthMs = 850, volume = 0.10) {
  if (!shouldOutputAudio()) return;
  if (!audioContext) audioContext = new AudioContext();
  const now = audioContext.currentTime;
  const duration = Math.max(0.35, lengthMs / 1000);

  const master = audioContext.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.linearRampToValueAtTime(volume * 0.72, now + 0.025);
  master.gain.setValueAtTime(volume * 0.68, now + Math.max(.04, duration - .08));
  master.gain.linearRampToValueAtTime(0.0001, now + duration);
  master.connect(audioContext.destination);

  [[1,1],[2,.34],[3,.13]].forEach(([ratio, level]) => {
    const o = audioContext.createOscillator();
    const g = audioContext.createGain();
    o.type = "sine";
    o.frequency.value = frequency * ratio;
    g.gain.value = level;
    o.connect(g); g.connect(master);
    o.start(now); o.stop(now + duration);
  });
}

function playSoftSynthTone(frequency, lengthMs = 900, volume = 0.10) {
  if (!shouldOutputAudio()) return;
  if (!audioContext) audioContext = new AudioContext();
  const now = audioContext.currentTime;
  const duration = Math.max(0.4, lengthMs / 1000);

  const filter = audioContext.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1450;
  filter.Q.value = 0.7;

  const master = audioContext.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(volume * 0.78, now + 0.045);
  master.gain.exponentialRampToValueAtTime(volume * 0.28, now + Math.min(.35, duration*.55));
  master.gain.exponentialRampToValueAtTime(0.001, now + duration);

  filter.connect(master);
  master.connect(audioContext.destination);

  const o1 = audioContext.createOscillator();
  const o2 = audioContext.createOscillator();
  const g1 = audioContext.createGain();
  const g2 = audioContext.createGain();

  o1.type = "triangle";
  o2.type = "sine";
  o1.frequency.value = frequency;
  o2.frequency.value = frequency * 2;
  g1.gain.value = 0.9;
  g2.gain.value = 0.12;

  o1.connect(g1); g1.connect(filter);
  o2.connect(g2); g2.connect(filter);
  o1.start(now); o2.start(now);
  o1.stop(now + duration); o2.stop(now + duration);
}

function playPianoTone(frequency, lengthMs = 950, volume = 0.10) {
  if (!shouldOutputAudio()) return;
  if (selectedTimbre === "marimba") {
    playMarimbaTone(frequency, lengthMs, volume);
  } else if (selectedTimbre === "organ") {
    playOrganTone(frequency, lengthMs, volume);
  } else if (selectedTimbre === "soft") {
    playSoftSynthTone(frequency, lengthMs, volume);
  } else {
    playElectronicPianoTone(frequency, lengthMs, volume);
  }
}


function chordForBar(bar) {
  const p = ((bar - 1) % 4) + 1;
  return p === 1 ? "C" : p === 2 ? "F" : p === 3 ? "G" : "C";
}

function playPianoChord(name, soft = true) {
  if (!shouldOutputAudio()) return;
  const chord = chordFrequencies[name] || [];
  chord.forEach((f, index) => {
    const delay = index * 35;
    const id = setTimeout(() => {
      playPianoTone(f, Math.max(650, speed * 0.9), soft ? 0.018 : 0.025);
    }, delay);
    accompanimentTimers.push(id);
  });
}

function melodyEventsForBar(bar) {
  return xylophoneSong.filter((event) => event.bar === bar);
}

function accompanimentBassEvents(bar) {
  const p = ((bar - 1) % 4) + 1;

  // ⑥ベースパートと同じ4小節
  if (p === 1) {
    return [
      { note: "ど", beat: 0, duration: 1 },
      { note: "み", beat: 2, duration: 1 }
    ];
  }

  if (p === 2) {
    return [
      { note: "ふぁ", beat: 0, duration: 1 },
      { note: "ふぁ♯", beat: 2, duration: 1 }
    ];
  }

  if (p === 3) {
    return [
      { note: "そ", beat: 0, duration: 1 },
      { note: "ふぁ", beat: 1, duration: 1 },
      { note: "み", beat: 2, duration: 1 },
      { note: "れ", beat: 3, duration: 1 }
    ];
  }

  return [
    { note: "ど", beat: 0, duration: 2 },
    { note: "そ", beat: 2, duration: 2 }
  ];
}

function playHiHat(volume = 0.032) {
  if (!shouldOutputAudio()) return;
  if (!audioContext) audioContext = new AudioContext();
  const now = audioContext.currentTime;

  // 短い高域ノイズで「チッ」というクローズド・ハイハット風
  const size = Math.floor(audioContext.sampleRate * 0.045);
  const buffer = audioContext.createBuffer(1, size, audioContext.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < size; i++) {
    const decay = Math.pow(1 - i / size, 6);
    data[i] = (Math.random() * 2 - 1) * decay;
  }

  const source = audioContext.createBufferSource();
  source.buffer = buffer;

  const highpass = audioContext.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 6500;

  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  source.connect(highpass);
  highpass.connect(gain);
  gain.connect(audioContext.destination);

  source.start(now);
  source.stop(now + 0.055);
}

function playSoftKick(volume = 0.055) {
  if (!shouldOutputAudio()) return;
  if (!audioContext) audioContext = new AudioContext();
  const now = audioContext.currentTime;

  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(105, now);
  osc.frequency.exponentialRampToValueAtTime(58, now + 0.09);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.start(now);
  osc.stop(now + 0.13);
}

function playWoodPerc(volume = 0.030) {
  if (!shouldOutputAudio()) return;
  if (!audioContext) audioContext = new AudioContext();
  const now = audioContext.currentTime;

  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = "triangle";
  osc.frequency.value = 720;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.start(now);
  osc.stop(now + 0.05);
}

function playFinishChord() {
  if (!shouldOutputAudio()) return;
  // シンバルなし。低いドを含むCメジャー和音を広く重ねて、
  // ピアノだけで「終わった」感じを出す。
  const duration = Math.max(1500, speed * 2.4);

  // C3 + G3 + C4 + E4 + G4
  [
    [130.81, 0.145],
    [196.00, 0.095],
    [261.63, 0.085],
    [329.63, 0.072],
    [392.00, 0.060]
  ].forEach(([frequency, volume]) => {
    playPianoTone(frequency, duration, volume);
  });
}
function playPianoBar(bar, startDelay = 0, showIntro = false) {
  const events = melodyEventsForBar(bar);
  const chordName = chordForBar(bar);
  const chord = chordFrequencies[chordName] || [];

  // パーカッション：
  // ハイハットは四分音符で「チ・チ・チ・チ」
  [0, 1, 2, 3].forEach((beatIndex) => {
    const id = setTimeout(() => {
      playHiHat(beatIndex === 0 ? 0.050 : 0.041);
    }, startDelay + beatIndex * speed);
    accompanimentTimers.push(id);
  });

  // 1・3拍目に低いキックを薄く入れて拍の土台を作る
  [0, 2].forEach((beatIndex) => {
    const id = setTimeout(() => {
      playSoftKick(beatIndex === 0 ? 0.065 : 0.050);
    }, startDelay + beatIndex * speed);
    accompanimentTimers.push(id);
  });

  // 2・4拍目には軽いウッド系の打音
  [1, 3].forEach((beatIndex) => {
    const id = setTimeout(() => {
      playWoodPerc(0.034);
    }, startDelay + beatIndex * speed);
    accompanimentTimers.push(id);
  });

  // 追加する低音：⑥ベースパートと同じ音並びを1オクターブ下で鳴らす
  accompanimentBassEvents(bar).forEach((event) => {
    const info = noteInformation[event.note];
    if (!info) return;

    const id = setTimeout(() => {
      // 最終4小節の「どー → そー」は、確実に下降させる。
      // ど = C3 (130.81Hz)、そ = G2 (98.00Hz)
      let bassFrequency = info.frequency / 2;
      const barPosition = ((bar - 1) % 4) + 1;
      if (barPosition === 4 && event.note === "ど") bassFrequency = 130.81;
      if (barPosition === 4 && event.note === "そ") bassFrequency = 98.00;

      playPianoTone(
        bassFrequency,
        Math.max(650, speed * event.duration * 0.92),
        0.105
      );
    }, startDelay + event.beat * speed);
    accompanimentTimers.push(id);
  });

  // 裏拍の和音。
  // 2小節目後半、ベースが「ふぁ♯」のところだけ
  // 「ふぁ・ら」ではなく「ふぁ♯・ら」にする。
  [1, 3].forEach((beatIndex) => {
    const id = setTimeout(() => {
      const barPosition = ((bar - 1) % 4) + 1;

      if (barPosition === 2 && beatIndex === 3) {
        // F#4 + A4
        [369.99, 440.00].forEach((f) => {
          playPianoTone(
            f,
            Math.max(520, speed * 0.78),
            0.043
          );
        });
      } else {
        const upperChord = chord.slice(1);
        upperChord.forEach((f) => {
          playPianoTone(
            f,
            Math.max(520, speed * 0.78),
            0.038
          );
        });
      }
    }, startDelay + beatIndex * speed);
    accompanimentTimers.push(id);
  });

  // 本編の一番最後だけ、4拍目の後にフィニッシュ。
  // 前奏(showIntro)では鳴らさない。
  if (!showIntro && bar === 16) {
    const finishId = setTimeout(() => {
      playFinishChord();
    }, startDelay + 4 * speed);
    accompanimentTimers.push(finishId);
  }

  // 木琴①＋②のメロディー
  events.forEach((event, i) => {
    const id = setTimeout(() => {
      if (event.note !== "やすみ") {
        const info = noteInformation[event.note];
        if (info) {
          playPianoTone(
            info.frequency,
            Math.max(500, speed * 0.82),
            0.105
          );
        }
      }

      // 前奏中は生徒は弾かず「まってね」
      if (showIntro) {
        currentNoteElement.textContent = "やすみ";
        currentNoteElement.className = "current-note rest-note";
        waitingArea.classList.remove("playing");
        waitingText.textContent = "まってね";
      }
    }, startDelay + i * speed);
    accompanimentTimers.push(id);
  });
}function playAccompanimentBar(bar) {
  if (!accompanimentOn || introRunning || countInRunning) return;
  playPianoBar(bar, 0, false);
}

function runCountIn(done) {
  countInRunning = true;
  waitingArea.classList.add("playing");
  waitingText.textContent = "カウントを きこう";
  currentNoteElement.className = "current-note rest-note";

  const beat = speed;
  // 2小節：1・休・2・休｜1・2・3・4
  const display = ["1", "やすみ", "2", "やすみ", "1", "2", "3", "4"];

  display.forEach((text, beatIndex) => {
    const id = setTimeout(() => {
      currentNoteElement.textContent = text;
      if (text === "やすみ") {
        waitingText.textContent = "まってね";
      } else {
        waitingText.textContent = beatIndex < 4 ? "じゅんび" : "もうすぐ はじまるよ";
        playCountClick(beatIndex === 4);
      }
    }, beatIndex * beat);
    accompanimentTimers.push(id);
  });

  const id = setTimeout(() => {
    countInRunning = false;
    accompanimentTimers = [];
    done();
  }, 8 * beat);
  accompanimentTimers.push(id);
}

function runIntro(done) {
  introRunning = true;
  waitingArea.classList.add("playing");
  waitingText.textContent = "ぜんそう";

  const introBars = [13, 14, 15, 16];
  introBars.forEach((bar, index) => {
    playPianoBar(bar, index * 4 * speed, true);
  });

  const id = setTimeout(() => {
    introRunning = false;
    accompanimentTimers = [];
    clearHighlights();
    currentNoteElement.textContent = selectedInstrument === "bass" ? "ど" : "み";
    currentNoteElement.classList.add(selectedInstrument === "bass" ? "note-do" : "note-mi");
    waitingArea.classList.remove("playing");
    waitingText.textContent = "スタート！";
    done();
  }, 16 * speed);
  accompanimentTimers.push(id);
}

accompanimentButton.addEventListener("click", () => {
  accompanimentOn = !accompanimentOn;
  accompanimentButton.textContent = accompanimentOn ? "🎹 伴奏 ON" : "🎹 伴奏 OFF";
  accompanimentButton.classList.toggle("off", !accompanimentOn);
  accompanimentButton.classList.toggle("selected", accompanimentOn);
  accompanimentStatus.textContent = accompanimentOn
    ? "スティックカウント＋前奏＋ピアノ伴奏（ベース強め）"
    : "伴奏なし";
  if (!accompanimentOn) {
    clearAccompanimentTimers();
  }
});

startButton.addEventListener("click", startSong);
pauseButton.addEventListener("click", pauseSong);
stopButton.addEventListener("click", stopSong);

speedButtons.forEach((button) => {
  button.addEventListener("click", () => changeSpeed(button.dataset.speed, button));
});

instrumentButtons.forEach((button) => {
  button.addEventListener("click", () => changeInstrument(button.dataset.instrument, button));
});

document.querySelectorAll(".part-button").forEach((button) => {
  button.addEventListener("click", () => changeMode(button.dataset.mode, button));
});

createMelodyDisplay();
updateModeMessage();
stopSong();

/* ===== 先生コントローラーからの指示を受け取る ===== */
function applyTeacherCommand(message) {
  if (!message || !message.command) return;

  switch (message.command) {
    case "start":
      startSong();
      break;

    case "pause":
      pauseSong();
      break;

    case "stop":
      stopSong();
      break;

    case "speed": {
      const requestedSpeed = String(message.data?.speed ?? "");
      const targetButton = Array.from(speedButtons).find(
        (button) => button.dataset.speed === requestedSpeed
      );
      if (targetButton) {
        changeSpeed(requestedSpeed, targetButton);
      }
      break;
    }

    case "accompaniment": {
      const shouldBeOn = Boolean(message.data?.on);
      if (accompanimentOn !== shouldBeOn) {
        accompanimentButton.click();
      }
      break;
    }
  }
}

if (window.ChairoSync) {
  window.ChairoSync.onCommand(applyTeacherCommand);
}



function applyCompactInstrumentKeyboard() {
  const colorArea = document.getElementById("colorInstrumentArea");
  const bassArea = document.getElementById("bassKeyboardArea");
  const xylophoneKeys = document.getElementById("xylophoneKeys");
  const bellKeys = document.getElementById("bellKeys");
  const title = document.getElementById("keyAreaTitle");
  const partTitle = document.getElementById("partSelectionTitle");

  if (selectedInstrument === "bass") {
    colorArea?.classList.add("hidden");
    bassArea?.classList.remove("hidden");
    if (partTitle) partTitle.textContent = "パート（ベース）";
    return;
  }

  bassArea?.classList.add("hidden");
  colorArea?.classList.remove("hidden");

  if (selectedInstrument === "bells") {
    xylophoneKeys?.classList.add("hidden");
    bellKeys?.classList.remove("hidden");
    if (title) title.textContent = "ハンドベルを ならす ところ";
    if (partTitle) partTitle.textContent = "パートを えらぶ（ハンドベル）";
  } else {
    bellKeys?.classList.add("hidden");
    xylophoneKeys?.classList.remove("hidden");
    if (title) title.textContent = "もっきんを たたく ところ";
    if (partTitle) partTitle.textContent = "パートを えらぶ（もっきん）";
  }
}

document.querySelectorAll(".instrument-button").forEach(btn => {
  btn.addEventListener("click", () => requestAnimationFrame(applyCompactInstrumentKeyboard));
});
window.addEventListener("DOMContentLoaded", applyCompactInstrumentKeyboard);


/* ===== Mac親機からの複数iPad同期 ===== */
const handledNetworkCommands = new Set();

function applyMacNetworkCommand(message) {
  if (!message || !message.command || !message.id) return;
  if (handledNetworkCommands.has(message.id)) return;

  handledNetworkCommands.add(message.id);
  if (handledNetworkCommands.size > 50) {
    const first = handledNetworkCommands.values().next().value;
    handledNetworkCommands.delete(first);
  }

  if (message.command === "start" && message.data?.startAt) {
    const startAtServer = Number(message.data.startAt);

    const scheduleStart = () => {
      const targetLocal = window.ChairoNetwork?.serverToLocalTime
        ? window.ChairoNetwork.serverToLocalTime(startAtServer)
        : startAtServer;

      const remaining = Math.max(0, targetLocal - Date.now());

      setTimeout(() => {
        startSong();
      }, remaining);
    };

    // If clock calibration is still finishing, do one quick refresh first.
    if (window.ChairoNetwork && !window.ChairoNetwork.clockReady) {
      window.ChairoNetwork.syncClock(5)
        .finally(scheduleStart);
    } else {
      scheduleStart();
    }

    return;
  }

  applyTeacherCommand(message);
}

if (window.ChairoNetwork) {
  window.ChairoNetwork.onCommand(applyMacNetworkCommand);
}


/* ===== iPad Safari 音チェック（既存の教材音を1回鳴らすだけ） ===== */
window.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("soundCheckButton");
  const status = document.getElementById("soundCheckStatus");

  button?.addEventListener("click", () => {
    try {
      playTone(261.63);

      button.textContent = "✅ 音チェックOK";
      button.classList.add("ready");
      if (status) status.textContent = "先生のスタートを待ってね";
    } catch (error) {
      if (status) status.textContent = "もう一度押してね";
    }
  });
});


const chairoPageRole = new URLSearchParams(window.location.search).get("role") || "student";
const isTeacherAudioRole = chairoPageRole === "audio";
let googleStudentStartTimer = null;

let googleLastAppliedVersion = -1;

function makeStudentSilentForEnsemble() {
  if (isTeacherAudioRole) return;
  try {
    if (typeof setLessonMode === "function") setLessonMode("ensemble");
  } catch (_) {}
  try {
    if (typeof accompanimentOn !== "undefined" && accompanimentOn) {
      const b = document.getElementById("accompanimentButton");
      if (b) b.click();
    }
  } catch (_) {}
}

function applyGoogleTeacherState(state) {
  if (!state || isTeacherAudioRole) return;
  const version = Number(state.version || 0);
  if (version <= googleLastAppliedVersion) return;
  googleLastAppliedVersion = version;

  makeStudentSilentForEnsemble();

  if (state.speed != null) {
    const requested = String(state.speed);
    const btn = Array.from(speedButtons || []).find(
      b => String(b.dataset.speed) === requested
    );
    if (btn) changeSpeed(requested, btn);
  }

  switch (state.command) {
    case "start": {
      if (googleStudentStartTimer) {
        clearTimeout(googleStudentStartTimer);
        googleStudentStartTimer = null;
      }

      // v12: startAt は先生から送られた「本編開始時刻」そのもの。
      const bodyStartAt = Number(state.startAt || 0);
      const wait = Math.max(0, bodyStartAt - Date.now());

      // 必ず曲頭から始める
      stopSong();
      currentIndex = 0;
      waitingArea.classList.remove("playing");
      waitingText.textContent = "前奏 4小節（まってね）";

      const syncText = document.getElementById("googleSyncText");
      if (syncText) syncText.textContent = "前奏 4小節を待っています…";

      googleStudentStartTimer = setTimeout(() => {
        googleStudentStartTimer = null;
        if (syncText) syncText.textContent = "先生iPadとの同期：接続中";
        scheduleNext();
      }, wait);
      break;
    }
    case "pause":
      if (googleStudentStartTimer) {
        clearTimeout(googleStudentStartTimer);
        googleStudentStartTimer = null;
      }
      pauseSong();
      break;
    case "stop":
      if (googleStudentStartTimer) {
        clearTimeout(googleStudentStartTimer);
        googleStudentStartTimer = null;
      }
      stopSong();
      break;
  }
}

if (window.ChairoGoogleSync && !isTeacherAudioRole) {
  window.ChairoGoogleSync.onState(applyGoogleTeacherState);
}

window.addEventListener("chairo-google-sync-status", (event) => {
  const s = event.detail || {};
  const dot = document.getElementById("googleSyncDot");
  const text = document.getElementById("googleSyncText");
  if (!dot || !text) return;

  if (s.connected) {
    dot.classList.add("connected");
    text.textContent = "先生iPadとの同期：接続中";
  } else {
    dot.classList.remove("connected");
    text.textContent = s.configured === false
      ? "同期設定がまだです"
      : "先生iPadとの同期：接続待ち";
  }
});


/* ===== v6: 先生iPad音声エンジンを直接アンロック ===== */
window.chairoPrepareAudio = async function () {
  try {
    if (!audioContext || audioContext.state === "closed") {
      audioContext = new AudioContext();
    }
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    // ユーザー操作の瞬間に短い確認音を直接鳴らして、Safariの音声許可を確実に取得する。
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = "sine";
    osc.frequency.value = 523.25;
    gain.gain.setValueAtTime(0.08, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + 0.12);

    return { ok: true, state: audioContext.state };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
};

window.chairoTeacherStart = function () {
  try {
    if (audioContext && audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }
  } catch (_) {}
  startSong();
};

window.chairoTeacherPause = function () {
  pauseSong();
};

window.chairoTeacherStop = function () {
  stopSong();
};

window.chairoTeacherSetSpeed = function (value) {
  const requested = String(value);
  const button = Array.from(speedButtons || []).find(
    b => String(b.dataset.speed) === requested
  );
  if (button) changeSpeed(requested, button);
};
