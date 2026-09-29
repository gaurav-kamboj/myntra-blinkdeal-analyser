//--------------------------------------
// 🪙 Blinkdeal + ₹/g + Market Comparison (Purity-Aware + Market Rate Display)
//--------------------------------------

let MARKET_RATE = null;
let PURITY_FILTER = "all";
let BLINKDEAL_DISCOUNT_PERCENT = 8;
let FILTER_PANEL_HIDDEN = true;
let LOAD_ALL_PRODUCTS_RUNNING = false;
let MARKET_RATE_SOURCE = "malabar";
let MARKET_RATE_UPDATED_AT = null;
let MARKET_RATE_LIVE_STATUS = "idle";

//--------------------------------------
// 💰 Helpers
//--------------------------------------
function formatPrice(num) {
  return "₹" + num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function calculateDiscountedPrice(price, discountPercent = 8) {
  return price * (1 - discountPercent / 100);
}

function calculatePerGram(price, weight, discountPercent = 8) {
  if (!Number.isFinite(weight) || weight <= 0) return null;
  return calculateDiscountedPrice(price, discountPercent) / weight;
}

function parseDiscountPercent(value) {
  const normalized = String(value).trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;

  const discount = parseFloat(normalized);
  return Number.isFinite(discount) && discount > 0 && discount < 100
    ? discount
    : null;
}

function extractNumber(priceText) {
  const match = priceText.replace(/,/g, "").match(/\d+/);
  return match ? parseFloat(match[0]) : null;
}

//--------------------------------------
// ⚖️ Detect weight (ignores purity numbers like 999, 916)
//--------------------------------------
function detectWeight(card) {
  const text = card.innerText.toLowerCase();
  const matches = [
    ...text.matchAll(/(?:^|\s|[-=])(\d+(?:\.\d+)?)\s*(?:g|gm|gram)/g),
  ];
  if (matches.length === 0) return null;

  const grams = matches
    .map((m) => parseFloat(m[1]))
    .filter((w) => !isNaN(w) && w <= 200);
  if (grams.length === 0) return null;

  return grams.reduce((a, b) => a + b, 0);
}

function shouldRetryWeightDetection(weight) {
  return !Number.isFinite(weight) || weight <= 0;
}

//--------------------------------------
// 🧮 Detect purity and adjust market rate
//--------------------------------------
function detectGoldPurity(text) {
  const normalized = String(text).toLowerCase();
  if (/\b22\s*(?:kt|k|karat)\b/.test(normalized)) return "22KT";
  if (/\b23\s*(?:kt|k|karat)\b/.test(normalized)) return "23KT";
  if (/\b24\s*(?:kt|k|karat)\b/.test(normalized)) return "24KT";
  return null;
}

function getPdpPurity(documentText) {
  return detectGoldPurity(documentText);
}

function getPdpWeight(documentText) {
  const match = String(documentText).match(
    /metal weight\s*\(\s*net\s*\)\s*in grams\s*:\s*(\d+(?:\.\d+)?)\s*(?:gms?|grams?)\b/i,
  );
  return match ? parseFloat(match[1]) : null;
}

function getPdpPurityWithTitleFallback(detailsText, titleText) {
  return getPdpPurity(detailsText) || detectGoldPurity(titleText);
}

function getPdpWeightWithTitleFallback(detailsText, titleText) {
  const netWeight = getPdpWeight(detailsText);
  if (netWeight !== null) return netWeight;

  const titleMatch = String(titleText).match(
    /\b(\d+(?:\.\d+)?)\s*(?:gms?|grams?)\b/i,
  );
  return titleMatch ? parseFloat(titleMatch[1]) : null;
}

function getPdpPrice(priceText) {
  return extractNumber(String(priceText));
}

function getPdpDetailsText() {
  return document.querySelector(".pdp-details")?.innerText || "";
}

function getPdpTitleText() {
  return (
    document.querySelector(".pdp-title")?.innerText ||
    document.querySelector(".pdp-name")?.innerText ||
    ""
  );
}

function getPurityLabel(card) {
  const cardPurity = detectGoldPurity(card.innerText);
  if (cardPurity || !isProductDetailPage()) return cardPurity;
  return getPdpPurityWithTitleFallback(getPdpDetailsText(), getPdpTitleText());
}

function getAdjustedMarketRate(card) {
  const purity = getPurityLabel(card);
  return getMarketRateForPurity(purity);
}

function getMarketRateForPurity(purity) {
  if (!MARKET_RATE || !purity) return null;
  if (purity === "22KT") return MARKET_RATE * 0.916;
  if (purity === "23KT") return MARKET_RATE * 0.958;
  return MARKET_RATE;
}

function isProductDetailPage() {
  return /\/buy\/?$/.test(window.location.pathname);
}

function isGoldCoinPage(pathname = window.location.pathname) {
  const normalizedPath = String(pathname).toLowerCase();
  return normalizedPath.includes("gold") && normalizedPath.includes("coin");
}

function isOrderTrackingPage(pathname = window.location.pathname) {
  return /^\/my\/(?:orders|item\/details)\/?$/.test(String(pathname));
}

function isOrderItemDetailsPage(pathname = window.location.pathname) {
  return /^\/my\/item\/details\/?$/.test(String(pathname));
}

function getOrderDetailIdentifiers(search = window.location.search) {
  const parameters = {};
  String(search)
    .replace(/^\?/, "")
    .split("&")
    .forEach((segment) => {
      const [key, value] = segment.split("=", 2);
      if (key && value) parameters[decodeURIComponent(key)] = decodeURIComponent(value);
    });

  const storeOrderId = parameters.storeOrderId;
  const itemId = parameters.itemId;
  return storeOrderId && itemId ? { storeOrderId, itemId } : null;
}

function getOrderDetailIdentifiersFromUrl(url) {
  const [, search = ""] = String(url).split("?", 2);
  return getOrderDetailIdentifiers(search ? `?${search}` : "");
}

function isPendingDeliveryItem(item) {
  const status = String(item?.status?.name || "").toLowerCase();
  return /shipped|in transit|out for delivery|packed|confirmed|ready to ship/.test(status);
}

function getTrackingFromOrder(payload, identifiers) {
  if (!identifiers || String(payload?.order?.storeOrderId) !== identifiers.storeOrderId) return null;

  const item = payload.order.items?.find(
    (candidate) => String(candidate?.id) === identifiers.itemId,
  );
  const number = String(item?.tracking?.number || "").trim();
  const courier = String(item?.tracking?.courier?.name || "").trim();
  return number && courier ? { courier, number } : null;
}

function getOrderTrackingRequestBody(storeOrderId) {
  return {
    storeOrderId,
    getStyle: "true",
    getPayments: "true",
    getTracking: "true",
    getGiftCard: "false",
    getCart: "true",
    getCartV2: "true",
    getUsp: true,
    getReturn: "true",
  };
}

function getBluedartTrackingUrl(trackingNumber) {
  return `https://bluedart.com/?${encodeURIComponent(String(trackingNumber).trim())}`;
}

function getTrackingLinkLabel(tracking) {
  const courier = String(tracking?.courier || "").replace(/\s*\(.*/, "");
  const number = String(tracking?.number || "").trim();
  return `${courier} · ${number} ↗`;
}

function getTrackingNumberLabel(tracking) {
  const number = String(tracking?.number || "").trim();
  return `Tracking: ${number} ↗`;
}

async function fetchOrderDetails(storeOrderId) {
  const response = await fetch("/my/ss-api/fetchOrdersApi/getOrder", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(getOrderTrackingRequestBody(storeOrderId)),
  });
  return response.ok ? response.json() : null;
}

function renderOrderTrackingCard(tracking) {
  if (!tracking || document.querySelector("#blinkdeal-order-tracking")) return;

  const card = document.createElement("aside");
  card.id = "blinkdeal-order-tracking";
  card.setAttribute("aria-label", "Shipment tracking");
  Object.assign(card.style, {
    position: "fixed",
    right: "24px",
    bottom: "24px",
    boxSizing: "border-box",
    width: "210px",
    padding: "12px 14px",
    background: "#ffffff",
    color: "#173d2b",
    border: "1px solid #bde9d0",
    borderRadius: "12px",
    boxShadow: "0 10px 24px rgba(10, 54, 36, 0.2)",
    fontFamily: "Arial, sans-serif",
    zIndex: "10000",
  });

  const title = document.createElement("div");
  title.textContent = String(tracking.courier).replace(/\s*\(.*/, "");
  Object.assign(title.style, { fontSize: "15px", fontWeight: "700" });

  const trackingLink = document.createElement("a");
  trackingLink.href = getBluedartTrackingUrl(tracking.number);
  trackingLink.target = "_blank";
  trackingLink.rel = "noopener noreferrer";
  trackingLink.textContent = getTrackingNumberLabel(tracking);
  Object.assign(trackingLink.style, {
    display: "inline-block",
    marginTop: "6px",
    color: "#075f40",
    fontSize: "13px",
    fontWeight: "700",
    textDecoration: "none",
  });

  card.append(title, trackingLink);
  document.body.appendChild(card);
}

async function loadOrderTracking() {
  const identifiers = getOrderDetailIdentifiers();
  if (!identifiers) return false;

  try {
    renderOrderTrackingCard(
      getTrackingFromOrder(await fetchOrderDetails(identifiers.storeOrderId), identifiers),
    );
  } catch {
    // The order page remains unchanged when its authenticated packet cannot be read.
  }
  return true;
}

function initializeOrderTracking() {
  if (!isOrderItemDetailsPage() || window.blinkdealOrderTrackingInitialized) return;

  window.blinkdealOrderTrackingInitialized = true;
  let attempts = 0;
  const tryLoad = async () => {
    const packetFound = await loadOrderTracking();
    attempts += 1;
    if (!packetFound && attempts < 12) setTimeout(tryLoad, 1000);
  };
  tryLoad();
}

function renderOrderListTracking(link, tracking) {
  const container = link.parentElement;
  if (!container || container.querySelector(".blinkdeal-order-list-tracking")) return;

  const trackingLink = document.createElement("a");
  trackingLink.className = "blinkdeal-order-list-tracking";
  trackingLink.href = getBluedartTrackingUrl(tracking.number);
  trackingLink.target = "_blank";
  trackingLink.rel = "noopener noreferrer";
  trackingLink.textContent = getTrackingNumberLabel(tracking);
  trackingLink.setAttribute("aria-label", "Open courier tracking");
  Object.assign(trackingLink.style, {
    display: "inline-block",
    marginTop: "8px",
    color: "#075f40",
    fontSize: "13px",
    fontWeight: "700",
    textDecoration: "none",
  });
  link.insertAdjacentElement("afterend", trackingLink);
}

async function loadOrderListTracking() {
  const links = [...document.querySelectorAll(
    "a[href*='/my/item/details'], [data-href*='/my/item/details'], [data-url*='/my/item/details']",
  )]
    .map((link) => {
      const url = link.href || link.dataset.href || link.dataset.url || "";
      return { link, identifiers: getOrderDetailIdentifiersFromUrl(url) };
    })
    .filter(({ link, identifiers }) => identifiers && link.dataset.blinkdealOrderTrackingLoaded !== "true");

  await Promise.all(
    links.map(async ({ link, identifiers }) => {
      try {
        const payload = await fetchOrderDetails(identifiers.storeOrderId);
        const item = payload?.order?.items?.find(
          (candidate) => String(candidate?.id) === identifiers.itemId,
        );
        if (isPendingDeliveryItem(item)) {
          renderOrderListTracking(link, getTrackingFromOrder(payload, identifiers));
        }
        link.dataset.blinkdealOrderTrackingLoaded = "true";
      } catch {
        // Retry on the next refresh when Myntra's order response is temporarily unavailable.
      }
    }),
  );
}

function initializeOrderListTracking() {
  if (!isOrderTrackingPage() || isOrderItemDetailsPage() || window.blinkdealOrderListTrackingLoading) return;
  window.blinkdealOrderListTrackingLoading = true;
  loadOrderListTracking().finally(() => {
    window.blinkdealOrderListTrackingLoading = false;
  });
}

function getTotalListingPages(text) {
  const match = String(text).match(/page\s+\d+\s+of\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

function getListingTotalCount(text) {
  const match = String(text).match(/gold coin\s*-\s*(\d+)\s+items/i);
  return match ? parseInt(match[1], 10) : null;
}

function buildListingPageUrl(currentUrl, pageNumber, canonicalUrl = "") {
  const [urlWithoutHash, hash] = String(canonicalUrl || currentUrl).split("#", 2);
  const pageParameter = `p=${encodeURIComponent(String(pageNumber))}`;
  const hasPageParameter = /([?&])p=[^&]*/.test(urlWithoutHash);
  const nextUrl = hasPageParameter
    ? urlWithoutHash.replace(/([?&])p=[^&]*/, `$1${pageParameter}`)
    : `${urlWithoutHash}${urlWithoutHash.includes("?") ? "&" : "?"}${pageParameter}`;

  return hash ? `${nextUrl}#${hash}` : nextUrl;
}

function getUniqueProductCards(existingIds, cards) {
  return Array.from(cards).filter((card) => {
    const productId = card.id;
    if (!productId || existingIds.has(productId)) return false;
    existingIds.add(productId);
    return true;
  });
}

function getLoadAllProductsLabel(totalCount, progress) {
  if (progress) {
    return `Loading page ${progress.page} of ${progress.totalPages}…`;
  }
  return totalCount ? `Load all ${totalCount} products` : "Load all pages";
}

function setFilterPanelVisibility(hidden, root = document) {
  root
    .querySelectorAll(".search-leftContainer, .horizontal-filters-base")
    .forEach((panel) => {
    if (hidden) {
      panel.style.setProperty("display", "none", "important");
    } else {
      panel.style.removeProperty("display");
    }
  });
}

function applyFilterPanelVisibility() {
  if (!isGoldCoinPage() || isProductDetailPage()) return;
  setFilterPanelVisibility(FILTER_PANEL_HIDDEN);
}

function updateFilterPanelControl() {
  const control = document.querySelector("#blinkdeal-filter-panel-toggle");
  if (!control) return;

  const available = isGoldCoinPage() && !isProductDetailPage();
  control.style.display = available ? "block" : "none";
  control.textContent = FILTER_PANEL_HIDDEN ? "Show filters" : "Hide filters";
}

function updateLoadAllProductsControl(message, disabled, progress = null) {
  const control = document.querySelector("#blinkdeal-load-all-products");
  if (!control) return;

  const available = isGoldCoinPage() && !isProductDetailPage();
  control.style.display = available ? "block" : "none";
  if (!available) return;

  const listingText =
    document.querySelector(".title-title")?.innerText || document.body.innerText;
  control.textContent =
    message || getLoadAllProductsLabel(getListingTotalCount(listingText), progress);
  control.disabled = Boolean(disabled);
  control.setAttribute("aria-busy", String(Boolean(progress)));
  control.style.opacity = disabled ? "0.72" : "1";
  control.style.cursor = disabled ? "default" : "pointer";
}

function toggleFilterPanel() {
  FILTER_PANEL_HIDDEN = !FILTER_PANEL_HIDDEN;
  localStorage.setItem(
    "myntra_blinkdeal_filter_panel_hidden",
    String(FILTER_PANEL_HIDDEN),
  );
  applyFilterPanelVisibility();
  updateFilterPanelControl();
}

function getPurityColor(purity) {
  switch (purity) {
    case "22KT":
      return "#d4a017"; // gold/yellow
    case "23KT":
      return "#ff8800"; // amber
    case "24KT":
      return "#007d44"; // green
    default:
      return "#6c7280"; // neutral while purity is unavailable
  }
}

function getDealStatus(diffPct) {
  if (diffPct <= -3) {
    return {
      label: "Steal deal",
      detail: "Below sell rate",
      color: "#087c4b",
      background: "#d9f7e7",
    };
  }
  if (diffPct < 0) {
    return {
      label: "Fair buy",
      detail: "Near market rate",
      color: "#956500",
      background: "#fff1c2",
    };
  }
  if (diffPct > 0 && diffPct < 3) {
    return {
      label: "Premium",
      detail: "Above market",
      color: "#b75b00",
      background: "#ffe3c0",
    };
  }
  return {
    label: "Overpriced",
    detail: "Avoid",
    color: "#ba2e2e",
    background: "#ffe1df",
  };
}

function formatComparisonPercent(diffPct) {
  return `${Math.abs(diffPct).toFixed(1)}% ${diffPct < 0 ? "below" : "above"}`;
}

function findBestPerGramByPurity(products) {
  return products.reduce((bestByPurity, product) => {
    if (
      !product.purity ||
      !Number.isFinite(product.perGram) ||
      product.perGram <= 0
    ) {
      return bestByPurity;
    }

    const currentBest = bestByPurity[product.purity];
    if (!currentBest || product.perGram < currentBest.perGram) {
      bestByPurity[product.purity] = product;
    }
    return bestByPurity;
  }, {});
}

function updateBestDealBadges() {
  document
    .querySelectorAll(".blinkdeal-best-badge")
    .forEach((badge) => badge.remove());

  const products = Array.from(
    document.querySelectorAll("[data-blinkdeal-injected='true']"),
  )
    .filter(
      (card) =>
        card.dataset.blinkdealExcluded !== "true" &&
        card.dataset.blinkdealBrandHidden !== "true",
    )
    .map((card) => ({
      card,
      purity: card.dataset.blinkdealPurity,
      perGram: parseFloat(card.dataset.perGram),
    }));
  const bestDeals = findBestPerGramByPurity(products);

  Object.values(bestDeals).forEach(({ card }) => {
    const purityChip = card.querySelector(".blinkdeal-purity-chip");
    if (!purityChip) return;

    const badge = document.createElement("span");
    badge.className = "blinkdeal-best-badge";
    badge.textContent = "Best ₹/g";
    Object.assign(badge.style, {
      flex: "0 0 auto",
      padding: "2px 5px",
      background: "#e7b52d",
      color: "#173d2b",
      borderRadius: "999px",
      fontSize: "10px",
      fontWeight: "800",
      whiteSpace: "nowrap",
    });
    purityChip.insertAdjacentElement("beforebegin", badge);
  });
}

function updatePdpDealCard() {
  if (!isProductDetailPage()) return;

  document.querySelector("#blinkdeal-pdp-card")?.remove();

  const addToBag = document.querySelector(".pdp-add-to-bag");
  const priceElement = document.querySelector(".pdp-price");
  const price = getPdpPrice(priceElement?.innerText || "");
  if (!addToBag || !price) return;

  const detailsText = getPdpDetailsText();
  const titleText = getPdpTitleText();
  const purity = getPdpPurityWithTitleFallback(detailsText, titleText);
  const weight = getPdpWeightWithTitleFallback(detailsText, titleText);
  const discounted = calculateDiscountedPrice(price, BLINKDEAL_DISCOUNT_PERCENT);
  const perGram = calculatePerGram(price, weight, BLINKDEAL_DISCOUNT_PERCENT);
  const marketRate = getMarketRateForPurity(purity);
  const diffPct = marketRate && perGram !== null
    ? ((perGram - marketRate) / marketRate) * 100
    : null;
  const dealStatus = diffPct === null ? null : getDealStatus(diffPct);

  const box = document.createElement("section");
  box.id = "blinkdeal-pdp-card";
  box.setAttribute("aria-label", "Blinkdeal price analysis");
  Object.assign(box.style, {
    boxSizing: "border-box",
    width: "100%",
    margin: "16px 0",
    padding: "12px 14px",
    background: "#f0fbf5",
    border: "1px solid #c7efda",
    borderLeft: "4px solid #ffd45a",
    borderRadius: "10px",
    color: "#173d2b",
    fontFamily: "Arial, sans-serif",
  });
  box.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
      <span style="font-size:13px; font-weight:800;">Blinkdeal price <strong style="font-size:18px; white-space:nowrap;">${formatPrice(discounted)}</strong></span>
      <span style="flex:0 0 auto; padding:3px 7px; color:${getPurityColor(purity)}; background:#fff; border:1px solid ${getPurityColor(purity)}55; border-radius:999px; font-size:11px; font-weight:800;">${purity || "Purity unavailable"}</span>
    </div>
    ${
      perGram === null
        ? `<div style="margin-top:6px; color:#755b20; font-size:12px;">Weight unavailable · ₹/g pending</div>`
        : `<div style="margin-top:6px; color:#355c4a; font-size:12px;">
            <strong style="font-size:15px;">${formatPrice(perGram)}/g</strong> · ${weight} g
            ${
              dealStatus
                ? `<span style="color:${dealStatus.color}; font-weight:800;"> · ${dealStatus.label} · ${formatComparisonPercent(diffPct)}</span>`
                : ""
            }
          </div>`
    }
  `;

  const purchaseRow = addToBag.parentElement;
  purchaseRow?.insertAdjacentElement("beforebegin", box);
  hideFloatingBell();
}

function matchesPurityFilter(purity, filter) {
  return filter === "all" || purity === filter;
}

function isMyntraBellClass(className) {
  return String(className)
    .split(/\s+/)
    .includes("iz-news-hub-bell");
}

function hideFloatingBell() {
  const widget = document.querySelector("#iz-news-hub-discovr-outer-wrapper");
  const bell = widget?.querySelector("svg.iz-news-hub-bell");
  if (!widget || !bell || !isMyntraBellClass(bell.className.baseVal)) return;

  widget.style.setProperty("display", "none", "important");
  widget.dataset.blinkdealHiddenNotification = "true";
}

function isHiddenBrand(text) {
  return /\bparshwa\s+padmavati\s+gold\b/i.test(String(text));
}

//--------------------------------------
// 🧾 Inject Blinkdeal + Market Compare
//--------------------------------------
function injectDiscountLabels() {
  const productCards = document.querySelectorAll(
    "li, .product-base, .product, article",
  );

  productCards.forEach((card) => {
    const titleText = card.innerText.toLowerCase();
    if (isHiddenBrand(titleText)) {
      card.style.setProperty("display", "none", "important");
      card.dataset.blinkdealBrandHidden = "true";
      return;
    }

    const retryingWeight = card.dataset.blinkdealNeedsWeight === "true";
    const retryingPurity =
      isProductDetailPage() && card.dataset.blinkdealNeedsPurity === "true";
    if (card.dataset.blinkdealInjected && !retryingWeight && !retryingPurity) return;

    // 🟥 Skip MMTC items
    if (titleText.includes("mmtc")) {
      const redNotice = document.createElement("div");
      redNotice.textContent = "BLINKDEAL not applicable";
      Object.assign(redNotice.style, {
        color: "#cc0000",
        fontWeight: "600",
        fontSize: "13px",
        marginTop: "6px",
        background: "#ffeaea",
        borderRadius: "6px",
        display: "inline-block",
        padding: "4px 8px",
      });
      const priceEl = card.querySelector("p, span, div");
      if (priceEl) priceEl.insertAdjacentElement("afterend", redNotice);
      card.dataset.perGram = "Infinity";
      card.dataset.blinkdealPurity = getPurityLabel(card);
      card.dataset.blinkdealExcluded = "true";
      card.dataset.blinkdealInjected = "true";
      return;
    }

    // 🔍 Find visible price
    const priceEl = Array.from(card.querySelectorAll("p, span, div")).find(
      (el) =>
        /^Rs\.\s?\d+/.test(el.innerText.trim()) &&
        !el.style.textDecoration.includes("line-through"),
    );
    if (!priceEl) return;

    const price = extractNumber(priceEl.innerText);
    if (!price || price < 1000) return;

    if (retryingWeight || retryingPurity) {
      card.querySelector(".blinkdeal-info")?.remove();
    }

    const weight = detectWeight(card);
    const discounted = calculateDiscountedPrice(price, BLINKDEAL_DISCOUNT_PERCENT);
    const perGram = calculatePerGram(
      price,
      weight,
      BLINKDEAL_DISCOUNT_PERCENT,
    );
    const purityLabel = getPurityLabel(card);
    const purityColor = getPurityColor(purityLabel);
    const adjustedRate = MARKET_RATE && perGram !== null && purityLabel
      ? getAdjustedMarketRate(card)
      : null;
    const diffPct = adjustedRate
      ? ((perGram - adjustedRate) / adjustedRate) * 100
      : null;
    const dealStatus = diffPct === null ? null : getDealStatus(diffPct);

    // 💡 Info box
    const box = document.createElement("div");
    box.className = "blinkdeal-info";
    Object.assign(box.style, {
      boxSizing: "border-box",
      width: "100%",
      maxWidth: "100%",
      background: "#f0fbf5",
      border: "1px solid #c7efda",
      borderLeft: "4px solid #ffd45a",
      borderRadius: "8px",
      padding: "7px 9px",
      marginTop: "6px",
      display: "block",
      lineHeight: "15px",
      fontSize: "12px",
      fontFamily: "sans-serif",
    });

    // 📊 Core info
    box.innerHTML = `
      <div style="display:flex; align-items:baseline; justify-content:space-between; gap:8px; color:#175c3d;">
        <span style="font-size:12px; font-weight:700;">Blinkdeal <strong style="font-size:14px; white-space:nowrap;">${formatPrice(discounted)}</strong></span>
        <span class="blinkdeal-purity-chip" style="flex:0 0 auto; padding:2px 5px; color:${purityColor}; background:#fff; border:1px solid ${purityColor}55; border-radius:999px; font-size:10px; font-weight:800;">${purityLabel || "Purity unavailable"}</span>
      </div>
      ${
        perGram === null
          ? `<div style="margin-top:4px; color:#755b20; font-size:11px;">Weight unavailable · ₹/g pending</div>`
          : `<div style="margin-top:4px; color:#355c4a; font-size:11px;">
              <strong style="color:#173d2b; font-size:13px;">${formatPrice(perGram)}/g</strong>
              <span> · ${weight} g</span>
              ${
                dealStatus
                  ? `<span style="color:${dealStatus.color}; font-weight:800;"> · ${dealStatus.label} · ${formatComparisonPercent(diffPct)}</span>`
                  : ""
              }
            </div>`
      }
    `;

    priceEl.insertAdjacentElement("afterend", box);
    if (shouldRetryWeightDetection(weight)) {
      card.dataset.blinkdealNeedsWeight = "true";
      delete card.dataset.perGram;
    } else {
      delete card.dataset.blinkdealNeedsWeight;
      card.dataset.perGram = perGram;
    }
    if (purityLabel) {
      card.dataset.blinkdealPurity = purityLabel;
      delete card.dataset.blinkdealNeedsPurity;
    } else {
      delete card.dataset.blinkdealPurity;
      if (isProductDetailPage()) {
        card.dataset.blinkdealNeedsPurity = "true";
      }
    }
    card.dataset.blinkdealInjected = "true";
  });

  updateBestDealBadges();
  if (PURITY_FILTER !== "all") applyPurityFilter();
  hideFloatingBell();
}

function setPaginationVisibility(hidden) {
  document.querySelectorAll(".pagination-container").forEach((pagination) => {
    if (hidden) {
      pagination.style.setProperty("display", "none", "important");
    } else {
      pagination.style.removeProperty("display");
    }
  });
}

async function loadAllListingProducts() {
  if (LOAD_ALL_PRODUCTS_RUNNING || !isGoldCoinPage() || isProductDetailPage()) {
    return;
  }

  const container = document.querySelector("ul.results-base");
  const totalPages = getTotalListingPages(
    document.querySelector(".pagination-container")?.innerText || "",
  );
  if (!container || !totalPages || totalPages < 2) {
    updateLoadAllProductsControl("No additional pages", true);
    return;
  }

  const currentPageMatch = location.search.match(/[?&]p=(\d+)/);
  const currentPage = currentPageMatch ? parseInt(currentPageMatch[1], 10) : 1;
  const canonicalListingUrl =
    document.querySelector('link[rel="canonical"]')?.href || location.href;
  const knownIds = new Set(
    Array.from(container.querySelectorAll("li.product-base"))
      .map((card) => card.id)
      .filter(Boolean),
  );
  let loadingPage = currentPage;
  LOAD_ALL_PRODUCTS_RUNNING = true;

  try {
    for (let page = 1; page <= totalPages; page += 1) {
      if (page === currentPage) continue;

      loadingPage = page;
      updateLoadAllProductsControl(null, true, { page, totalPages });
      const response = await fetch(
        buildListingPageUrl(location.href, page, canonicalListingUrl),
      );
      if (!response.ok) throw new Error(`Page ${page} failed to load`);

      const parsed = new DOMParser().parseFromString(
        await response.text(),
        "text/html",
      );
      const cards = getUniqueProductCards(
        knownIds,
        parsed.querySelectorAll("li.product-base"),
      );
      cards.forEach((card) => {
        container.appendChild(document.importNode(card, true));
      });
      injectDiscountLabels();
    }

    updateBestDealBadges();
    setPaginationVisibility(true);
    updateLoadAllProductsControl("All products loaded", true);
  } catch (error) {
    setPaginationVisibility(false);
    updateLoadAllProductsControl(
      `Page ${loadingPage} failed — retry`,
      false,
    );
  } finally {
    LOAD_ALL_PRODUCTS_RUNNING = false;
  }
}

//--------------------------------------
// 🔁 Continuous refresh
//--------------------------------------
function refreshData() {
  if (isOrderItemDetailsPage()) {
    document.querySelector("#blinkdeal-tools")?.remove();
    initializeOrderTracking();
  } else if (isOrderTrackingPage()) {
    document.querySelector("#blinkdeal-tools")?.remove();
    document.querySelector("#blinkdeal-order-tracking")?.remove();
    initializeOrderListTracking();
  } else if (isProductDetailPage()) {
    document.querySelector("#blinkdeal-order-tracking")?.remove();
    delete window.blinkdealOrderTrackingInitialized;
    updatePdpDealCard();
  } else {
    document.querySelector("#blinkdeal-order-tracking")?.remove();
    delete window.blinkdealOrderTrackingInitialized;
    applyFilterPanelVisibility();
    injectDiscountLabels();
  }
  if (!window.blinkdealInterval) {
    window.blinkdealInterval = setInterval(refreshData, 2500);
  }
}

function recalculateProductCards() {
  document
    .querySelectorAll("[data-blinkdeal-injected='true']")
    .forEach((card) => {
      if (
        card.dataset.blinkdealBrandHidden === "true" ||
        card.dataset.blinkdealExcluded === "true"
      ) {
        return;
      }

      card.querySelectorAll(".blinkdeal-info").forEach((box) => box.remove());
      delete card.dataset.blinkdealInjected;
      delete card.dataset.blinkdealNeedsWeight;
      delete card.dataset.perGram;
    });
  refreshData();
}

function setBlinkdealDiscount(discountPercent) {
  if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent >= 100) {
    return;
  }

  BLINKDEAL_DISCOUNT_PERCENT = discountPercent;
  localStorage.setItem(
    "myntra_blinkdeal_discount_percent",
    BLINKDEAL_DISCOUNT_PERCENT,
  );
  updateDiscountDock();
  recalculateProductCards();
}

//--------------------------------------
// 💬 Market rate input (persistent)
//--------------------------------------
function parseMarketRate(value) {
  const normalized = String(value).trim().replace(/,/g, "");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;

  const rate = parseFloat(normalized);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function getMalabarLiveRate(payload) {
  const item = Array.isArray(payload?.items)
    ? payload.items.find((candidate) => candidate?.id === "malabar")
    : null;
  const rate = parseMarketRate(item?.today);
  if (rate === null) return null;

  return {
    rate,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : null,
  };
}

function normalizeMarketRateSource(value) {
  return value === "manual" ? "manual" : "malabar";
}

function getMarketRateStatus(source, liveStatus, hasRate) {
  if (source === "manual") return "Manual rate";
  if (liveStatus === "loading") return "Refreshing Malabar rate";
  if (liveStatus === "unavailable") {
    return hasRate ? "Cached Malabar rate" : "Live rate unavailable";
  }
  return hasRate ? "Live Malabar 24K" : "Live rate pending";
}

function getCouponMonitorBanner(status) {
  if (status?.enabled && status.state === "active" && status.activeCode) {
    return {
      label: `Blinkdeal active — ${status.activeCode}`,
      tone: "active",
    };
  }
  if (status?.enabled && (status.state === "inactive" || status.state === "other-coupon")) {
    return { label: "Blinkdeal not active", tone: "inactive" };
  }
  if (status?.enabled && status.state === "unavailable") {
    return { label: "Blinkdeal status unavailable", tone: "inactive" };
  }
  return { label: "Cart monitoring is off", tone: "inactive" };
}

function updateCouponMonitorBanner(status) {
  let banner = document.querySelector("#blinkdeal-coupon-monitor-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "blinkdeal-coupon-monitor-banner";
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");
    Object.assign(banner.style, {
      position: "sticky",
      top: "0",
      zIndex: "2147483647",
      boxSizing: "border-box",
      width: "100%",
      minHeight: "28px",
      padding: "6px 16px",
      textAlign: "center",
      fontFamily: "Arial, sans-serif",
      fontSize: "12px",
      fontWeight: "700",
      lineHeight: "16px",
      letterSpacing: "0.1px",
    });
    document.body.prepend(banner);
  }

  const display = getCouponMonitorBanner(status);
  banner.textContent = display.label;
  banner.style.background = display.tone === "active" ? "#0b7a51" : "#e8ecea";
  banner.style.color = display.tone === "active" ? "#ffffff" : "#52605b";
}

function requestCouponMonitorStatus() {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;

  chrome.runtime.sendMessage({ type: "blinkdeal:coupon-monitor-status" }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      updateCouponMonitorBanner(null);
      return;
    }
    updateCouponMonitorBanner(response.status);
  });
}

function initializeCouponMonitorBanner() {
  updateCouponMonitorBanner(null);
  requestCouponMonitorStatus();
  if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return;

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.blinkdealCouponMonitor) return;
    updateCouponMonitorBanner(changes.blinkdealCouponMonitor.newValue);
  });
}

function requestMalabarMarketRate() {
  return new Promise((resolve, reject) => {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      reject(new Error("Extension background worker is unavailable"));
      return;
    }

    chrome.runtime.sendMessage({ type: "blinkdeal:get-malabar-rate" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "Unable to fetch the Malabar rate"));
        return;
      }
      resolve(response.payload);
    });
  });
}

function getCachedMalabarLiveRate() {
  try {
    const cached = JSON.parse(
      localStorage.getItem("myntra_malabar_market_rate_cache") || "null",
    );
    const rate = parseMarketRate(cached?.rate);
    return rate === null
      ? null
      : {
          rate,
          updatedAt: typeof cached.updatedAt === "string" ? cached.updatedAt : null,
        };
  } catch {
    return null;
  }
}

function saveMarketRate(rate, source, updatedAt = null) {
  MARKET_RATE = rate;
  MARKET_RATE_SOURCE = normalizeMarketRateSource(source);
  MARKET_RATE_UPDATED_AT = updatedAt;
  localStorage.setItem("myntra_market_rate", String(rate));
  localStorage.setItem("myntra_market_rate_source", MARKET_RATE_SOURCE);
}

function applyCachedMalabarRate() {
  const cached = getCachedMalabarLiveRate();
  if (!cached) return false;

  MARKET_RATE = cached.rate;
  MARKET_RATE_SOURCE = "malabar";
  MARKET_RATE_UPDATED_AT = cached.updatedAt;
  return true;
}

async function refreshMalabarMarketRate(forceLiveRate = false) {
  if (MARKET_RATE_SOURCE === "manual" && !forceLiveRate) return false;

  MARKET_RATE_LIVE_STATUS = "loading";
  updateToolsDock();
  updateLiveRateControl();

  try {
    const liveRate = getMalabarLiveRate(await requestMalabarMarketRate());
    if (!liveRate) throw new Error("Malabar 24K rate is unavailable");

    saveMarketRate(liveRate.rate, "malabar", liveRate.updatedAt);
    localStorage.setItem(
      "myntra_malabar_market_rate_cache",
      JSON.stringify(liveRate),
    );
    MARKET_RATE_LIVE_STATUS = "live";
    updateToolsDock();
    updateLiveRateControl();
    refreshData();
    return true;
  } catch (error) {
    MARKET_RATE_LIVE_STATUS = "unavailable";
    if (MARKET_RATE_SOURCE === "malabar" && !MARKET_RATE) {
      applyCachedMalabarRate();
    }
    updateToolsDock();
    updateLiveRateControl();
    return false;
  }
}

function useLiveMalabarRate() {
  MARKET_RATE_SOURCE = "malabar";
  localStorage.setItem("myntra_market_rate_source", "malabar");
  return refreshMalabarMarketRate(true);
}

function promptMarketRate() {
  if (document.querySelector("#blinkdeal-rate-modal")) return;

  const previouslyFocused = document.activeElement;
  const overlay = document.createElement("div");
  overlay.id = "blinkdeal-rate-modal";
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    display: "grid",
    placeItems: "center",
    padding: "20px",
    background: "rgba(3, 28, 19, 0.56)",
    backdropFilter: "blur(3px)",
    zIndex: "10000",
    fontFamily: "Arial, sans-serif",
  });

  const dialog = document.createElement("form");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "blinkdeal-rate-title");
  Object.assign(dialog.style, {
    width: "min(100%, 390px)",
    padding: "22px",
    background: "linear-gradient(145deg, #073d2a, #052d20)",
    color: "#fff",
    border: "1px solid #2b8660",
    borderRadius: "16px",
    boxShadow: "0 22px 60px rgba(0, 0, 0, 0.35)",
  });

  const crest = document.createElement("div");
  crest.textContent = "₹";
  Object.assign(crest.style, {
    display: "grid",
    placeItems: "center",
    width: "34px",
    height: "34px",
    background: "#ffd45a",
    color: "#123d2c",
    borderRadius: "50%",
    fontSize: "19px",
    fontWeight: "800",
  });

  const title = document.createElement("h2");
  title.id = "blinkdeal-rate-title";
  title.textContent = "Set gold market rate";
  Object.assign(title.style, {
    margin: "14px 0 4px",
    fontSize: "20px",
    lineHeight: "26px",
  });

  const description = document.createElement("p");
  description.textContent = "Enter today’s 24KT rate per gram. We’ll use it to compare every listed coin.";
  Object.assign(description.style, {
    margin: "0",
    color: "#bcefd3",
    fontSize: "13px",
    lineHeight: "19px",
  });

  const label = document.createElement("label");
  label.htmlFor = "blinkdeal-rate-input";
  label.textContent = "24KT market rate (₹ per gram)";
  Object.assign(label.style, {
    display: "block",
    marginTop: "18px",
    fontSize: "12px",
    fontWeight: "700",
  });

  const input = document.createElement("input");
  input.id = "blinkdeal-rate-input";
  input.type = "text";
  input.inputMode = "decimal";
  input.autocomplete = "off";
  input.value = MARKET_RATE || "12500";
  input.setAttribute("aria-describedby", "blinkdeal-rate-help blinkdeal-rate-error");
  Object.assign(input.style, {
    boxSizing: "border-box",
    width: "100%",
    marginTop: "7px",
    padding: "12px 13px",
    background: "#fffdf5",
    color: "#123d2c",
    border: "2px solid #ffd45a",
    borderRadius: "9px",
    fontSize: "18px",
    fontWeight: "700",
  });

  const help = document.createElement("div");
  help.id = "blinkdeal-rate-help";
  help.textContent = "Example: 14,850";
  Object.assign(help.style, {
    marginTop: "6px",
    color: "#bcefd3",
    fontSize: "12px",
  });

  const error = document.createElement("div");
  error.id = "blinkdeal-rate-error";
  error.setAttribute("aria-live", "polite");
  Object.assign(error.style, {
    minHeight: "18px",
    marginTop: "5px",
    color: "#ffd2c9",
    fontSize: "12px",
    fontWeight: "700",
  });

  const actions = document.createElement("div");
  Object.assign(actions.style, {
    display: "flex",
    justifyContent: "flex-end",
    gap: "9px",
    marginTop: "16px",
  });

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel";
  const save = document.createElement("button");
  save.type = "submit";
  save.textContent = "Save rate";

  [cancel, save].forEach((button) => {
    Object.assign(button.style, {
      padding: "10px 14px",
      borderRadius: "8px",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: "700",
    });
  });
  Object.assign(cancel.style, {
    background: "transparent",
    color: "#fff",
    border: "1px solid #77c7a0",
  });
  Object.assign(save.style, {
    background: "#ffd45a",
    color: "#123d2c",
    border: "1px solid #ffd45a",
  });

  const closeModal = () => {
    document.removeEventListener("keydown", handleKeydown);
    overlay.remove();
    if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
  };
  const handleKeydown = (event) => {
    if (event.key === "Escape") closeModal();
  };

  cancel.addEventListener("click", closeModal);
  dialog.addEventListener("submit", (event) => {
    event.preventDefault();
    const rate = parseMarketRate(input.value);
    if (rate === null) {
      error.textContent = "Enter a positive number, for example 14,850.";
      input.focus();
      return;
    }

    saveMarketRate(rate, "manual");
    MARKET_RATE_LIVE_STATUS = "manual";
    updateToolsDock();
    updateLiveRateControl();
    refreshData();
    closeModal();
  });

  actions.append(cancel, save);
  dialog.append(crest, title, description, label, input, help, error, actions);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  document.addEventListener("keydown", handleKeydown);
  setTimeout(() => input.focus(), 0);
}

//--------------------------------------
// ⚙️ Gold Deal Tools dock
//--------------------------------------
function getFullWidthControlStyles() {
  return {
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "100%",
  };
}

function applyPurityFilter() {
  document
    .querySelectorAll("[data-blinkdeal-injected='true']")
    .forEach((card) => {
      const purity = card.dataset.blinkdealPurity;
      if (!purity) return;

      const shouldShow = matchesPurityFilter(purity, PURITY_FILTER);
      const hasSavedDisplay = Object.prototype.hasOwnProperty.call(
        card.dataset,
        "blinkdealFilterDisplay",
      );

      if (shouldShow) {
        if (hasSavedDisplay) {
          card.style.display = card.dataset.blinkdealFilterDisplay;
          delete card.dataset.blinkdealFilterDisplay;
        }
        return;
      }

      if (!hasSavedDisplay) {
        card.dataset.blinkdealFilterDisplay = card.style.display;
      }
      card.style.display = "none";
    });
}

function updatePurityFilterDock() {
  document
    .querySelectorAll("#blinkdeal-tools [data-blinkdeal-filter]")
    .forEach((button) => {
      const selected = button.dataset.blinkdealFilter === PURITY_FILTER;
      button.setAttribute("aria-pressed", String(selected));
      button.style.background = selected ? "#ffd45a" : "transparent";
      button.style.color = selected ? "#123d2c" : "#d9f7e7";
      button.style.borderColor = selected ? "#ffd45a" : "#77c7a0";
    });
}

function setPurityFilter(filter) {
  if (!["all", "24KT", "22KT"].includes(filter)) return;
  PURITY_FILTER = filter;
  applyPurityFilter();
  updatePurityFilterDock();
}

function updateToolsDock() {
  const rateLabel = document.querySelector("#blinkdeal-market-rate");
  if (!rateLabel) return;

  rateLabel.textContent = MARKET_RATE
    ? `Market rate: ${formatPrice(MARKET_RATE)}/g`
    : "Market rate not set";
  rateLabel.style.color = MARKET_RATE ? "#bcefd3" : "#f6d98e";

  const statusLabel = document.querySelector("#blinkdeal-market-rate-status");
  if (!statusLabel) return;

  statusLabel.textContent = getMarketRateStatus(
    MARKET_RATE_SOURCE,
    MARKET_RATE_LIVE_STATUS,
    Boolean(MARKET_RATE),
  );
  statusLabel.style.color = MARKET_RATE_SOURCE === "manual" || MARKET_RATE_LIVE_STATUS === "unavailable"
    ? "#f6d98e"
    : "#bcefd3";
}

function updateLiveRateControl() {
  const control = document.querySelector("#blinkdeal-live-malabar-rate");
  if (!control) return;

  const loading = MARKET_RATE_LIVE_STATUS === "loading";
  const label = loading
    ? "Refreshing Malabar rate"
    : MARKET_RATE_SOURCE === "manual"
      ? "Use live Malabar rate"
      : "Refresh Malabar rate";
  control.textContent = loading ? "…" : "↻";
  control.setAttribute("aria-label", label);
  control.title = label;
  control.disabled = loading;
  control.style.opacity = loading ? "0.72" : "1";
  control.style.cursor = loading ? "default" : "pointer";
}

function updateDiscountDock() {
  const customDiscount = ![6, 8].includes(BLINKDEAL_DISCOUNT_PERCENT);
  document
    .querySelectorAll("#blinkdeal-tools [data-blinkdeal-discount]")
    .forEach((button) => {
      const value = button.dataset.blinkdealDiscount;
      const selected = value === "custom"
        ? customDiscount
        : Number(value) === BLINKDEAL_DISCOUNT_PERCENT;
      button.setAttribute("aria-pressed", String(selected));
      button.style.background = selected ? "#ffd45a" : "transparent";
      button.style.color = selected ? "#123d2c" : "#d9f7e7";
      button.style.borderColor = selected ? "#ffd45a" : "#77c7a0";
    });

  const input = document.querySelector("#blinkdeal-custom-discount");
  if (input) input.value = BLINKDEAL_DISCOUNT_PERCENT;
  const editor = document.querySelector("#blinkdeal-custom-discount-editor");
  if (editor) editor.style.display = customDiscount ? "flex" : "none";
}

function createButtons() {
  if (isOrderTrackingPage()) {
    document.querySelector("#blinkdeal-tools")?.remove();
    return;
  }
  if (document.querySelector("#blinkdeal-tools")) {
    updateToolsDock();
    updateLiveRateControl();
    updateDiscountDock();
    updatePurityFilterDock();
    updateFilterPanelControl();
    updateLoadAllProductsControl(null, false);
    return;
  }

  const dock = document.createElement("section");
  dock.id = "blinkdeal-tools";
  dock.setAttribute("aria-label", "Gold deal tools");
  Object.assign(dock.style, {
    position: "fixed",
    right: "24px",
    bottom: "24px",
    boxSizing: "border-box",
    width: "188px",
    padding: "12px",
    background: "#063d2a",
    color: "#fff",
    border: "1px solid #16734e",
    borderRadius: "12px",
    boxShadow: "0 10px 24px rgba(10, 54, 36, 0.28)",
    fontFamily: "Arial, sans-serif",
    zIndex: "9999",
  });

  const header = document.createElement("div");
  Object.assign(header.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  });

  const title = document.createElement("div");
  title.textContent = "Gold Deal Tools";
  Object.assign(title.style, {
    fontSize: "14px",
    fontWeight: "700",
    letterSpacing: "0.1px",
  });
  header.appendChild(title);

  const createIconControl = (icon, label, onClick, id) => {
    const button = document.createElement("button");
    button.type = "button";
    button.id = id;
    button.textContent = icon;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.addEventListener("click", onClick);
    Object.assign(button.style, {
      display: "grid",
      placeItems: "center",
      width: "28px",
      height: "28px",
      padding: "0",
      background: "transparent",
      color: "#d9f7e7",
      border: "1px solid #77c7a0",
      borderRadius: "7px",
      cursor: "pointer",
      fontSize: "17px",
      lineHeight: "1",
    });
    return button;
  };

  const rateActions = document.createElement("div");
  Object.assign(rateActions.style, {
    display: "flex",
    gap: "5px",
  });
  rateActions.append(
    createIconControl("✎", "Set market rate", promptMarketRate, "blinkdeal-edit-market-rate"),
    createIconControl("↻", "Refresh Malabar rate", useLiveMalabarRate, "blinkdeal-live-malabar-rate"),
  );
  header.appendChild(rateActions);

  const rateInfo = document.createElement("div");

  const rateLabel = document.createElement("div");
  rateLabel.id = "blinkdeal-market-rate";
  Object.assign(rateLabel.style, {
    marginTop: "4px",
    fontSize: "12px",
    lineHeight: "16px",
  });

  const rateStatusLabel = document.createElement("div");
  rateStatusLabel.id = "blinkdeal-market-rate-status";
  rateStatusLabel.setAttribute("aria-live", "polite");
  Object.assign(rateStatusLabel.style, {
    marginTop: "1px",
    fontSize: "10px",
    lineHeight: "14px",
  });
  rateInfo.append(rateLabel, rateStatusLabel);

  const discountLabel = document.createElement("div");
  discountLabel.textContent = "Blinkdeal discount";
  Object.assign(discountLabel.style, {
    marginTop: "12px",
    color: "#bcefd3",
    fontSize: "11px",
    fontWeight: "700",
  });

  const discounts = document.createElement("div");
  discounts.setAttribute("role", "group");
  discounts.setAttribute("aria-label", "Set Blinkdeal discount");
  Object.assign(discounts.style, {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "5px",
    marginTop: "6px",
  });

  const customDiscountEditor = document.createElement("div");
  customDiscountEditor.id = "blinkdeal-custom-discount-editor";
  Object.assign(customDiscountEditor.style, {
    display: "none",
    alignItems: "center",
    gap: "5px",
    marginTop: "6px",
  });

  const customDiscountInput = document.createElement("input");
  customDiscountInput.id = "blinkdeal-custom-discount";
  customDiscountInput.type = "text";
  customDiscountInput.inputMode = "decimal";
  customDiscountInput.setAttribute("aria-label", "Custom Blinkdeal discount percentage");
  Object.assign(customDiscountInput.style, {
    boxSizing: "border-box",
    width: "78px",
    padding: "6px 7px",
    background: "#fffdf5",
    color: "#123d2c",
    border: "1px solid #ffd45a",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "700",
  });

  const customDiscountApply = document.createElement("button");
  customDiscountApply.type = "button";
  customDiscountApply.textContent = "Apply";
  Object.assign(customDiscountApply.style, {
    flex: "1",
    padding: "6px 7px",
    background: "#ffd45a",
    color: "#123d2c",
    border: "1px solid #ffd45a",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: "700",
  });

  const applyCustomDiscount = () => {
    const discount = parseDiscountPercent(customDiscountInput.value);
    if (discount === null) {
      customDiscountInput.style.borderColor = "#ff9d8f";
      customDiscountInput.focus();
      return;
    }
    customDiscountInput.style.borderColor = "#ffd45a";
    setBlinkdealDiscount(discount);
  };
  customDiscountApply.addEventListener("click", applyCustomDiscount);
  customDiscountInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") applyCustomDiscount();
  });

  [
    ["6", "6%"],
    ["8", "8%"],
    ["custom", "Custom"],
  ].forEach(([value, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.blinkdealDiscount = value;
    button.textContent = label;
    button.addEventListener("click", () => {
      if (value === "custom") {
        customDiscountEditor.style.display = "flex";
        customDiscountInput.focus();
        return;
      }
      setBlinkdealDiscount(Number(value));
    });
    Object.assign(button.style, {
      boxSizing: "border-box",
      minWidth: "0",
      padding: "7px 3px",
      border: "1px solid #77c7a0",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "11px",
      fontWeight: "700",
    });
    discounts.appendChild(button);
  });
  customDiscountEditor.append(customDiscountInput, customDiscountApply);

  const actions = document.createElement("div");
  Object.assign(actions.style, {
    marginTop: "9px",
    minWidth: "0",
  });

  const createAction = (label, onClick, primary = false) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", onClick);
    Object.assign(button.style, {
      ...getFullWidthControlStyles(),
      padding: "7px 8px",
      background: primary ? "#ffd45a" : "transparent",
      color: primary ? "#123d2c" : "#fff",
      border: primary ? "1px solid #ffd45a" : "1px solid #77c7a0",
      borderRadius: "7px",
      cursor: "pointer",
      fontSize: "11px",
      fontWeight: "700",
      textAlign: "left",
    });
    button.addEventListener("focus", () => {
      button.style.outline = "3px solid rgba(255, 212, 90, 0.55)";
      button.style.outlineOffset = "2px";
    });
    button.addEventListener("blur", () => {
      button.style.outline = "none";
    });
    return button;
  };

  actions.append(createAction("Sort ₹/g", sortByPerGram));

  const moreTools = document.createElement("details");
  moreTools.id = "blinkdeal-more-tools";
  Object.assign(moreTools.style, {
    marginTop: "7px",
  });

  const moreToolsSummary = document.createElement("summary");
  moreToolsSummary.textContent = "More tools";
  Object.assign(moreToolsSummary.style, {
    color: "#bcefd3",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: "700",
    userSelect: "none",
  });

  const moreToolsContent = document.createElement("div");
  Object.assign(moreToolsContent.style, {
    display: "grid",
    gap: "7px",
    marginTop: "7px",
  });

  const manualRate = createAction("Set market rate", promptMarketRate, true);
  const loadAllProducts = createAction("Load all pages", loadAllListingProducts);
  loadAllProducts.id = "blinkdeal-load-all-products";

  const filterPanelToggle = createAction("Show filters", toggleFilterPanel);
  filterPanelToggle.id = "blinkdeal-filter-panel-toggle";
  moreToolsContent.append(manualRate, loadAllProducts, filterPanelToggle);

  const filterLabel = document.createElement("div");
  filterLabel.textContent = "Show purity";
  Object.assign(filterLabel.style, {
    marginTop: "10px",
    color: "#bcefd3",
    fontSize: "11px",
    fontWeight: "700",
  });

  const filters = document.createElement("div");
  filters.setAttribute("role", "group");
  filters.setAttribute("aria-label", "Filter products by gold purity");
  Object.assign(filters.style, {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "5px",
    marginTop: "6px",
  });

  [
    ["all", "All"],
    ["24KT", "24KT"],
    ["22KT", "22KT"],
  ].forEach(([filter, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.blinkdealFilter = filter;
    button.textContent = label;
    button.addEventListener("click", () => setPurityFilter(filter));
    Object.assign(button.style, {
      boxSizing: "border-box",
      minWidth: "0",
      padding: "7px 3px",
      border: "1px solid #77c7a0",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "11px",
      fontWeight: "700",
    });
    filters.appendChild(button);
  });

  moreTools.append(moreToolsSummary, moreToolsContent);

  dock.append(
    header,
    rateInfo,
    discountLabel,
    discounts,
    customDiscountEditor,
    actions,
    filterLabel,
    filters,
    moreTools,
  );
  document.body.appendChild(dock);
  updateToolsDock();
  updateLiveRateControl();
  updateDiscountDock();
  updatePurityFilterDock();
  updateFilterPanelControl();
  updateLoadAllProductsControl(null, false);
}

//--------------------------------------
// 🔽 Sort by ₹/gm
//--------------------------------------
function sortByPerGram() {
  const cards = Array.from(
    document.querySelectorAll("li, .product-base, .product, article"),
  ).filter(
    (card) => card.dataset.perGram && card.dataset.perGram !== "Infinity",
  );

  const parsed = cards.map((card) => ({
    card,
    perGram: parseFloat(card.dataset.perGram || "Infinity"),
  }));

  parsed.sort((a, b) => a.perGram - b.perGram);

  const container =
    document.querySelector(
      "ul.results-base, .grid-base, .results-base, .search-results",
    ) || cards[0]?.parentElement;

  if (container) parsed.forEach(({ card }) => container.appendChild(card));
}

//--------------------------------------
// 🚀 Init
//--------------------------------------
window.addEventListener("load", () => {
  initializeCouponMonitorBanner();
  const savedRate = parseMarketRate(localStorage.getItem("myntra_market_rate"));
  const savedSource = localStorage.getItem("myntra_market_rate_source");
  if (savedRate !== null) {
    MARKET_RATE = savedRate;
    MARKET_RATE_SOURCE = savedSource
      ? normalizeMarketRateSource(savedSource)
      : "manual";
  } else {
    MARKET_RATE_SOURCE = normalizeMarketRateSource(savedSource);
  }

  if (MARKET_RATE_SOURCE === "manual") {
    MARKET_RATE_LIVE_STATUS = "manual";
  } else {
    applyCachedMalabarRate();
    refreshMalabarMarketRate();
  }
  const savedDiscount = parseDiscountPercent(
    localStorage.getItem("myntra_blinkdeal_discount_percent"),
  );
  if (savedDiscount !== null) BLINKDEAL_DISCOUNT_PERCENT = savedDiscount;
  const savedFilterPanel = localStorage.getItem(
    "myntra_blinkdeal_filter_panel_hidden",
  );
  if (savedFilterPanel !== null) {
    FILTER_PANEL_HIDDEN = savedFilterPanel === "true";
  }
  refreshData();
  setTimeout(createButtons, 3000);
});
