
/*
  ちゃいろのこびん：先生コントローラー同期・第1段階
  - BroadcastChannel + localStorage を使用
  - 同じ端末 / 同じブラウザ内で先生画面と生徒画面の動作確認ができます
  - 複数iPad間の通信方式は次段階で差し替えられるよう、send/receiveを分離しています
*/
(() => {
  const CHANNEL_NAME = "chairo-kobin-classroom-v1";
  const STORAGE_KEY = "chairo-kobin-classroom-command";
  const listeners = new Set();
  let bc = null;

  if ("BroadcastChannel" in window) {
    bc = new BroadcastChannel(CHANNEL_NAME);
    bc.addEventListener("message", (event) => {
      listeners.forEach((listener) => listener(event.data));
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const payload = JSON.parse(event.newValue);
      listeners.forEach((listener) => listener(payload));
    } catch (_) {}
  });

  window.ChairoSync = {
    send(command, data = {}) {
      const payload = {
        command,
        data,
        sentAt: Date.now(),
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`
      };

      if (bc) bc.postMessage(payload);

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (_) {}

      return payload;
    },

    onCommand(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
})();
