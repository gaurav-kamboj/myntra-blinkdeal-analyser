# Load All Gold Coin Products Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load every paginated Myntra gold-coin listing into one grid so Blinkdeal sorting and deal badges work across all products.

**Architecture:** Keep the existing page-one grid in place. A loader in `content.js` derives `?p=N` URLs from the current listing, fetches and parses each document, appends only unique `li.product-base` cards to `ul.results-base`, and runs the existing injection pipeline after each batch. The dock action owns progress and error state; Myntra pagination is hidden only after a complete successful load.

**Tech Stack:** Manifest V3 content script, vanilla JavaScript, browser `fetch`, `DOMParser`, local DOM manipulation, JXA regression test harness.

**Spec:** `docs/superpowers/specs/2026-09-02-load-all-products-design.md`

## Global Constraints

- Run only on `/gold-coin` listing pages; never fetch from or modify PDP pagination.
- Preserve all current Blinkdeal discount, market-rate, purity, best-deal, hidden-filter, and brand-exclusion behavior.
- Fetch only same-origin Myntra pages using the current listing URL and `p` query parameter.
- Do not automatically retry a failed page; retain Myntra pagination and show the failed page in the dock action.
- This workspace is not a Git repository, so do not create commits.

---

## File Structure

- `content.js` — pagination helpers, page loader, dock action, and pagination visibility state.
- `test-content.js` — pure-helper regression tests that run with `osascript -l JavaScript test-content.js`.
- `docs/superpowers/specs/2026-09-02-load-all-products-design.md` — approved behavior contract.
- `docs/superpowers/plans/2026-09-02-load-all-products.md` — this execution plan.

### Task 1: Pagination metadata and URL helpers

**Files:**
- Modify: `content.js` near existing page helpers.
- Modify: `test-content.js` near the existing pure-helper extraction and assertions.

**Interfaces:**
- Produces `getTotalListingPages(text): number | null`.
- Produces `getListingTotalCount(text): number | null`.
- Produces `buildListingPageUrl(currentUrl, pageNumber): string`.
- Produces `getUniqueProductCards(existingIds, cards): Element[]`.

- [x] **Step 1: Write the failing tests**

```javascript
assertEqual(getTotalListingPages("Page 1 of 7"), 7, "pagination metadata returns total pages");
assertEqual(getTotalListingPages("No pagination"), null, "missing pagination is unavailable");
assertEqual(getListingTotalCount("Gold Coin - 336 items"), 336, "listing summary returns product count");
assertEqual(
  buildListingPageUrl("https://www.myntra.com/gold-coin?rawQuery=gold%20coin", 2),
  "https://www.myntra.com/gold-coin?rawQuery=gold+coin&p=2",
  "page URL preserves the current listing query",
);
```

- [x] **Step 2: Run the regression harness and verify it fails**

Run: `osascript -l JavaScript test-content.js`

Expected: failure reporting a missing pagination helper.

- [x] **Step 3: Implement the helpers**

```javascript
function getTotalListingPages(text) {
  const match = String(text).match(/page\s+\d+\s+of\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

function getListingTotalCount(text) {
  const match = String(text).match(/gold coin\s*-\s*(\d+)\s+items/i);
  return match ? parseInt(match[1], 10) : null;
}

function buildListingPageUrl(currentUrl, pageNumber) {
  const url = new URL(currentUrl);
  url.searchParams.set("p", String(pageNumber));
  return url.toString();
}

function getUniqueProductCards(existingIds, cards) {
  return Array.from(cards).filter((card) => {
    const productId = card.id;
    if (!productId || existingIds.has(productId)) return false;
    existingIds.add(productId);
    return true;
  });
}
```

- [x] **Step 4: Run the regression harness and verify it passes**

Run: `osascript -l JavaScript test-content.js`

Expected: `test-content.js: all tests passed`.

- [x] **Step 5: Do not commit**

The workspace has no `.git` directory; leave the tested edits uncommitted.

### Task 2: Fetch, parse, append, and analyze every listing page

**Files:**
- Modify: `content.js` near `refreshData` and `injectDiscountLabels`.
- Modify: `test-content.js` for the pure duplicate-selection helper.

**Interfaces:**
- Consumes `getTotalListingPages`, `buildListingPageUrl`, and `getUniqueProductCards` from Task 1.
- Produces `loadAllListingProducts(): Promise<void>`.
- Produces `setPaginationVisibility(hidden): void`.
- Consumes existing `injectDiscountLabels()` and `updateBestDealBadges()`.

- [x] **Step 1: Write the failing duplicate-selection test**

```javascript
const uniqueCards = getUniqueProductCards(
  new Set(["101"]),
  [{ id: "101" }, { id: "102" }, { id: "102" }, { id: "" }],
);
assertEqual(uniqueCards.length, 1, "only unseen cards with a product ID are appended");
assertEqual(uniqueCards[0].id, "102", "the first unseen product is retained");
```

- [x] **Step 2: Run the regression harness and verify it fails**

Run: `osascript -l JavaScript test-content.js`

Expected: failure because the duplicate-selection behavior is missing or incomplete.

- [x] **Step 3: Implement loader state and DOM operations**

```javascript
let LOAD_ALL_PRODUCTS_RUNNING = false;

function setPaginationVisibility(hidden) {
  document.querySelectorAll(".pagination-container").forEach((pagination) => {
    pagination.style.display = hidden ? "none" : "";
  });
}

async function loadAllListingProducts() {
  if (LOAD_ALL_PRODUCTS_RUNNING || !isGoldCoinPage() || isProductDetailPage()) return;

  const container = document.querySelector("ul.results-base");
  const totalPages = getTotalListingPages(
    document.querySelector(".pagination-container")?.innerText || "",
  );
  if (!container || !totalPages || totalPages < 2) return;

  LOAD_ALL_PRODUCTS_RUNNING = true;
  const knownIds = new Set(
    Array.from(container.querySelectorAll("li.product-base"))
      .map((card) => card.id)
      .filter(Boolean),
  );

  try {
    for (let page = 2; page <= totalPages; page += 1) {
      updateLoadAllProductsControl(null, true, { page, totalPages });
      const response = await fetch(buildListingPageUrl(location.href, page));
      if (!response.ok) throw new Error(`Page ${page} failed`);

      const parsed = new DOMParser().parseFromString(
        await response.text(),
        "text/html",
      );
      const cards = getUniqueProductCards(
        knownIds,
        parsed.querySelectorAll("li.product-base"),
      );
      cards.forEach((card) => container.appendChild(document.importNode(card, true)));
      injectDiscountLabels();
    }
    updateBestDealBadges();
    setPaginationVisibility(true);
    updateLoadAllProductsControl("All products loaded", true);
  } catch (error) {
    setPaginationVisibility(false);
    updateLoadAllProductsControl(error.message, false);
  } finally {
    LOAD_ALL_PRODUCTS_RUNNING = false;
  }
}
```

Fetch one page at a time to avoid burst-loading Myntra. Parse each response with `new DOMParser().parseFromString(html, "text/html")`, select `li.product-base`, and append document-imported cards using `document.importNode(card, true)`. Keep pagination visible until all pages complete successfully.

- [x] **Step 4: Run the regression harness and verify it passes**

Run: `osascript -l JavaScript test-content.js`

Expected: `test-content.js: all tests passed`.

- [x] **Step 5: Do not commit**

The workspace has no `.git` directory; leave the tested edits uncommitted.

### Task 3: Add loader UI and failure-safe pagination behavior

**Files:**
- Modify: `content.js` inside `createButtons` and existing dock update functions.

**Interfaces:**
- Consumes `loadAllListingProducts()` and `setPaginationVisibility()` from Task 2.
- Produces `updateLoadAllProductsControl(message, disabled): void`.
- Consumes the existing `createAction` dock helper.

- [x] **Step 1: Write the failing control-state test**

```javascript
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
```

- [x] **Step 2: Run the regression harness and verify it fails**

Run: `osascript -l JavaScript test-content.js`

Expected: failure reporting a missing loader-label helper.

- [x] **Step 3: Implement the dock action**

```javascript
const loadAllAction = createAction("Load all 336 products", loadAllListingProducts, true);
loadAllAction.id = "blinkdeal-load-all-products";
actions.append(loadAllAction);
```

```javascript
function getLoadAllProductsLabel(totalCount, progress) {
  if (!progress) return `Load all ${totalCount} products`;
  return `Loading page ${progress.page} of ${progress.totalPages}…`;
}

function updateLoadAllProductsControl(message, disabled, progress = null) {
  const action = document.querySelector("#blinkdeal-load-all-products");
  if (!action) return;
  action.style.display = isGoldCoinPage() && !isProductDetailPage() ? "block" : "none";
  action.disabled = disabled;
  action.textContent = message || getLoadAllProductsLabel(
    getListingTotalCount(document.body?.innerText || ""),
    progress,
  );
}
```

- [x] **Step 4: Run full validation**

Run:

```bash
osascript -l JavaScript test-content.js
osascript -l JavaScript -e 'ObjC.import("Foundation"); const data=$.NSData.dataWithContentsOfFile("content.js"); const source=ObjC.unwrap($.NSString.alloc.initWithDataEncoding(data,$.NSUTF8StringEncoding)); globalThis.window={addEventListener:function(){}, location:{pathname:"/gold-coin"}}; eval(source); console.log("content.js parses")'
python3 -c 'import json; json.load(open("manifest.json")); print("manifest.json valid")'
```

Expected: tests pass, `content.js parses`, and `manifest.json valid`.

- [ ] **Step 5: Manually verify in Chrome**

1. Reload the unpacked extension.
2. Open `https://www.myntra.com/gold-coin?rawQuery=gold%20coin`.
3. Click `Load all 336 products`.
4. Confirm progress advances from page 2 through page 7 without navigating away.
5. Confirm original pagination disappears only after success.
6. Click `Sort lowest ₹/g` and confirm cards from later pages participate.
7. Use DevTools offline mode before a remaining page loads; confirm the action reports the failed page and the original pagination remains visible.

- [x] **Step 6: Do not commit**

The workspace has no `.git` directory; leave the tested edits uncommitted.
