/**
 * ちゃいろのこびん - iPad同期用 Google Apps Script
 *
 * 使い方:
 * 1) script.google.com で新しいプロジェクトを作る
 * 2) この Code.gs の内容を貼り付けて保存
 * 3) デプロイ > 新しいデプロイ > ウェブアプリ
 * 4) 実行するユーザー: 自分
 * 5) アクセスできるユーザー: 全員（学校アカウントの制限に合わせて選択）
 * 6) 発行された /exec URL を google-sync-config.js に貼る
 */

const PROP_KEY = 'CHAIRO_CLASS_STATE';
const LOCK_WAIT_MS = 3000;

function defaultState_() {
  return {
    version: 0,
    command: 'stop',
    speed: 700,
    accompaniment: true,
    startAt: 0,
    updatedAt: Date.now()
  };
}

function readState_() {
  const raw = PropertiesService.getScriptProperties().getProperty(PROP_KEY);
  if (!raw) return defaultState_();
  try {
    const parsed = JSON.parse(raw);
    return Object.assign(defaultState_(), parsed);
  } catch (e) {
    return defaultState_();
  }
}

function writeState_(state) {
  PropertiesService.getScriptProperties().setProperty(PROP_KEY, JSON.stringify(state));
}

function jsonp_(obj, callback) {
  const safeCallback = String(callback || '').replace(/[^\w.$]/g, '');
  const body = safeCallback
    ? safeCallback + '(' + JSON.stringify(obj) + ');'
    : JSON.stringify(obj);

  return ContentService
    .createTextOutput(body)
    .setMimeType(
      safeCallback
        ? ContentService.MimeType.JAVASCRIPT
        : ContentService.MimeType.JSON
    );
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = String(p.action || 'state');
  const callback = p.callback || '';

  if (action === 'state') {
    return jsonp_({ ok: true, state: readState_() }, callback);
  }

  if (action === 'set') {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(LOCK_WAIT_MS);

      const current = readState_();
      const next = Object.assign({}, current, {
        version: Number(current.version || 0) + 1,
        command: String(p.command || current.command || 'stop'),
        speed: p.speed !== undefined ? Number(p.speed) : Number(current.speed || 700),
        accompaniment: p.accompaniment !== undefined
          ? String(p.accompaniment) === 'true'
          : Boolean(current.accompaniment),
        startAt: p.startAt !== undefined ? Number(p.startAt) : Number(current.startAt || 0),
        updatedAt: Date.now()
      });

      writeState_(next);
      return jsonp_({ ok: true, state: next }, callback);
    } catch (err) {
      return jsonp_({ ok: false, error: String(err) }, callback);
    } finally {
      try { lock.releaseLock(); } catch (_) {}
    }
  }

  return jsonp_({ ok: false, error: 'unknown action' }, callback);
}
