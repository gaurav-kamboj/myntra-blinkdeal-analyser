//--------------------------------------
// 🪙 Blinkdeal + ₹/g + Market Comparison (Purity-Aware + Market Rate Display)
//--------------------------------------

let MARKET_RATE = null;

//--------------------------------------
// 💰 Helpers
//--------------------------------------
function formatPrice(num) {
  return "₹" + num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function calculateDiscountedPrice(price) {
  return price * 0.92; // Blinkdeal 8% off
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

//--------------------------------------
// 🧮 Detect purity and adjust market rate
//--------------------------------------
function getAdjustedMarketRate(card) {
  const text = card.innerText.toLowerCase();
  if (
    text.includes("22kt") ||
    text.includes("22 karat") ||
    text.includes("22k")
  )
    return MARKET_RATE * 0.916;
  if (
    text.includes("23kt") ||
    text.includes("23 karat") ||
    text.includes("23k")
  )
    return MARKET_RATE * 0.958;
  return MARKET_RATE; // default 24KT
}

function getPurityLabel(card) {
  const text = card.innerText.toLowerCase();
  if (
    text.includes("22kt") ||
    text.includes("22 karat") ||
    text.includes("22k")
  )
    return "22KT";
  if (
    text.includes("23kt") ||
    text.includes("23 karat") ||
    text.includes("23k")
  )
    return "23KT";
  return "24KT";
}

function getPurityColor(purity) {
  switch (purity) {
    case "22KT":
      return "#d4a017"; // gold/yellow
    case "23KT":
      return "#ff8800"; // amber
    case "24KT":
    default:
      return "#007d44"; // green
  }
}

//--------------------------------------
// 🧾 Inject Blinkdeal + Market Compare
//--------------------------------------
function injectDiscountLabels() {
  const productCards = document.querySelectorAll(
    "li, .product-base, .product, article",
  );

  productCards.forEach((card) => {
    if (card.dataset.blinkdealInjected) return;

    const titleText = card.innerText.toLowerCase();

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

    const weight = detectWeight(card) || 1;
    const discounted = calculateDiscountedPrice(price);
    const perGram = discounted / weight;
    const purityLabel = getPurityLabel(card);
    const purityColor = getPurityColor(purityLabel);

    // 💡 Info box
    const box = document.createElement("div");
    Object.assign(box.style, {
      background: "#eafff3",
      borderRadius: "8px",
      padding: "6px 8px",
      marginTop: "6px",
      display: "inline-block",
      lineHeight: "18px",
      fontSize: "13px",
      fontFamily: "sans-serif",
    });

    // 📊 Core info
    box.innerHTML = `
      <div style="color:#007d44; font-weight:600;">
        After Blinkdeal: ${formatPrice(discounted)}
      </div>
      <div style="color:#555; font-size:12px;">
        ≈ ${formatPrice(perGram)} per gram (${weight} g)
      </div>
      <div style="margin-top:2px; font-size:12px;">
        <span style="color:${purityColor}; font-weight:600;">${purityLabel}</span> •
        Market rate: ${MARKET_RATE ? formatPrice(getAdjustedMarketRate(card)) + "/g" : "—"}
      </div>
    `;

    // 🧮 Compare with market rate (adjusted by purity)
    if (MARKET_RATE) {
      const adjustedRate = getAdjustedMarketRate(card);
      const diffPct = ((perGram - adjustedRate) / adjustedRate) * 100;
      const status = document.createElement("div");
      Object.assign(status.style, {
        marginTop: "4px",
        fontSize: "12px",
        fontWeight: "600",
      });

      if (diffPct <= -3) {
        status.textContent = "🟩 Steal deal – Below sell rate";
        status.style.color = "#007d44"; // green
      } else if (diffPct < 0) {
        status.textContent = "🟨 Fair buy – Near market rate";
        status.style.color = "#d4a017"; // gold
      } else if (diffPct > 0 && diffPct < 3) {
        status.textContent = "🟧 Premium – Above market";
        status.style.color = "#e56b00"; // amber
      } else {
        status.textContent = "🟥 Overpriced – Avoid";
        status.style.color = "#cc0000"; // red
      }

      status.title = `${diffPct.toFixed(2)}% vs adjusted ${purityLabel} market rate`;
      box.appendChild(status);
    }

    priceEl.insertAdjacentElement("afterend", box);
    card.dataset.perGram = perGram;
    card.dataset.blinkdealInjected = "true";
  });
}

//--------------------------------------
// 🔁 Continuous refresh
//--------------------------------------
function refreshData() {
  injectDiscountLabels();
  if (!window.blinkdealInterval) {
    window.blinkdealInterval = setInterval(injectDiscountLabels, 2500);
  }
}

//--------------------------------------
// 💬 Market rate input (persistent)
//--------------------------------------
function promptMarketRate() {
  const rate = prompt(
    "Enter current 24KT gold market rate per gram (₹):",
    MARKET_RATE || "12500",
  );
  if (rate && !isNaN(rate)) {
    MARKET_RATE = parseFloat(rate);
    localStorage.setItem("myntra_market_rate", MARKET_RATE);
    alert(`✅ Market rate set to ₹${MARKET_RATE}/g`);
    refreshData();
  }
}

//--------------------------------------
// ⚙️ Floating Buttons
//--------------------------------------
function createButtons() {
  const btnSort = document.createElement("button");
  btnSort.innerText = "Sort by ₹/gm ↑";
  const btnRate = document.createElement("button");
  btnRate.innerText = "Set Market Rate";

  [btnSort, btnRate].forEach((b) => {
    Object.assign(b.style, {
      position: "fixed",
      right: "24px",
      background: "#007d44",
      color: "#fff",
      fontSize: "13px",
      fontWeight: "600",
      padding: "10px 16px",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
      zIndex: "9999",
    });
  });

  btnSort.style.bottom = "24px";
  btnRate.style.bottom = "64px";

  btnSort.addEventListener("click", sortByPerGram);
  btnRate.addEventListener("click", promptMarketRate);

  document.body.appendChild(btnSort);
  document.body.appendChild(btnRate);
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
  const saved = localStorage.getItem("myntra_market_rate");
  if (saved && !isNaN(saved)) {
    MARKET_RATE = parseFloat(saved);
    console.log(`📊 Loaded saved market rate: ₹${MARKET_RATE}/g`);
  }
  refreshData();
  setTimeout(createButtons, 3000);
});
