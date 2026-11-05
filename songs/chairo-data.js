// ちゃいろのこびん 曲データ
// 今後は新しい曲ごとに、このファイルと同じ形のデータを追加します。
(function () {
  function makeBar(bar, part, notes, section) {
    return notes.map((item) => {
      if (typeof item === "string") {
        return { bar, part, note: item, section, duration: 1 };
      }
      return { bar, part, section, duration: 1, ...item };
    });
  }

  const noteInformation = {
    "ど": { className: "note-do", frequency: 261.63 },
    "れ": { className: "note-re", frequency: 293.66 },
    "み": { className: "note-mi", frequency: 329.63 },
    "ふぁ": { className: "note-fa", frequency: 349.23 },
    "ふぁ♯": { className: "note-fs", frequency: 369.99 },
    "そ": { className: "note-so", frequency: 392.00 },
    "ら": { className: "note-la", frequency: 440.00 },
    "し": { className: "note-si", frequency: 493.88 },
    "ど↑": { className: "note-do", frequency: 523.25 },
    "れ↑": { className: "note-re", frequency: 587.33 },
    "み↑": { className: "note-mi", frequency: 659.25 }
  };

  const xylophone = [
    ...makeBar(1, "木琴①", ["み","そ","そ","やすみ"], "前半"),
    ...makeBar(2, "木琴①", ["ふぁ","ら","ら","やすみ"], "前半"),
    ...makeBar(3, "木琴②", ["し","し","ら","し"], "前半"),
    ...makeBar(4, "木琴②", ["ど↑","れ↑","み↑","やすみ"], "前半"),
    ...makeBar(5, "木琴①", ["み","そ","そ","やすみ"], "前半"),
    ...makeBar(6, "木琴①", ["ふぁ","ら","ら","やすみ"], "前半"),
    ...makeBar(7, "木琴②", ["し","し","ら","し"], "前半"),
    ...makeBar(8, "木琴②", ["ど↑","ど↑","ど↑","やすみ"], "前半"),
    ...makeBar(9, "木琴①", ["み↑","ど↑","そ","やすみ"], "後半"),
    ...makeBar(10, "木琴①", ["ふぁ","ら","ら","やすみ"], "後半"),
    ...makeBar(11, "木琴②", ["し","し","ら","し"], "後半"),
    ...makeBar(12, "木琴②", ["ど↑","れ↑","み↑","やすみ"], "後半"),
    ...makeBar(13, "木琴①", ["み↑","ど↑","そ","やすみ"], "後半"),
    ...makeBar(14, "木琴①", ["ふぁ","ら","ら","やすみ"], "後半"),
    ...makeBar(15, "木琴②", ["し","し","ら","し"], "後半"),
    ...makeBar(16, "木琴②", ["ど↑","ど↑","ど↑","やすみ"], "後半")
  ];

  const bell = [];
  for (let repeat = 0; repeat < 4; repeat += 1) {
    const startBar = repeat * 4 + 1;
    const section = repeat < 2 ? "前半" : "後半";
    bell.push(
      ...makeBar(startBar, "ベル①", ["み","そ","そ","やすみ"], section),
      ...makeBar(startBar + 1, "ベル②", ["ふぁ","ら","ら","やすみ"], section),
      ...makeBar(startBar + 2, "ベル③", ["し","し","し","し"], section),
      ...makeBar(startBar + 3, "ベル③", ["ど↑","ど↑","ど↑","やすみ"], section)
    );
  }

  const bass = [];
  for (let repeat = 0; repeat < 4; repeat += 1) {
    const startBar = repeat * 4 + 1;
    const section = repeat < 2 ? "前半" : "後半";
    bass.push(
      ...makeBar(startBar, "ベース⑥", ["ど","やすみ","み","やすみ"], section),
      ...makeBar(startBar + 1, "ベース⑥", ["ふぁ","やすみ","ふぁ♯","やすみ"], section),
      ...makeBar(startBar + 2, "ベース⑥", ["そ","ふぁ","み","れ"], section),
      ...makeBar(startBar + 3, "ベース⑥", [
        { note: "ど", duration: 2, display: "どー" },
        { note: "そ", duration: 2, display: "そー" }
      ], section)
    );
  }

  window.CHAIRO_SONG_DATA = {
    id: "chairo",
    title: "ちゃいろのこびん",
    meter: "4/4",
    defaultSpeedMs: 700,
    noteInformation,
    parts: { xylophone, bell, bass }
  };
})();
