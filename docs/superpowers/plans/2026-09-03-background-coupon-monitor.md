# Background Blinkdeal Coupon Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in, read-only monitor that checks the signed-in Myntra cart every five minutes and reports whether a Blinkdeal coupon is active.

**Architecture:** Keep coupon parsing in `coupon-monitor.js` as pure functions, loaded by the existing service worker with `importScripts()`. The background worker owns the fixed cart fetch, alarm recovery, and minimal stored state. A new extension popup requests optional permissions from a direct click and displays the stored status.

**Tech Stack:** Chrome Extension Manifest V3, service worker, `chrome.alarms`, `chrome.storage.local`, optional alarm and host permissions, vanilla JavaScript, JXA regression tests.

**Spec:** `docs/superpowers/specs/2026-09-03-background-coupon-monitor-design.md`

## Global Constraints

- Monitoring is disabled by default and must require a user click in the extension popup.
- Fetch only `https://www.myntra.com/checkout/cart` with `credentials: "include"`.
- Never use `chrome.cookies`, never click or submit a coupon, and never persist cart HTML, products, prices, addresses, customer data, or cookie values.
- Persist only `enabled`, `state`, `activeCode`, and `checkedAt` in `chrome.storage.local`.
- Treat missing, malformed, signed-out, or changed cart responses as `unavailable`; never infer coupon eligibility.
- Check every five minutes while Chrome is running; recover the alarm on worker startup.

---

## File Structure

- `coupon-monitor.js` — pure cart-data extraction and coupon-status classification.
- `test-coupon-monitor.js` — JXA regression tests for parsing and classification.
- `background.js` — fixed fetch, alarm scheduling, popup messages, and minimal persistence.
- `popup.html` — monitor control and status UI.
- `popup.js` — permission request and popup rendering.
- `manifest.json` — popup entry point and optional permission declarations.
- `README.md` — user-facing explanation of opt-in monitoring and limits.

### Task 1: Pure cart parsing and coupon classification

**Files:**
- Create: `coupon-monitor.js`
- Create: `test-coupon-monitor.js`

**Interfaces:**
- Produces `extractCheckoutCartData(html): object | null`.
- Produces `classifyBlinkdealCoupon(cartData): { state: "active" | "inactive" | "other-coupon" | "unavailable", activeCode: string | null }`.

- [x] **Step 1: Write failing tests**

```javascript
assertEqual(
  extractCheckoutCartData('<script>window._checkout_.__myx_data__={"cartData":{"price":{"discounts":{"data":[]}}}};</script>').cartData.price.discounts.data.length,
  0,
  "serialized cart data is extracted without evaluating page code",
);
assertDeepEqual(
  classifyBlinkdealCoupon({
    cartData: {
      coupons: [{ code: "BLINKDEAL8" }],
      price: { discounts: { data: [{ name: "coupon", value: 1200 }] } },
    },
  }),
  { state: "active", activeCode: "BLINKDEAL8" },
  "a target coupon with a positive coupon discount is active",
);
assertDeepEqual(
  classifyBlinkdealCoupon({
    cartData: {
      coupons: [{ code: "BLINKDEAL8" }],
      price: { discounts: { data: [{ name: "coupon", value: 0 }] } },
    },
  }),
  { state: "inactive", activeCode: null },
  "a target code without discount is not reported active",
);
```

- [x] **Step 2: Run the test and confirm failure**

Run: `osascript -l JavaScript test-coupon-monitor.js`

Expected: failure because `coupon-monitor.js` is missing.

- [x] **Step 3: Implement minimal pure helpers**

Implement a balanced-brace extractor for the JSON object assigned to `window._checkout_.__myx_data__`; pass the resulting text to `JSON.parse` and return `null` on malformed input. Do not evaluate the script.

Implement `classifyBlinkdealCoupon` with the exact normalized candidates `BLINKDEAL`, `BLINKDEAL6`, `BLINKDEAL8`, and `BLINKDEAL10`. Search coupon-related data recursively for exact string values or `code` fields. Return `active` only when the matching code exists and `cartData.price.discounts.data` has a `name === "coupon"` entry with a positive numeric `value`.

- [x] **Step 4: Run the test and confirm pass**

Run: `osascript -l JavaScript test-coupon-monitor.js`

Expected: `test-coupon-monitor.js: all tests passed`.

### Task 2: Opt-in service-worker monitor

**Files:**
- Modify: `background.js`
- Modify: `manifest.json`
- Test: `test-background.js`

**Interfaces:**
- Consumes `extractCheckoutCartData` and `classifyBlinkdealCoupon` from `coupon-monitor.js`.
- Produces background message types `blinkdeal:coupon-monitor-enable`, `blinkdeal:coupon-monitor-disable`, `blinkdeal:coupon-monitor-check`, and `blinkdeal:coupon-monitor-status`.
- Persists `blinkdealCouponMonitor` in `chrome.storage.local`.

- [x] **Step 1: Write failing worker/manifest tests**

```javascript
assertEqual(
  manifest.action.default_popup,
  "popup.html",
  "the extension exposes the coupon-monitor popup",
);
assertEqual(
  manifest.optional_host_permissions.includes("https://www.myntra.com/*"),
  true,
  "Myntra access is optional",
);
assertEqual(source.includes('credentials: "include"'), true, "cart fetch includes the signed-in session");
assertEqual(source.includes('"blinkdeal-coupon-monitor"'), true, "worker schedules a fixed coupon-monitor alarm");
```

- [x] **Step 2: Run the test and confirm failure**

Run: `osascript -l JavaScript test-background.js`

Expected: failure because the popup, optional permissions, and monitor worker code are absent.

- [x] **Step 3: Implement fixed monitoring behavior**

Add `importScripts("coupon-monitor.js")` at the top of `background.js`. Add required `storage`, optional `alarms`, and optional `https://www.myntra.com/*` declarations plus an action popup in `manifest.json`.

Implement `ensureCouponMonitorAlarm`, `checkBlinkdealCoupon`, and `setCouponMonitorEnabled`. The worker must fetch the fixed cart URL, classify the response, and write only the four allowed fields. On any fetch, extraction, or classification failure, write `state: "unavailable"` and no active code. Recreate the alarm from `onStartup` and `onInstalled` only when stored `enabled` is true. Do not call `chrome.cookies`.

- [x] **Step 4: Run worker and manifest tests**

Run:

```bash
osascript -l JavaScript test-background.js
python3 -c 'import json; m=json.load(open("manifest.json")); assert m["action"]["default_popup"] == "popup.html"; print("manifest.json valid")'
```

Expected: worker test and manifest validation pass.

### Task 3: Permission-aware popup and documentation

**Files:**
- Create: `popup.html`
- Create: `popup.js`
- Modify: `README.md`

**Interfaces:**
- Consumes `blinkdeal:coupon-monitor-status` and enable/disable/check messages from Task 2.
- Produces direct-click requests for `{ permissions: ["alarms"], origins: ["https://www.myntra.com/*"] }`.

- [x] **Step 1: Write a failing popup contract test**

Add to `test-background.js`:

```javascript
assertEqual(popupSource.includes("chrome.permissions.request"), true, "popup requests optional access from a user action");
assertEqual(popupSource.includes("blinkdeal:coupon-monitor-enable"), true, "popup starts the monitor only after permission is granted");
assertEqual(popupSource.includes("blinkdeal:coupon-monitor-disable"), true, "popup can stop monitoring");
```

- [x] **Step 2: Run the test and confirm failure**

Run: `osascript -l JavaScript test-background.js`

Expected: failure because `popup.js` is missing.

- [x] **Step 3: Implement popup controls**

Create an accessible popup with a status line, **Enable cart monitoring** / **Stop monitoring**, and **Check now**. The enable button must call `chrome.permissions.request` directly in its click handler. If permission is denied, retain `disabled` status. Display only status copy and the last checked time. Do not display cart contents or coupon discount amounts.

Update the README with the five-minute schedule, signed-in Chrome requirement, non-mutating behavior, and the fact that checking stops when Chrome is quit.

- [x] **Step 4: Run full verification**

Run:

```bash
osascript -l JavaScript test-content.js
osascript -l JavaScript test-coupon-monitor.js
osascript -l JavaScript test-background.js
osascript -l JavaScript -e 'ObjC.import("Foundation"); const data=$.NSData.dataWithContentsOfFile("background.js"); const source=ObjC.unwrap($.NSString.alloc.initWithDataEncoding(data,$.NSUTF8StringEncoding)); globalThis.chrome={runtime:{onMessage:{addListener:function(){}},onStartup:{addListener:function(){}},onInstalled:{addListener:function(){}}},alarms:{onAlarm:{addListener:function(){}}}}; globalThis.importScripts=function(){}; eval(source); console.log("background.js parses");'
python3 -c 'import json; json.load(open("manifest.json")); print("manifest.json valid")'
git diff --check
```

Expected: all tests and parse checks pass with no whitespace errors.

- [ ] **Step 5: Manually verify**

1. Reload the unpacked extension and open its toolbar popup.
2. Enable monitoring and approve the Myntra permission prompt.
3. Confirm the status changes after the immediate check without navigating or modifying the cart.
4. Click **Check now** and confirm it remains read-only.
5. Stop monitoring, wait past five minutes, and confirm no new check occurs.
6. Sign out of Myntra and use **Check now**; confirm `Cart status unavailable` rather than a coupon result.
