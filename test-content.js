// Lightweight regression tests runnable with: osascript -l JavaScript test-content.js
// They exercise pure calculation helpers without requiring a browser DOM.

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

function assertClose(actual, expected, message) {
  if (Math.abs(actual - expected) > 0.000001) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

const source = readFile("content.js");
const discountHelperMatch = source.match(
  /function calculateDiscountedPrice\(price, discountPercent = 8\) \{[\s\S]*?\n\}/,
);
const perGramHelperMatch = source.match(
  /function calculatePerGram\(price, weight, discountPercent = 8\) \{[\s\S]*?\n\}/,
);
const discountPercentHelperMatch = source.match(
  /function parseDiscountPercent\(value\) \{[\s\S]*?\n\}/,
);
const numberHelperMatch = source.match(
  /function extractNumber\(priceText\) \{[\s\S]*?\n\}/,
);
const marketRateHelperMatch = source.match(
  /function parseMarketRate\(value\) \{[\s\S]*?\n\}/,
);
const purityFilterHelperMatch = source.match(
  /function matchesPurityFilter\(purity, filter\) \{[\s\S]*?\n\}/,
);
const weightRetryHelperMatch = source.match(
  /function shouldRetryWeightDetection\(weight\) \{[\s\S]*?\n\}/,
);
const dockControlStyleHelperMatch = source.match(
  /function getFullWidthControlStyles\(\) \{[\s\S]*?\n\}/,
);
const myntraBellHelperMatch = source.match(
  /function isMyntraBellClass\(className\) \{[\s\S]*?\n\}/,
);
const hiddenBrandHelperMatch = source.match(
  /function isHiddenBrand\(text\) \{[\s\S]*?\n\}/,
);
const dealStatusHelperMatch = source.match(
  /function getDealStatus\(diffPct\) \{[\s\S]*?\n\}/,
);
const comparisonPercentHelperMatch = source.match(
  /function formatComparisonPercent\(diffPct\) \{[\s\S]*?\n\}/,
);
const bestDealHelperMatch = source.match(
  /function findBestPerGramByPurity\(products\) \{[\s\S]*?\n\}/,
);
const purityDetectionHelperMatch = source.match(
  /function detectGoldPurity\(text\) \{[\s\S]*?\n\}/,
);
const pdpPurityHelperMatch = source.match(
  /function getPdpPurity\(documentText\) \{[\s\S]*?\n\}/,
);
const pdpWeightHelperMatch = source.match(
  /function getPdpWeight\(documentText\) \{[\s\S]*?\n\}/,
);
const pdpPriceHelperMatch = source.match(
  /function getPdpPrice\(priceText\) \{[\s\S]*?\n\}/,
);
const pdpPurityFallbackHelperMatch = source.match(
  /function getPdpPurityWithTitleFallback\(detailsText, titleText\) \{[\s\S]*?\n\}/,
);
const pdpWeightFallbackHelperMatch = source.match(
  /function getPdpWeightWithTitleFallback\(detailsText, titleText\) \{[\s\S]*?\n\}/,
);
const filterPanelVisibilityHelperMatch = source.match(
  /function setFilterPanelVisibility\(hidden, root = document\) \{[\s\S]*?\n\}/,
);
const totalListingPagesHelperMatch = source.match(
  /function getTotalListingPages\(text\) \{[\s\S]*?\n\}/,
);
const listingTotalCountHelperMatch = source.match(
  /function getListingTotalCount\(text\) \{[\s\S]*?\n\}/,
);
const listingPageUrlHelperMatch = source.match(
  /function buildListingPageUrl\(currentUrl, pageNumber, canonicalUrl = ""\) \{[\s\S]*?\n\}/,
);
const uniqueProductCardsHelperMatch = source.match(
  /function getUniqueProductCards\(existingIds, cards\) \{[\s\S]*?\n\}/,
);
const loadAllProductsLabelHelperMatch = source.match(
  /function getLoadAllProductsLabel\(totalCount, progress\) \{[\s\S]*?\n\}/,
);
const goldCoinRouteHelperMatch = source.match(
  /function isGoldCoinPage\(pathname = window\.location\.pathname\) \{[\s\S]*?\n\}/,
);

if (
  !discountHelperMatch ||
  !perGramHelperMatch ||
  !discountPercentHelperMatch ||
  !numberHelperMatch ||
  !marketRateHelperMatch ||
  !purityFilterHelperMatch ||
  !weightRetryHelperMatch ||
  !dockControlStyleHelperMatch ||
  !myntraBellHelperMatch ||
  !hiddenBrandHelperMatch ||
  !dealStatusHelperMatch ||
  !comparisonPercentHelperMatch ||
  !bestDealHelperMatch ||
  !purityDetectionHelperMatch ||
  !pdpPurityHelperMatch ||
  !pdpWeightHelperMatch ||
  !pdpPriceHelperMatch ||
  !pdpPurityFallbackHelperMatch ||
  !pdpWeightFallbackHelperMatch ||
  !filterPanelVisibilityHelperMatch ||
  !totalListingPagesHelperMatch ||
  !listingTotalCountHelperMatch ||
  !listingPageUrlHelperMatch ||
  !uniqueProductCardsHelperMatch ||
  !loadAllProductsLabelHelperMatch ||
  !goldCoinRouteHelperMatch
) {
  throw new Error("required pricing helper is missing");
}

eval(discountHelperMatch[0]);
eval(perGramHelperMatch[0]);
eval(discountPercentHelperMatch[0]);
eval(numberHelperMatch[0]);
eval(marketRateHelperMatch[0]);
eval(purityFilterHelperMatch[0]);
eval(weightRetryHelperMatch[0]);
eval(dockControlStyleHelperMatch[0]);
eval(myntraBellHelperMatch[0]);
eval(hiddenBrandHelperMatch[0]);
eval(dealStatusHelperMatch[0]);
eval(comparisonPercentHelperMatch[0]);
eval(bestDealHelperMatch[0]);
eval(purityDetectionHelperMatch[0]);
eval(pdpPurityHelperMatch[0]);
eval(pdpWeightHelperMatch[0]);
eval(pdpPriceHelperMatch[0]);
eval(pdpPurityFallbackHelperMatch[0]);
eval(pdpWeightFallbackHelperMatch[0]);
eval(filterPanelVisibilityHelperMatch[0]);
eval(totalListingPagesHelperMatch[0]);
eval(listingTotalCountHelperMatch[0]);
eval(listingPageUrlHelperMatch[0]);
eval(uniqueProductCardsHelperMatch[0]);
eval(loadAllProductsLabelHelperMatch[0]);
eval(goldCoinRouteHelperMatch[0]);

assertEqual(calculatePerGram(16520, null), null, "unknown weight is unavailable");
assertEqual(calculatePerGram(16520, 0), null, "zero weight is unavailable");
assertClose(
  calculatePerGram(16520, 1),
  15198.4,
  "known weight calculates discounted price per gram",
);
assertEqual(calculateDiscountedPrice(1000, 6), 940, "6% discount is applied");
assertEqual(calculatePerGram(1000, 2, 6), 470, "6% discount updates price per gram");
assertEqual(parseDiscountPercent("8"), 8, "8% discount is accepted");
assertEqual(parseDiscountPercent("6.5"), 6.5, "custom decimal discount is accepted");
assertEqual(parseDiscountPercent("100"), null, "100% discount is rejected");
assertEqual(parseMarketRate("14,850"), 14850, "formatted market rate is accepted");
assertEqual(parseMarketRate("0"), null, "zero market rate is rejected");
assertEqual(parseMarketRate("gold"), null, "text market rate is rejected");
assertEqual(matchesPurityFilter("24KT", "all"), true, "all filter keeps 24KT");
assertEqual(matchesPurityFilter("24KT", "24KT"), true, "24KT filter keeps 24KT");
assertEqual(matchesPurityFilter("22KT", "24KT"), false, "24KT filter hides 22KT");
assertEqual(
  detectGoldPurity("Metal Purity: 22 KT"),
  "22KT",
  "PDP metal-purity details identify 22KT",
);
assertEqual(
  detectGoldPurity("Joyalukkas St.Mary Gold Coin - 1gm"),
  null,
  "a listing without stated purity remains unavailable",
);
assertEqual(
  detectGoldPurity("24KT Gold Bar - 1gm"),
  "24KT",
  "explicit listing purity is retained",
);
assertEqual(
  getPdpPurity("Product Details\nMetal: Gold\nMetal Purity: 22 KT\nMetal Weight (Net) in grams: 1 gms"),
  "22KT",
  "PDP details provide purity even when the price card does not",
);
assertEqual(
  getPdpWeight("Metal Weight (Net) in grams: 1 gms\nTotal Weight (Gross Weight) in grams: 1 gms"),
  1,
  "PDP uses the stated net metal weight rather than adding all page weights",
);
assertEqual(
  getPdpPrice("₹15686 MRP ₹16687 (6% OFF) inclusive of all taxes"),
  15686,
  "PDP price extraction uses the leading selling price rather than the MRP or tax text",
);
assertEqual(
  getPdpPurityWithTitleFallback("", "PNG Logo Design 24KT (995) Gold Coin- 10 gm"),
  "24KT",
  "PDP falls back to the product title when details have not loaded",
);
assertEqual(
  getPdpWeightWithTitleFallback("", "PNG Logo Design 24KT (995) Gold Coin- 10 gm"),
  10,
  "PDP uses the title weight when its net-weight detail is unavailable",
);
const filterPanels = [
  { style: { display: "", setProperty(name, value) { this[name] = value; }, removeProperty(name) { this[name] = ""; } } },
  { style: { display: "", setProperty(name, value) { this[name] = value; }, removeProperty(name) { this[name] = ""; } } },
];
let filterPanelSelector = "";
const filterRoot = {
  querySelectorAll(selector) {
    filterPanelSelector = selector;
    return filterPanels;
  },
};
setFilterPanelVisibility(true, filterRoot);
assertEqual(filterPanels[0].style.display, "none", "hiding filters removes the left panel from layout");
assertEqual(
  filterPanelSelector,
  ".search-leftContainer, .horizontal-filters-base",
  "hiding filters includes the top dropdown and sort strip",
);
setFilterPanelVisibility(false, filterRoot);
assertEqual(filterPanels[1].style.display, "", "showing filters restores the left panel");
assertEqual(getTotalListingPages("Page 1 of 7"), 7, "listing pagination finds its final page");
assertEqual(getTotalListingPages("No pagination"), null, "missing pagination remains unavailable");
assertEqual(
  getListingTotalCount("Gold Coin - 336 items"),
  336,
  "listing title provides the total product count",
);
assertEqual(
  buildListingPageUrl(
    "https://www.myntra.com/gold-coin?rawQuery=gold%20coin",
    2,
  ),
  "https://www.myntra.com/gold-coin?rawQuery=gold%20coin&p=2",
  "listing page URL preserves the existing query and sets the target page",
);
assertEqual(
  buildListingPageUrl(
    "https://www.myntra.com/gold-coin?rawQuery=gold%20coin",
    2,
    "https://www.myntra.com/gold-coin",
  ),
  "https://www.myntra.com/gold-coin?p=2",
  "listing pagination follows Myntra's canonical page base instead of repeating rawQuery",
);
const uniqueCards = getUniqueProductCards(
  new Set(["101"]),
  [{ id: "101" }, { id: "102" }, { id: "102" }, { id: "" }],
);
assertEqual(
  uniqueCards.length,
  1,
  "only unseen cards with a product ID are appended",
);
assertEqual(uniqueCards[0].id, "102", "the first unseen product is retained");
assertEqual(
  getLoadAllProductsLabel(336, null),
  "Load all 336 products",
  "idle loader label includes the total product count",
);
assertEqual(
  getLoadAllProductsLabel(336, { page: 4, totalPages: 7 }),
  "Loading page 4 of 7…",
  "loader label reports progress",
);
assertEqual(
  isGoldCoinPage("/gold-coin"),
  true,
  "standard gold-coin listings are recognized",
);
assertEqual(
  isGoldCoinPage("/kalyan-gold-coin"),
  true,
  "brand gold-coin listings are recognized",
);
assertEqual(
  isGoldCoinPage("/malabar-gold-coin"),
  true,
  "other brand gold-coin listings are recognized",
);
assertEqual(
  isGoldCoinPage("/gold-coin-1g"),
  true,
  "weight-specific gold-coin listings are recognized",
);
assertEqual(
  isGoldCoinPage("/gold-rings"),
  false,
  "non-coin gold listings remain excluded",
);
assertEqual(shouldRetryWeightDetection(null), true, "missing weight is retried");
assertEqual(shouldRetryWeightDetection(1), false, "known weight is not retried");
assertEqual(
  getFullWidthControlStyles().boxSizing,
  "border-box",
  "full-width controls include padding within their width",
);
assertEqual(
  getFullWidthControlStyles().maxWidth,
  "100%",
  "full-width controls cannot exceed their dock",
);
assertEqual(
  isMyntraBellClass("iz-news-hub-bell"),
  true,
  "Myntra's floating bell is identified",
);
assertEqual(
  isMyntraBellClass("iz-news-hub-bell-group"),
  false,
  "nested bell artwork is not mistaken for the widget",
);
assertEqual(
  isHiddenBrand("PARSHWA PADMAVATI GOLD Gold Coin - 1gm"),
  true,
  "target brand is hidden",
);
assertEqual(isHiddenBrand("BHIMA 24KT Gold Bar"), false, "other brands remain visible");
assertEqual(getDealStatus(-3).label, "Steal deal", "strong discount is a steal deal");
assertEqual(getDealStatus(1).label, "Premium", "small premium is marked clearly");
assertEqual(getDealStatus(3).label, "Overpriced", "large premium is marked overpriced");
assertEqual(formatComparisonPercent(1.24), "1.2% above", "premium percentage is compact");
assertEqual(formatComparisonPercent(-2), "2.0% below", "discount percentage is compact");
const bestDeals = findBestPerGramByPurity([
  { id: "24-expensive", purity: "24KT", perGram: 15198 },
  { id: "24-best", purity: "24KT", perGram: 14932 },
  { id: "22-best", purity: "22KT", perGram: 13611 },
  { id: "22-expensive", purity: "22KT", perGram: 13900 },
  { id: "unknown", purity: "24KT", perGram: null },
]);
assertEqual(bestDeals["24KT"].id, "24-best", "lowest valid 24KT price is selected");
assertEqual(bestDeals["22KT"].id, "22-best", "lowest valid 22KT price is selected");

console.log("test-content.js: all tests passed");
