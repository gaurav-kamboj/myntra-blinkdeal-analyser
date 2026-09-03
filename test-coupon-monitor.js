ObjC.import("Foundation");

function readFile(path) {
  const data = $.NSData.dataWithContentsOfFile(path);
  return $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding).js;
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  assertEqual(JSON.stringify(actual), JSON.stringify(expected), message);
}

const source = readFile("coupon-monitor.js");
const extractHelperMatch = source.match(
  /function extractCheckoutCartData\(html\) \{[\s\S]*?\n\}/,
);
const classifyHelperMatch = source.match(
  /function classifyBlinkdealCoupon\(cartData\) \{[\s\S]*?\n\}/,
);

if (!extractHelperMatch || !classifyHelperMatch) {
  throw new Error("coupon monitor helper is missing");
}

eval(extractHelperMatch[0]);
eval(classifyHelperMatch[0]);

const extracted = extractCheckoutCartData(
  '<script>window._checkout_.__myx_data__={"cartData":{"price":{"discounts":{"data":[]}},"note":"brace { stays text"}};</script>',
);
assertEqual(
  extracted.cartData.price.discounts.data.length,
  0,
  "serialized cart data is extracted without evaluating page code",
);
assertEqual(
  extractCheckoutCartData("<script>window._checkout_.__myx_data__={bad};</script>"),
  null,
  "malformed cart data is unavailable",
);
assertDeepEqual(
  classifyBlinkdealCoupon({
    cartData: {
      coupons: [{ code: "blinkdeal8" }],
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
assertDeepEqual(
  classifyBlinkdealCoupon({
    cartData: {
      coupons: [{ code: "SAVE20" }],
      price: { discounts: { data: [{ name: "coupon", value: 200 }] } },
    },
  }),
  { state: "other-coupon", activeCode: null },
  "a positive non-Blinkdeal coupon is distinct from no coupon",
);
assertDeepEqual(
  classifyBlinkdealCoupon(null),
  { state: "unavailable", activeCode: null },
  "missing cart data is unavailable",
);

console.log("test-coupon-monitor.js: all tests passed");
