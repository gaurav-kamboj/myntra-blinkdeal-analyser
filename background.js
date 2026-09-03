importScripts("coupon-monitor.js");

const MALABAR_RATE_ENDPOINT = "https://gold.liverate.in/api/trend-rates";
const MYNTRA_CART_URL = "https://www.myntra.com/checkout/cart";
const COUPON_MONITOR_ALARM = "blinkdeal-coupon-monitor";
const COUPON_MONITOR_STORAGE_KEY = "blinkdealCouponMonitor";

function getCouponMonitorStatus() {
  return new Promise((resolve) => {
    chrome.storage.local.get(COUPON_MONITOR_STORAGE_KEY, (stored) => {
      resolve(
        stored[COUPON_MONITOR_STORAGE_KEY] || {
          enabled: false,
          state: "disabled",
          activeCode: null,
          checkedAt: null,
        },
      );
    });
  });
}

function saveCouponMonitorStatus(status) {
  return chrome.storage.local.set({ [COUPON_MONITOR_STORAGE_KEY]: status });
}

function hasCouponMonitorPermissions() {
  return new Promise((resolve) => {
    chrome.permissions.contains(
      {
        permissions: ["alarms"],
        origins: ["https://www.myntra.com/*"],
      },
      resolve,
    );
  });
}

async function ensureCouponMonitorAlarm() {
  if (!(await hasCouponMonitorPermissions())) return false;

  const existing = await chrome.alarms.get(COUPON_MONITOR_ALARM);
  if (!existing) {
    await chrome.alarms.create(COUPON_MONITOR_ALARM, { periodInMinutes: 5 });
  }
  return true;
}

async function checkBlinkdealCoupon() {
  const previous = await getCouponMonitorStatus();
  if (!previous.enabled) return previous;

  if (!(await hasCouponMonitorPermissions())) {
    const stopped = {
      enabled: false,
      state: "disabled",
      activeCode: null,
      checkedAt: null,
    };
    await saveCouponMonitorStatus(stopped);
    return stopped;
  }

  try {
    const response = await fetch(MYNTRA_CART_URL, {
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Cart request failed (${response.status})`);

    const cartData = extractCheckoutCartData(await response.text());
    const result = classifyBlinkdealCoupon(cartData);
    const status = {
      enabled: true,
      state: result.state,
      activeCode: result.activeCode,
      checkedAt: Date.now(),
    };
    await saveCouponMonitorStatus(status);
    return status;
  } catch {
    const status = {
      enabled: true,
      state: "unavailable",
      activeCode: null,
      checkedAt: Date.now(),
    };
    await saveCouponMonitorStatus(status);
    return status;
  }
}

async function setCouponMonitorEnabled(enabled) {
  if (!enabled) {
    if (await hasCouponMonitorPermissions()) {
      await chrome.alarms.clear(COUPON_MONITOR_ALARM);
    }
    const stopped = {
      enabled: false,
      state: "disabled",
      activeCode: null,
      checkedAt: null,
    };
    await saveCouponMonitorStatus(stopped);
    return stopped;
  }

  if (!(await hasCouponMonitorPermissions())) {
    throw new Error("Coupon-monitor permissions were not granted");
  }

  await saveCouponMonitorStatus({
    enabled: true,
    state: "unavailable",
    activeCode: null,
    checkedAt: null,
  });
  await ensureCouponMonitorAlarm();
  return checkBlinkdealCoupon();
}

async function restoreCouponMonitor() {
  const status = await getCouponMonitorStatus();
  if (status.enabled && (await hasCouponMonitorPermissions())) {
    await ensureCouponMonitorAlarm();
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "blinkdeal:get-malabar-rate") return;

  fetch(MALABAR_RATE_ENDPOINT)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Rate request failed (${response.status})`);
      }
      return response.json();
    })
    .then((payload) => sendResponse({ ok: true, payload }))
    .catch(() =>
      sendResponse({
        ok: false,
        error: "Unable to fetch the live Malabar 24K rate.",
      }),
    );

  return true;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!String(message?.type || "").startsWith("blinkdeal:coupon-monitor-")) {
    return;
  }

  (async () => {
    if (message.type === "blinkdeal:coupon-monitor-enable") {
      sendResponse({ ok: true, status: await setCouponMonitorEnabled(true) });
      return;
    }
    if (message.type === "blinkdeal:coupon-monitor-disable") {
      sendResponse({ ok: true, status: await setCouponMonitorEnabled(false) });
      return;
    }
    if (message.type === "blinkdeal:coupon-monitor-check") {
      sendResponse({ ok: true, status: await checkBlinkdealCoupon() });
      return;
    }
    if (message.type === "blinkdeal:coupon-monitor-status") {
      sendResponse({ ok: true, status: await getCouponMonitorStatus() });
      return;
    }
    sendResponse({ ok: false, error: "Unsupported coupon-monitor action" });
  })().catch(() => sendResponse({ ok: false, error: "Coupon monitor failed" }));

  return true;
});

if (chrome.alarms?.onAlarm) {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === COUPON_MONITOR_ALARM) checkBlinkdealCoupon();
  });
}

chrome.runtime.onStartup.addListener(restoreCouponMonitor);
chrome.runtime.onInstalled.addListener(restoreCouponMonitor);
