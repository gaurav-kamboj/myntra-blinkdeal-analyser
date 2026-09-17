# Private Myntra Gold Deal Monitor

## Goal

Build a private operator dashboard for Myntra gold coins. It independently collects public product data, detects verified `BLINKDEAL*` coupon windows, ranks eligible coins against selected gold reference rates, and uses the existing Chrome extension only to verify a product immediately before purchase.

The initial product is private-only. It sends no notifications and does not create a public board.

## Scope

- Cover Myntra gold coins only.
- Run a server-side collector every two minutes.
- Maintain a complete, normalized product catalogue and timestamped observations.
- Detect active BlinkDeal coupon codes and determine coupon eligibility per product.
- Present current rankings, last known-good data, collector health, and product history in an authenticated dashboard.
- Let the Chrome extension verify public product-page facts against the dashboard.

## Non-goals

- Placing orders, adding products to a cart, applying or removing coupons, or automating checkout.
- Uploading browser cookies, cart contents, addresses, account data, or any signed-in session material.
- Public access, sharing, affiliate link management, push notifications, or multi-merchant support.
- Guessing product weight, purity, or coupon eligibility when the source cannot confirm it.

## Architecture

```text
Public Myntra product/catalogue sources
                |
                v
      Collector and normalizer (two-minute cadence)
                |
                +--> snapshot validation and quarantine
                |
                v
       Product, observation, rate, and sweep history store
                |
                v
          Deal detector and ranking service
                |
                v
     Authenticated private dashboard API and web interface
                |
                v
 Existing Chrome extension verifies the currently open public PDP
```

The collector is the only component that calls Myntra. The dashboard reads only the application database and API. The extension performs local browser-page verification and does not transmit authentication material to the collector or dashboard.

## Components

### Collector

The collector retrieves public Myntra gold-coin catalogue and product data on a two-minute schedule. It extracts a canonical product ID, product URL, brand, name, image, price, MRP, stock, coupon data, weight, and purity. It records source timestamps and the source-version identifier needed to diagnose a parsing change.

It is idempotent: retrying a sweep cannot create duplicate observations or conflicting deal records.

### Validator and quarantine

Before publishing a sweep, validation checks numeric price fields, positive weight, recognized purity, and coupon shape. After the first manually accepted baseline, an accepted sweep must contain at least 70% of the prior accepted product count; a lower count is partial and does not replace the last known-good board. A listing missing reliable weight or purity remains available for audit but is quarantined from ranking.

### Deal detector

The detector recognizes a live deal only when at least three validated product coupons match `BLINKDEAL*` in the same accepted sweep. A trailing numeric value in the code, such as `BLINKDEAL6`, is the deal percentage; a non-numeric code remains `detected but unpriced` until the coupon amount can be independently verified. The detector records the code, percentage, first-seen time, last-confirmed time, eligible-product count, and status. The dashboard marks a deal stale after two missed collection windows (more than four minutes since its last accepted confirmation).

### Ranking service

For each rankable product:

```text
pay = listed price * (1 - deal discount)
metal value = selected 24K rate * purity factor * (1 - resale haircut) * grams
difference = metal value - pay
needed = 1 - (metal value / listed price)
```

Purity factors are explicit: 24K is `1.0`; 22K is `0.916`; 23K is `0.958`. Rate selection and haircut are user-controlled dashboard preferences; source observations remain unchanged.

### Dashboard

The private dashboard includes:

- A clear `OFF`, `LIVE`, or `STALE` status with coupon code, last-confirmed time, and sweep health.
- Reference-rate selection and resale-haircut control.
- Filters for brand, minimum/exact weight, purity, stock, and coupon eligibility.
- A ranked table containing listed price, calculated pay price, per-gram price, break-even discount, difference, and a direct public Myntra link.
- A product detail drawer containing source observations, price/stock/coupon history, extraction confidence, and quarantine reason where applicable.
- An operator panel showing the latest sweep, coverage counts, quarantined records, failures, and last known-good board age.

When the state is `OFF`, the dashboard shows the latest valid catalogue and hypothetical break-even calculations but never presents the selected simulated percentage as an active deal.

### Chrome extension verification

The existing extension receives a dashboard ranking for a product ID or public URL and compares it locally with the visible PDP. It reports whether price, stock, purity, weight, and coupon information agree, differ, or are unavailable. The browser session, cookies, cart data, and checkout details never leave Chrome.

## Data model

```text
Product
  productId, brand, name, productUrl, imageUrl, grams, karat

Observation
  productId, observedAt, price, mrp, stock, inStock,
  couponCode, couponAmount, bestPrice, couponEndsAt, sourceVersion

RateObservation
  merchantId, merchantName, buy24, buy22, observedAt, sourceUrl

DealRun
  code, percentage, status, startedAt, lastConfirmedAt,
  eligibleProductCount, totalProductCount

SweepRun
  startedAt, completedAt, status, productCount, acceptedCount,
  quarantinedCount, failureSummary, sourceVersion
```

Product identity is stable by Myntra product ID. Prices, stock, coupons, and rates are observations, not mutable product attributes.

## Reliability and safety

- Preserve the last known-good board after a failed or partial sweep.
- Make freshness visible wherever ranks are shown.
- Store per-product change history for price, stock, coupon, and parse failures.
- Rate-limit collection and use only public catalogue/product data in accordance with applicable source terms and technical controls.
- Require authenticated dashboard access.
- Keep browser authentication and checkout data entirely local to the extension.
- Do not publish rankings if validation indicates broadly corrupted or materially incomplete input.

## Verification

- Unit-test calculation, purity handling, coupon matching, state transitions, and stale-state rules.
- Test parser fixtures for valid product data, missing weight/purity, malformed coupon data, price changes, and stock changes.
- Test idempotent sweep writes and last-known-good fallback after a partial failure.
- Test authenticated API access and ensure unauthenticated requests expose no private history.
- Add an end-to-end fixture proving that a verified coupon-eligible product ranks correctly and that a stale sweep is visibly marked stale.
- Manually verify that extension PDP comparison does not send cookies, cart data, or checkout information to the server.

## Delivery sequence

1. Collector, normalizer, database schema, and fixture-based validation.
2. Deal detector, ranking service, and authenticated private API.
3. Private dashboard with operational health and historical product detail.
4. Extension-to-dashboard PDP verification.
