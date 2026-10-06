// 紹介案件管理ツール セールスハブ連携（Chrome 拡張）
// 5分おきに saleshub.jp/my/messages を取得し、ツールの API へ HTML を送る。解析はツール側で行う。
const ALARM = "saleshub-sync";
const INTERVAL_MIN = 5;
const VERSION = chrome.runtime.getManifest().version;

chrome.runtime.onInstalled.addListener(() => schedule());
chrome.runtime.onStartup.addListener(() => schedule());
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === ALARM) sync("alarm");
});
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === "sync-now") {
    sync("manual").then((r) => reply(r));
    return true;
  }
});

function schedule() {
  chrome.alarms.get(ALARM, (a) => {
    if (!a) chrome.alarms.create(ALARM, { periodInMinutes: INTERVAL_MIN, delayInMinutes: 0.2 });
  });
}

async function getConfig() {
  const { appUrl, token } = await chrome.storage.sync.get(["appUrl", "token"]);
  return { appUrl: (appUrl || "").replace(/\/$/, ""), token: token || "" };
}

async function setStatus(status) {
  await chrome.storage.local.set({ lastStatus: { ...status, at: new Date().toISOString() } });
}

async function fetchSaleshub(path) {
  const res = await fetch("https://saleshub.jp" + path, { credentials: "include", redirect: "follow", cache: "no-store" });
  const html = await res.text();
  const loggedOut = /\/sign_in|\/login/.test(res.url) || (!/\/sign_out/.test(html) && !/js-messages-item|message-item/.test(html));
  return { html, loggedOut, status: res.status };
}

async function post(cfg, body) {
  const res = await fetch(cfg.appUrl + "/api/saleshub/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.token },
    body: JSON.stringify({ ...body, extensionVersion: VERSION }),
  });
  if (!res.ok) throw new Error("ツール側エラー " + res.status + " " + (await res.text()).slice(0, 200));
  return res.json();
}

async function sync(trigger) {
  const cfg = await getConfig();
  if (!cfg.appUrl || !cfg.token) {
    await setStatus({ ok: false, message: "ツールのURLと接続トークンを設定してください" });
    return { ok: false, message: "未設定" };
  }
  try {
    const list = await fetchSaleshub("/my/messages");
    if (list.loggedOut) {
      await post(cfg, { loggedOut: true });
      await setStatus({ ok: false, message: "セールスハブにログインしていません。ログインすると自動で再開します" });
      return { ok: false, message: "未ログイン" };
    }
    // 1) 一覧を送り、詳細が必要なスレッドIDを受け取る
    const first = await post(cfg, { listHtml: list.html });
    const need = Array.isArray(first.needDetails) ? first.needDetails.slice(0, 15) : [];
    let newMessages = first.newMessages || 0;
    // 2) 必要なスレッドの詳細を取得して送る（負荷を抑えるため間隔を空ける）
    if (need.length) {
      const details = [];
      for (const id of need) {
        const d = await fetchSaleshub("/proposals/" + id);
        if (!d.loggedOut && d.status === 200) details.push({ proposalId: String(id), html: d.html });
        await new Promise((r) => setTimeout(r, 800));
      }
      if (details.length) {
        const second = await post(cfg, { details });
        newMessages += second.newMessages || 0;
      }
    }
    const message = `同期OK（${trigger === "manual" ? "手動" : "自動"}）: スレッド ${first.threads ?? 0} 件 / 新着 ${newMessages} 件`;
    await setStatus({ ok: true, message, threads: first.threads ?? 0, newMessages });
    return { ok: true, message };
  } catch (e) {
    const message = "エラー: " + (e && e.message ? e.message : String(e));
    await setStatus({ ok: false, message });
    return { ok: false, message };
  }
}
