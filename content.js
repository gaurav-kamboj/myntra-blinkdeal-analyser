//--------------------------------------
// 🪙 Blinkdeal + ₹/g + Market Comparison (Persistent)
//--------------------------------------

let MARKET_RATE = null;

// Helper to format INR
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

function detectWeight(card) {
  const text = card.innerText.toLowerCase();
  const matches = text.match(/(\d+(?:\.\d+)?)\s*(?:g|gm)/g);
  if (!matches) return null;
  const equalMatch = text.match(/=\s*(\d+(?:\.\d+)?)\s*(?:g|gm)/);
  if (equalMatch) return parseFloat(equalMatch[1]);
  let total = 0;
  matches.forEach((m) => {
    const val = parseFloat(m);
    if (!isNaN(val)) total += val;
  });
  if (total > 50) total = Math.max(...matches.map((m) => parseFloat(m)));
  return total;
}

//--------------------------------------
// 🧮 Inject Blinkdeal + Market Compare
//--------------------------------------
function injectDiscountLabels() {
  const productCards = document.querySelectorAll(
    "li, .product-base, .product, article",
  );
  productCards.forEach((card) => {
    if (card.dataset.blinkdealInjected) return;

    const titleText = card.innerText.toLowerCase();

    // 🟥 Exclude MMTC items
    if (titleText.includes("mmtc")) {
      const redNotice = document.createElement("div");
      redNotice.textContent = "BLINKDEAL not applicable";
      redNotice.style.color = "#cc0000";
      redNotice.style.fontWeight = "600";
      redNotice.style.fontSize = "13px";
      redNotice.style.marginTop = "6px";
      redNotice.style.background = "#ffeaea";
      redNotice.style.borderRadius = "6px";
      redNotice.style.display = "inline-block";
      redNotice.style.padding = "4px 8px";
      const priceEl = card.querySelector("p, span, div");
      if (priceEl) priceEl.insertAdjacentElement("afterend", redNotice);
      card.dataset.perGram = "Infinity";
      card.dataset.blinkdealInjected = "true";
      return;
    }

    // Find visible price
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

    // Blinkdeal info box
    const box = document.createElement("div");
    box.className = "blinkdeal-box";
    box.style.background = "#eafff3";
    box.style.borderRadius = "8px";
    box.style.padding = "6px 8px";
    box.style.marginTop = "6px";
    box.style.display = "inline-block";
    box.style.lineHeight = "18px";
    box.style.fontSize = "13px";
    box.style.fontFamily = "sans-serif";
    box.innerHTML = `
      <div style="color:#007d44; font-weight:600;">
        After Blinkdeal: ${formatPrice(discounted)}
      </div>
      <div style="color:#555; font-size:12px;">
        ≈ ${formatPrice(perGram)} per gram (${weight} g)
      </div>
    `;

    // 🔍 Compare with market rate if available
    if (MARKET_RATE) {
      const diffPct = ((perGram - MARKET_RATE) / MARKET_RATE) * 100; // +ve = costlier than market
      const status = document.createElement("div");
      status.style.marginTop = "4px";
      status.style.fontSize = "12px";
      status.style.fontWeight = "600";

      if (diffPct <= -3) {
        // ≥3% cheaper
        status.textContent = "🟩 Steal deal – Below sell rate";
        status.style.color = "#007d44"; // green
      } else if (diffPct < 0) {
        // between 0% and -3%
        status.textContent = "🟨 Fair – Below market but above sell";
        status.style.color = "#d4a017"; // yellow/gold
      } else if (diffPct > 0 && diffPct < 3) {
        // 0.01% to 2.99% above market
        status.textContent = "🟧 Slightly above market rate";
        status.style.color = "#ff7e00"; // amber/orange
      } else {
        // ≥3% costlier
        status.textContent = "🟥 Overpriced – Do not buy";
        status.style.color = "#cc0000"; // red
      }

      // Optionally show % difference
      status.title = `${diffPct.toFixed(2)}% vs market`;
      box.appendChild(status);
    }

    priceEl.insertAdjacentElement("afterend", box);
    card.dataset.perGram = perGram;
    card.dataset.blinkdealInjected = "true";
  });
}

function refreshData() {
  injectDiscountLabels();
  setInterval(injectDiscountLabels, 2500);
}

//--------------------------------------
// 💬 Prompt + Persist Market Rate
//--------------------------------------
function promptMarketRate() {
  const rate = prompt(
    "Enter current gold market rate per gram (₹):",
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
    b.style.position = "fixed";
    b.style.right = "24px";
    b.style.background = "#007d44";
    b.style.color = "#fff";
    b.style.fontSize = "13px";
    b.style.fontWeight = "600";
    b.style.padding = "10px 16px";
    b.style.border = "none";
    b.style.borderRadius = "8px";
    b.style.cursor = "pointer";
    b.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
    b.style.zIndex = "9999";
  });

  btnSort.style.bottom = "24px";
  btnRate.style.bottom = "64px";

  btnSort.addEventListener("click", sortByPerGram);
  btnRate.addEventListener("click", promptMarketRate);

  document.body.appendChild(btnSort);
  document.body.appendChild(btnRate);
}

//--------------------------------------
// 🔽 Sorting by per gram
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
  // Load saved market rate if available
  const saved = localStorage.getItem("myntra_market_rate");
  if (saved && !isNaN(saved)) {
    MARKET_RATE = parseFloat(saved);
    console.log(`📊 Loaded saved market rate: ₹${MARKET_RATE}/g`);
  }
  refreshData();
  setTimeout(createButtons, 3000);
});
