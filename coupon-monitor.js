function extractCheckoutCartData(html) {
  const source = String(html || "");
  const marker = "window._checkout_.__myx_data__=";
  const assignmentStart = source.indexOf(marker);
  if (assignmentStart === -1) return null;

  const objectStart = source.indexOf("{", assignmentStart + marker.length);
  if (objectStart === -1) return null;

  let depth = 0;
  let inString = false;
  let escaping = false;
  for (let index = objectStart; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (character === "\\") {
        escaping = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }
    if (character === '"') {
      inString = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(source.slice(objectStart, index + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function classifyBlinkdealCoupon(cartData) {
  const cart = cartData?.cartData;
  if (!cart || !Array.isArray(cart?.price?.discounts?.data)) {
    return { state: "unavailable", activeCode: null };
  }

  const couponDiscount = cart.price.discounts.data.find(
    (discount) => String(discount?.name).toLowerCase() === "coupon",
  );
  const couponValue = Number(couponDiscount?.value);
  if (!Number.isFinite(couponValue) || couponValue < 0) {
    return { state: "unavailable", activeCode: null };
  }

  const candidates = new Set(["BLINKDEAL", "BLINKDEAL6", "BLINKDEAL8", "BLINKDEAL10"]);
  const couponContainers = [
    cart.coupons,
    cart.applicableCoupons,
    cart.potentialCoupons,
    cart.products?.map((product) => product?.appliedCoupons),
    cart.products?.map((product) => product?.personalisedPricing?.coupon),
  ];
  const stack = [...couponContainers];
  let activeCode = null;
  while (stack.length) {
    const value = stack.pop();
    if (Array.isArray(value)) {
      stack.push(...value);
    } else if (value && typeof value === "object") {
      stack.push(...Object.values(value));
    } else if (typeof value === "string") {
      const code = value.trim().toUpperCase();
      if (candidates.has(code)) {
        activeCode = code;
        break;
      }
    }
  }

  if (couponValue > 0 && activeCode) {
    return { state: "active", activeCode };
  }
  if (couponValue > 0) {
    return { state: "other-coupon", activeCode: null };
  }
  return { state: "inactive", activeCode: null };
}
