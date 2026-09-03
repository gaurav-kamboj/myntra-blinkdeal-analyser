# Myntra Blinkdeal Analyser

A Chrome extension for comparing Myntra gold-coin listings. It calculates a configurable Blinkdeal price, derives an effective ₹/g value when a product weight is known, and compares it with the latest Malabar 24K market rate or a rate you enter.

> This independent open-source project is for educational and personal use. It is not affiliated with, endorsed by, or connected to Myntra, Blinkdeal, or their parent entities. Product names, logos, and trademarks belong to their respective owners. Preferences are stored locally; live-rate mode requests the latest Malabar rate from `gold.liverate.in`.

## Features

| Feature | What it does |
| --- | --- |
| Configurable Blinkdeal discount | Choose 6%, 8% (default), or enter a custom discount. Every Blinkdeal price and ₹/g value recalculates immediately. |
| ₹/g calculation | Uses the stated product weight to show the discounted effective price per gram. When no reliable weight is available, it explicitly shows **Weight unavailable · ₹/g pending** rather than assuming 1 g. |
| Purity-aware comparison | Detects 22KT, 23KT, and 24KT products and adjusts the entered 24KT market rate for the purity before comparing. |
| Deal classification | Labels comparable products as Steal deal, Fair buy, Premium, or Overpriced, with the exact percentage above or below the market rate. |
| Best ₹/g badge | Highlights the lowest confirmed ₹/g product for each purity. |
| Gold Deal Tools dock | Provides market-rate entry, discount selection, ₹/g sorting, purity filters, loading controls, and a filter-panel toggle in one compact dock. |
| Purity filters and sorting | Filter to All, 24KT, or 22KT products, and sort the visible listing by the lowest known ₹/g. |
| Live Malabar 24K rate | Loads Malabar Gold & Diamonds' latest 24K rate on startup and caches the last successful value for a temporary API outage. |
| Manual rate override | **Set market rate** always wins over the live rate until **Use live Malabar rate** is selected again. |
| Load all products | Fetches Myntra’s paginated listing pages into one grid so comparison and sorting can operate across the full result set. Original pagination remains available if a page fails to load. |
| PDP support | Adds the same Blinkdeal analysis above **Add to Bag** on gold-coin product-detail pages, using product details and title fallbacks for purity and weight. |
| Broad gold-coin route support | Works on standard and brand/weight-specific listing paths such as `/gold-coin`, `/kalyan-gold-coin`, `/malabar-gold-coin`, and `/gold-coin-1g`. |
| Listing cleanup | Can hide Myntra’s built-in filter panels to fit more products, hides the Izooto floating bell, and excludes PARSHWA PADMAVATI GOLD cards. |
| Persistent settings | Saves the market rate, Blinkdeal discount, and filter-panel preference in `localStorage`. |
| MMTC notice | Marks MMTC/MMTC-PAMP products as not applicable for Blinkdeal analysis. |

## How the comparison works

1. The latest Malabar 24KT market rate is loaded automatically; use **Set market rate** only when you want a manual override.
2. Select the Blinkdeal discount (6%, 8%, or a custom value).
3. For a product with a confirmed weight, the extension calculates:

   `Blinkdeal price = listing price × (1 − discount%)`

   `Effective ₹/g = Blinkdeal price ÷ weight in grams`

4. The effective ₹/g is compared with the purity-adjusted market rate:

| Difference vs. market | Label |
| --- | --- |
| ≤ −3% | Steal deal |
| > −3% and < 0% | Fair buy |
| > 0% and < 3% | Premium |
| ≥ 3% | Overpriced |

Products without a reliable stated weight are never assigned an assumed weight or used for the Best ₹/g badge.

## Install in Chrome (Developer Mode)

1. Clone the repository:

   ```bash
   git clone https://github.com/gaurav-kamboj/myntra-blinkdeal-analyser.git
   ```

2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose the cloned repository folder.
5. Reload the extension after pulling new changes.

## Use it

1. Open a Myntra gold-coin listing or product page.
2. Check the live-rate status; choose **Set market rate** only to override it, or **Use live Malabar rate** to resume automatic updates.
3. Select the discount rate you expect Blinkdeal to apply.
4. Optionally choose a purity filter, hide Myntra’s filters, or select **Sort lowest ₹/g**.
5. On a paginated listing, choose **Load all _N_ products** to bring every page into the current grid before sorting.

## Project structure

```text
myntra-blinkdeal-analyser/
├── manifest.json       # Chrome Extension Manifest V3
├── background.js       # Retrieves the permitted live Malabar rate
├── content.js          # Listing, PDP, comparison, and dock behavior
├── test-content.js     # Lightweight JXA regression tests
├── test-background.js  # Background-worker contract test
├── icon128.png         # Extension icon
├── README.md
└── LICENSE
```

## Tech stack

- Vanilla JavaScript
- Chrome Extensions Manifest V3
- Extension service worker for the live-rate request
- Browser DOM APIs and same-origin Myntra page fetches
- `localStorage`
