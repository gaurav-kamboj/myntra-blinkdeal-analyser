# Private Myntra Gold Monitor Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the private monitor's working server foundation: validated Myntra observations, history in PostgreSQL, live-deal detection, ranked private JSON APIs, and a two-minute collector command.

**Architecture:** Add an isolated Python service under `server/`; it owns collection, validation, database persistence, ranking, and authenticated APIs. This first plan deliberately ends at a working private API. The operator web dashboard and the extension's PDP-verification UI are separate follow-on plans, after the API contract is proven against fixtures and live collection.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2, Alembic, PostgreSQL 16, HTTPX, Pydantic 2, pytest, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-17-private-myntra-gold-monitor-design.md`

## Global Constraints

- Collect Myntra gold-coin public catalogue/product data only; never mutate cart, coupons, orders, or checkout.
- Run one collection attempt every two minutes; reject a post-baseline sweep below 70% of the previous accepted product count.
- Quarantine, rather than rank, products without positive grams or recognized 22K, 23K, or 24K purity.
- Confirm `LIVE` only when an accepted sweep has at least three validated `BLINKDEAL*` coupon records.
- Mark a deal `STALE` more than four minutes after its last accepted confirmation.
- Keep session cookies, browser credentials, cart data, addresses, and checkout details out of the service and database.
- Authenticate every API route with a single operator bearer token supplied through `DASHBOARD_API_TOKEN`; do not log that value.
- Every commit must include `Co-authored-by: Codex <noreply@openai.com>`.

---

## File Structure

- `server/pyproject.toml` — pinned service dependencies and pytest settings.
- `server/app/config.py` — environment-backed configuration.
- `server/app/database.py` — SQLAlchemy engine/session lifecycle.
- `server/app/models.py` — persistent product, observation, sweep, rate, and deal models.
- `server/app/schemas.py` — immutable Pydantic source, API, and ranking contracts.
- `server/app/calculations.py` — pure purity and ranking calculations.
- `server/app/validation.py` — product normalization and acceptance/quarantine decisions.
- `server/app/source/myntra.py` — public-source adapter interface and HTTP implementation.
- `server/app/services/collector.py` — idempotent sweep orchestration.
- `server/app/services/deals.py` — deal state derivation.
- `server/app/services/rankings.py` — current-board query and rank service.
- `server/app/api.py` — FastAPI authenticated read-only routes and health endpoint.
- `server/app/main.py` — application factory.
- `server/app/cli.py` — `collect-once` command for scheduler use.
- `server/alembic/` — schema migration configuration and initial migration.
- `server/tests/` — unit, repository, collector, API, and fixture tests.
- `docker-compose.yml` — local PostgreSQL and service configuration.
- `README.md` — private-server setup, data boundary, and collector operation.

### Task 1: Create an isolated, testable service skeleton

**Files:**
- Create: `server/pyproject.toml`, `server/app/__init__.py`, `server/app/config.py`, `server/app/main.py`, `server/tests/test_health.py`, `docker-compose.yml`.

**Interfaces:**
- Produces `create_app() -> FastAPI`.
- Produces `GET /healthz -> {"status":"ok"}` without authentication.

- [ ] **Step 1: Write the failing application-factory test**

```python
from fastapi.testclient import TestClient
from app.main import create_app

def test_healthz_is_public_and_healthy():
    response = TestClient(create_app()).get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd server && pytest tests/test_health.py -q`

Expected: collection fails because `app.main` does not exist.

- [ ] **Step 3: Add the minimal configuration and application factory**

```python
def create_app() -> FastAPI:
    app = FastAPI(title="Private Myntra Gold Monitor")

    @app.get("/healthz")
    def healthz() -> dict[str, str]:
        return {"status": "ok"}

    return app
```

`Settings` must require `DATABASE_URL` and `DASHBOARD_API_TOKEN` outside tests; tests use an explicit SQLite URL and token fixture. Compose must use PostgreSQL 16 and read these values from `.env`, which is ignored by Git.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd server && pytest tests/test_health.py -q`

Expected: `1 passed`.

- [ ] **Step 5: Commit the scaffold**

```bash
git add server docker-compose.yml .gitignore
git commit -m "feat: add monitor service scaffold" -m "Co-authored-by: Codex <noreply@openai.com>"
```

### Task 2: Define persistent observations and migrate the database

**Files:**
- Create: `server/app/database.py`, `server/app/models.py`, `server/alembic.ini`, `server/alembic/env.py`, `server/alembic/versions/0001_initial.py`, `server/tests/test_models.py`.

**Interfaces:**
- Produces models `Product`, `Observation`, `RateObservation`, `SweepRun`, and `DealRun`.
- `Observation` has a unique key `(product_id, observed_at)`.
- `Product.myntra_product_id` is unique and never changes.

- [ ] **Step 1: Write failing persistence tests**

```python
def test_product_identity_and_observation_history(session):
    product = Product(myntra_product_id=30970319, brand="Mia", name="Leaf", product_url="https://www.myntra.com/x")
    session.add(product); session.flush()
    session.add(Observation(product_id=product.id, observed_at=dt(2026, 9, 17, 12), price=14487, mrp=14487, stock=2, in_stock=True))
    session.commit()
    assert session.query(Observation).count() == 1
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd server && pytest tests/test_models.py -q`

Expected: import failure for the missing models.

- [ ] **Step 3: Implement models and the initial Alembic migration**

Persist immutable source observations separately from product identity. Use UTC `datetime` values, `Numeric(12, 2)` for money, and nullable coupon/weight/purity fields. Add `quarantine_reason` to `Observation`; only accepted observations have it null. `SweepRun` records status, accepted/quarantined counts, and failure summary; `DealRun` records code, percentage, status, start, and last confirmation.

- [ ] **Step 4: Run migration and persistence tests**

Run: `cd server && alembic upgrade head && pytest tests/test_models.py -q`

Expected: migration succeeds and the test passes.

- [ ] **Step 5: Commit the schema**

```bash
git add server/app/database.py server/app/models.py server/alembic server/tests/test_models.py
git commit -m "feat: persist monitor observations" -m "Co-authored-by: Codex <noreply@openai.com>"
```

### Task 3: Implement pure normalization, validation, and calculations

**Files:**
- Create: `server/app/schemas.py`, `server/app/validation.py`, `server/app/calculations.py`, `server/tests/test_validation.py`, `server/tests/test_calculations.py`.

**Interfaces:**
- Produces `normalize_product(raw: RawProduct) -> NormalizedProduct`.
- Produces `validate_product(product: NormalizedProduct) -> ValidationResult`.
- Produces `rank_product(listed_price, grams, karat, deal_percent, rate24, haircut_percent) -> Rank`.

- [ ] **Step 1: Write failing fixtures and tests**

```python
def test_22k_rank_uses_916_purity_factor():
    rank = rank_product(15_000, 1, 22, 6, 15_453, 3)
    assert rank.pay == Decimal("14100.00")
    assert rank.metal_value == Decimal("13730.30")

def test_missing_weight_is_quarantined():
    result = validate_product(NormalizedProduct(product_id=1, grams=None, karat=24, price=10000))
    assert result.accepted is False
    assert result.reason == "missing_or_invalid_grams"
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd server && pytest tests/test_validation.py tests/test_calculations.py -q`

Expected: import failure for missing calculation and validation modules.

- [ ] **Step 3: Implement deterministic domain functions**

Use `Decimal`, never binary floats, for money. Accept only `22`, `23`, and `24` karat values; map them to `0.916`, `0.958`, and `1.0`. Return `pay`, `per_gram`, `metal_value`, `difference`, and decimal `needed_discount`. Validation must reject non-positive price/grams and missing or unrecognized karat with named reasons.

- [ ] **Step 4: Run tests to verify pass**

Run: `cd server && pytest tests/test_validation.py tests/test_calculations.py -q`

Expected: all tests pass.

- [ ] **Step 5: Commit domain logic**

```bash
git add server/app/schemas.py server/app/validation.py server/app/calculations.py server/tests
git commit -m "feat: validate and rank gold observations" -m "Co-authored-by: Codex <noreply@openai.com>"
```

### Task 4: Build fixture-driven source collection and sweep acceptance

**Files:**
- Create: `server/app/source/myntra.py`, `server/app/services/collector.py`, `server/tests/fixtures/myntra-products.json`, `server/tests/test_collector.py`.

**Interfaces:**
- Produces `MyntraSource.fetch_products() -> list[RawProduct]`.
- Produces `Collector.run(observed_at: datetime) -> SweepRun`.
- Consumes the validators from Task 3 and persists Task 2 models.

- [ ] **Step 1: Write failing collector tests**

```python
def test_partial_sweep_does_not_replace_last_accepted_board(session, source):
    first = Collector(session, source.with_products(ten_valid_products())).run(now())
    second = Collector(session, source.with_products(six_valid_products())).run(now_plus(minutes=2))
    assert first.status == "accepted"
    assert second.status == "partial"
    assert current_accepted_sweep(session).id == first.id
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd server && pytest tests/test_collector.py -q`

Expected: import failure for `Collector`.

- [ ] **Step 3: Implement the source adapter and collector**

The HTTP adapter may request only configured public Myntra catalogue/product URLs and must set an explicit timeout. It returns parsed `RawProduct` values; it never accepts a URL, headers, or cookies from an API caller. The collector creates one `SweepRun`, upserts stable products, appends observations, quarantines invalid products, and accepts a sweep only when its count is at least 70% of the previous accepted count. On an adapter failure, persist a `failed` sweep with a concise error summary and leave the last accepted sweep intact.

- [ ] **Step 4: Run collector tests**

Run: `cd server && pytest tests/test_collector.py -q`

Expected: accepted, partial, quarantined, and failed sweep cases pass.

- [ ] **Step 5: Commit collection**

```bash
git add server/app/source server/app/services/collector.py server/tests
git commit -m "feat: collect validated Myntra observations" -m "Co-authored-by: Codex <noreply@openai.com>"
```

### Task 5: Derive deal state and ranked board queries

**Files:**
- Create: `server/app/services/deals.py`, `server/app/services/rankings.py`, `server/tests/test_deals.py`, `server/tests/test_rankings.py`.

**Interfaces:**
- Produces `derive_deal(sweep: SweepRun) -> DealRun | None`.
- Produces `get_current_board(session, rate_merchant_id, haircut_percent, stock_only) -> Board`.

- [ ] **Step 1: Write failing deal and ranking tests**

```python
def test_three_blinkdeal6_observations_create_live_deal(session):
    deal = derive_deal(accepted_sweep_with_codes(session, ["BLINKDEAL6"] * 3))
    assert deal.status == "live"
    assert deal.percentage == Decimal("6")

def test_two_blinkdeal_observations_do_not_create_live_deal(session):
    assert derive_deal(accepted_sweep_with_codes(session, ["BLINKDEAL6"] * 2)) is None
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd server && pytest tests/test_deals.py tests/test_rankings.py -q`

Expected: import failure for the missing services.

- [ ] **Step 3: Implement deal and board services**

For accepted observations, group coupon codes case-insensitively. A code ending in an integer from `1` through `99` supplies the percentage. A non-numeric `BLINKDEAL` code becomes `detected_unpriced` and must not create calculated pay values. A previously live deal becomes `stale` after four minutes without an accepted confirmation. Board results include freshness, accepted/quarantined counts, selected rate, deal state, and ranks sorted by `difference` descending.

- [ ] **Step 4: Run tests to verify pass**

Run: `cd server && pytest tests/test_deals.py tests/test_rankings.py -q`

Expected: all deal transitions and ranking order tests pass.

- [ ] **Step 5: Commit deal services**

```bash
git add server/app/services server/tests/test_deals.py server/tests/test_rankings.py
git commit -m "feat: derive BlinkDeal board state" -m "Co-authored-by: Codex <noreply@openai.com>"
```

### Task 6: Expose authenticated private APIs and scheduler command

**Files:**
- Create: `server/app/api.py`, `server/app/cli.py`, `server/tests/test_api.py`, `server/tests/test_cli.py`.
- Modify: `server/app/main.py`, `README.md`, `.gitignore`.

**Interfaces:**
- `GET /api/v1/board?merchant_id=<id>&haircut=3&stock_only=true` returns the current board.
- `GET /api/v1/products/{myntra_product_id}` returns product and observation history.
- `GET /api/v1/operator/sweeps` returns the latest 20 sweep summaries.
- `python -m app.cli collect-once` runs exactly one collection.

- [ ] **Step 1: Write failing API and CLI tests**

```python
def test_board_requires_bearer_token(client):
    assert client.get("/api/v1/board").status_code == 401

def test_board_returns_ranked_rows_for_valid_token(client, token):
    response = client.get("/api/v1/board?merchant_id=kalyan&haircut=3&stock_only=true", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["status"] in {"off", "live", "stale", "detected_unpriced"}
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd server && pytest tests/test_api.py tests/test_cli.py -q`

Expected: routes and CLI module are missing.

- [ ] **Step 3: Implement read-only auth, routes, and command**

Use `secrets.compare_digest` to compare the bearer token with `DASHBOARD_API_TOKEN`. Never include the token in validation errors, response bodies, logs, or OpenAPI examples. Validate `haircut` as an inclusive decimal from `0` to `25`; reject unknown merchant IDs with `404`. The CLI exits `0` for accepted, partial, or quarantined completed sweeps and exits non-zero only for a collector execution failure; it prints sweep status/counts but no source payload.

- [ ] **Step 4: Run full server verification**

Run:

```bash
cd server && alembic upgrade head && pytest -q
cd .. && docker compose config --quiet
git diff --check
```

Expected: migration, all pytest cases, Compose validation, and whitespace checks pass.

- [ ] **Step 5: Document and commit the foundation**

Document `.env` variables, local start command, two-minute scheduler invocation, bearer-token use, public-data boundary, and the absence of cart/checkout collection.

```bash
git add server README.md .gitignore docker-compose.yml
git commit -m "feat: expose private gold monitor API" -m "Co-authored-by: Codex <noreply@openai.com>"
```

## Follow-on Plans

Create these only after this foundation is verified against source fixtures and a manually reviewed collection run:

1. Private operator dashboard: server-rendered authenticated UI over `/api/v1/board`, with `OFF`/`LIVE`/`STALE` chrome, filters, ranked rows, history drawer, and sweep-health panel.
2. Extension PDP verification: add an authenticated dashboard API client that compares public PDP values locally and never uploads browser credentials or cart data.
