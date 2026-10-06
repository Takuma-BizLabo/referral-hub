const $ = (id) => document.getElementById(id);

async function load() {
  const { appUrl, token } = await chrome.storage.sync.get(["appUrl", "token"]);
  $("appUrl").value = appUrl || "";
  $("token").value = token || "";
  renderStatus();
}

async function renderStatus() {
  const { lastStatus } = await chrome.storage.local.get("lastStatus");
  const el = $("status");
  if (!lastStatus) {
    el.textContent = "まだ同期していません";
    el.className = "status";
    return;
  }
  const at = new Date(lastStatus.at).toLocaleString("ja-JP");
  el.textContent = `${lastStatus.message}\n（${at}）`;
  el.className = "status " + (lastStatus.ok ? "ok" : "ng");
}

$("save").addEventListener("click", async () => {
  await chrome.storage.sync.set({ appUrl: $("appUrl").value.trim(), token: $("token").value.trim() });
  $("status").textContent = "保存しました。「今すぐ同期」で接続を確認できます。";
  $("status").className = "status";
});

$("sync").addEventListener("click", async () => {
  $("status").textContent = "同期中...";
  $("status").className = "status";
  chrome.runtime.sendMessage({ type: "sync-now" }, () => setTimeout(renderStatus, 300));
});

load();
