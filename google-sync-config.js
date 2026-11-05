/*
  Google Apps Script 同期設定

  Apps Script をウェブアプリとしてデプロイしたあと、
  下の WEB_APP_URL に /exec で終わるURLを貼ってください。

  例:
  https://script.google.com/macros/s/XXXXXXXXXXXX/exec
*/
window.CHAIRO_GOOGLE_SYNC = {
  WEB_APP_URL: "https://script.google.com/macros/s/AKfycbxr93m0xkAZdX0vkv5vYuohe0t_PtQO6rAB73hk0VuE9ENpfsIZGd2PIh6iqUFIWaE0rA/exec",
  POLL_MS: 1200,
  START_DELAY_MS: 3500
};
