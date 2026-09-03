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

if (!source.includes('const MALABAR_RATE_ENDPOINT = "https://gold.liverate.in/api/trend-rates";')) {
  throw new Error("background worker must use the fixed Malabar endpoint");
}
if (!source.includes('message?.type !== "blinkdeal:get-malabar-rate"')) {
  throw new Error("background worker must only handle the Malabar rate request");
}
if (!source.includes("return true;")) {
  throw new Error("background worker must keep the message channel open for the async response");
}

console.log("test-background.js: all tests passed");
