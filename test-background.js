ObjC.import("Foundation");

const fileManager = $.NSFileManager.defaultManager;
const backgroundPath = "background.js";
if (!fileManager.fileExistsAtPath(backgroundPath)) {
  throw new Error("background.js is missing");
}

const data = $.NSData.dataWithContentsOfFile(backgroundPath);
const source = ObjC.unwrap(
  $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding),
);
const manifestData = $.NSData.dataWithContentsOfFile("manifest.json");
const manifest = JSON.parse(
  ObjC.unwrap($.NSString.alloc.initWithDataEncoding(manifestData, $.NSUTF8StringEncoding)),
);

if (!source.includes('const MALABAR_RATE_ENDPOINT = "https://gold.liverate.in/api/trend-rates";')) {
  throw new Error("background worker must use the fixed Malabar endpoint");
}
if (!source.includes('message?.type !== "blinkdeal:get-malabar-rate"')) {
  throw new Error("background worker must only handle the Malabar rate request");
}
if (!source.includes("return true;")) {
  throw new Error("background worker must keep the message channel open for the async response");
}
if (manifest.action?.default_popup !== "popup.html") {
  throw new Error("the extension must expose the coupon-monitor popup");
}
if (!manifest.optional_host_permissions?.includes("https://www.myntra.com/*")) {
  throw new Error("Myntra cart access must be optional");
}
if (!manifest.permissions?.includes("storage")) {
  throw new Error("coupon-monitor status requires local extension storage");
}
if (!manifest.optional_permissions?.includes("alarms")) {
  throw new Error("coupon-monitor scheduling must remain opt-in");
}
if (!source.includes('credentials: "include"')) {
  throw new Error("cart fetch must include the signed-in session");
}
if (!source.includes('"blinkdeal-coupon-monitor"')) {
  throw new Error("worker must schedule the fixed coupon-monitor alarm");
}
if (source.includes("chrome.cookies")) {
  throw new Error("coupon-monitor must not read browser cookies");
}
if (!source.includes("hasCouponMonitorPermissions")) {
  throw new Error("worker must guard optional monitor permissions before scheduling");
}

const popupPath = "popup.js";
if (!fileManager.fileExistsAtPath(popupPath)) {
  throw new Error("popup.js is missing");
}
const popupData = $.NSData.dataWithContentsOfFile(popupPath);
const popupSource = ObjC.unwrap(
  $.NSString.alloc.initWithDataEncoding(popupData, $.NSUTF8StringEncoding),
);
if (!popupSource.includes("chrome.permissions.request")) {
  throw new Error("popup must request optional access from a user action");
}
if (!popupSource.includes("blinkdeal:coupon-monitor-enable")) {
  throw new Error("popup must start monitoring only after permission is granted");
}
if (!popupSource.includes("blinkdeal:coupon-monitor-disable")) {
  throw new Error("popup must be able to stop monitoring");
}

console.log("test-background.js: all tests passed");
