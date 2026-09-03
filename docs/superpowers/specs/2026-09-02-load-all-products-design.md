# Load All Gold Coin Products

## Goal

Let a user turn Myntra's paginated gold-coin listing into one in-page grid so Blinkdeal analysis and ₹/g sorting cover every available product.

## Scope

- Applies only to Myntra gold-coin listing pages, never PDPs.
- Adds an explicit `Load all 336 products` action to Gold Deal Tools.
- Keeps the current page-one product cards and loads the remaining pages through same-origin requests.
- Preserves existing discount, market-rate, purity-filter, best-deal, hidden-filter, and brand-exclusion behavior.

## Data flow

1. Read the total page count from Myntra's pagination metadata (`Page 1 of 7`).
2. Build the remaining page URLs from the current listing URL using its `p` query parameter.
3. Fetch pages 2 through the final page in small batches.
4. Parse each response with `DOMParser`; extract `li.product-base` entries only.
5. De-duplicate products by Myntra's product-card `id` before appending to `ul.results-base`.
6. Run the existing card injection pipeline on each appended batch.
7. Recalculate the best ₹/g badges when all pages have loaded.

## User experience

- The action starts as `Load all 336 products`.
- During loading it shows `Loading page N of M…` and is disabled to prevent concurrent runs.
- Existing page-one products remain interactive while more pages are appended.
- Original Myntra pagination remains available until every page has loaded.
- On success, hide the original pagination and show `All 336 products loaded` in the action.
- On a failed page, stop loading, restore the action, keep the original pagination visible, and report the failed page number.

## Error handling and limits

- Reject non-OK responses and malformed responses without appending partial cards from that page.
- Ignore duplicate or missing product-card IDs.
- Do not retry automatically; the user can start the action again after a failure.
- Do not fetch on PDPs or non-gold-coin Myntra pages.

## Verification

- Unit-test page-count extraction, page-URL generation, and product-ID de-duplication.
- Verify the existing pricing tests still pass.
- Validate that `content.js` parses and `manifest.json` remains valid JSON.
- Manually verify a complete 7-page load, a duplicate-free grid, cross-page lowest-₹/g sorting, and failure fallback with original pagination retained.
