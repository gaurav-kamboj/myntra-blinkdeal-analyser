const MONITOR_PERMISSIONS = {
  permissions: ["alarms"],
  origins: ["https://www.myntra.com/*"],
};

const statusTitle = document.getElementById("status-title");
const statusDetail = document.getElementById("status-detail");
const enableButton = document.getElementById("enable");
const stopButton = document.getElementById("stop");
const checkButton = document.getElementById("check-now");
const notice = document.getElementById("notice");

function sendMonitorMessage(type) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "Coupon monitor request failed"));
        return;
      }
      resolve(response.status);
    });
  });
}

function requestMonitorPermissions() {
  return new Promise((resolve) => chrome.permissions.request(MONITOR_PERMISSIONS, resolve));
}

function statusCopy(status) {
  if (status.state === "active") return `${status.activeCode} active`;
  if (status.state === "inactive") return "No Blinkdeal coupon active";
  if (status.state === "other-coupon") return "Another coupon is active";
  if (status.state === "unavailable") return "Cart status unavailable";
  return "Cart monitoring is off";
}

function renderStatus(status) {
  const safeStatus = status || { enabled: false, state: "disabled", checkedAt: null };
  statusTitle.textContent = statusCopy(safeStatus);
  statusDetail.textContent = safeStatus.checkedAt
    ? `Last checked ${new Date(safeStatus.checkedAt).toLocaleString()}`
    : "Enable it to check Blinkdeal coupon status.";
  enableButton.disabled = Boolean(safeStatus.enabled);
  stopButton.disabled = !safeStatus.enabled;
  checkButton.disabled = !safeStatus.enabled;
}

async function refreshStatus() {
  try {
    renderStatus(await sendMonitorMessage("blinkdeal:coupon-monitor-status"));
  } catch {
    notice.textContent = "Unable to read coupon-monitor status.";
  }
}

enableButton.addEventListener("click", async () => {
  notice.textContent = "";
  const granted = await requestMonitorPermissions();
  if (!granted) {
    notice.textContent = "Monitoring stays off because the requested access was not granted.";
    return;
  }

  try {
    renderStatus(await sendMonitorMessage("blinkdeal:coupon-monitor-enable"));
  } catch {
    notice.textContent = "Unable to start cart monitoring.";
  }
});

stopButton.addEventListener("click", async () => {
  notice.textContent = "";
  try {
    renderStatus(await sendMonitorMessage("blinkdeal:coupon-monitor-disable"));
  } catch {
    notice.textContent = "Unable to stop cart monitoring.";
  }
});

checkButton.addEventListener("click", async () => {
  notice.textContent = "Checking your cart…";
  try {
    renderStatus(await sendMonitorMessage("blinkdeal:coupon-monitor-check"));
    notice.textContent = "";
  } catch {
    notice.textContent = "Unable to check the cart right now.";
  }
});

refreshStatus();
