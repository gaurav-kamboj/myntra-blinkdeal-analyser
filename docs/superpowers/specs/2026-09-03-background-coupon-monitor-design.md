# Background Blinkdeal Coupon Monitor

## Goal

Let a signed-in user opt in to a read-only background monitor that reports whether one of `BLINKDEAL`, `BLINKDEAL6`, `BLINKDEAL8`, or `BLINKDEAL10` is currently active in their Myntra cart, even when no Myntra tab is open.

## Scope

- The monitor is disabled by default.
- A user enables or disables it from an extension popup.
- When enabled, a Manifest V3 service worker checks the fixed `https://www.myntra.com/checkout/cart` URL every five minutes while Chrome is running.
- It only reports the coupon state: a recognized Blinkdeal code, no Blinkdeal coupon active, another coupon active, or unavailable.
- It never clicks **Apply**, never submits a code, never removes a code, and never changes cart contents or checkout state.

## Privacy and permissions

- Add the required `storage` permission, plus optional `alarms` and optional host access for `https://www.myntra.com/*`.
- Request the optional permissions only after the user clicks **Enable cart monitoring** in the extension popup. Local storage is required only to retain the user-visible disabled/enabled result; it never grants site access.
- Do not use the `cookies` API and do not read, store, or display cookie values.
- Fetch only the fixed cart URL with `credentials: "include"`; no content-script message may supply a URL, headers, coupon code, or request options.
- Parse the cart response in memory. Persist only `{ enabled, state, activeCode, checkedAt }` in `chrome.storage.local`; never store cart HTML, product data, customer details, addresses, prices, or checkout identifiers.
- Do not run in incognito windows and do not surface notifications by default.

## Data flow

1. The user opens the extension popup and enables monitoring.
2. The popup requests the optional permissions inside that user gesture. If granted, it sends the fixed `blinkdeal:coupon-monitor-enable` message to the service worker.
3. The service worker creates or recreates a five-minute `blinkdeal-coupon-monitor` alarm and immediately performs one check.
4. Each check fetches the fixed cart URL with the existing authenticated Myntra session.
5. The worker extracts the serialized `window._checkout_.__myx_data__` object without evaluating page code, then reads only coupon-related fields and the coupon-discount value.
6. It recognizes the exact candidate codes case-insensitively. A candidate is **active** only if its code is present and the cart records a positive coupon discount.
7. It writes the minimal status to `chrome.storage.local`; the popup reads that status on open.

## Status model

| State | Meaning | Popup copy |
| --- | --- | --- |
| `active` | A target code is present and a positive coupon discount is recorded. | `BLINKDEAL8 active` |
| `inactive` | The cart was read successfully and no target coupon is active. | `No Blinkdeal coupon active` |
| `other-coupon` | A positive coupon discount is present but no target code is found. | `Another coupon is active` |
| `unavailable` | The user is signed out, Myntra changed its cart payload, or the request failed. | `Cart status unavailable` |
| `disabled` | Monitoring has not been enabled or was turned off. | `Cart monitoring is off` |

## Reliability limits

- The monitor only runs while Chrome itself is running. It cannot run after Chrome is fully quit.
- Chrome alarms do not wake a sleeping device; a missed repeating alarm fires once after wake and then resumes its schedule.
- A cart request can fail because the user signed out, changed their session, uses a privacy setting that blocks the required session cookies, or Myntra changes its cart response. These cases are `unavailable`, never reported as a coupon result.
- The five-minute period is a target, not a real-time guarantee; Chrome can delay alarms.

## User experience

- The popup starts with a single explanation: `Checks your signed-in Myntra cart every 5 minutes. It never applies or changes coupons.`
- It exposes **Enable cart monitoring** / **Stop monitoring** and a manual **Check now** action.
- The status includes the last checked time only in the popup, not in Gold Deal Tools.
- Gold Deal Tools remains unchanged on gold listing and product pages; cart monitoring does not add a floating dock to non-gold pages.

## Verification

- Unit-test target-code normalization, serialized cart-data extraction, coupon-state classification, and malformed or signed-out payload handling.
- Unit-test that a target code without a positive coupon discount is not reported active.
- Validate `manifest.json`, `background.js`, popup scripts, and existing content-script tests.
- Manually verify enable/disable permission flow, an active target code, no active target code, a signed-out response, page/worker restart recovery, and that the monitor never triggers any cart mutation.
