# myntra-blinkdeal-analyser
Chrome extension that analyzes Myntra’s gold coin listings — applies Blinkdeal 8% discount, calculates effective ₹/gram rate, compares with live market gold rate, and flags best-value deals.

| Feature                              | Description                                                                                                |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 💸 **Blinkdeal Discount Calculator** | Automatically applies 8% Blinkdeal discount to Myntra gold coin prices.                                    |
| ⚖️ **Per-Gram Value Calculation**    | Detects product weight (2g, 5g, 10g, or combo) and computes price per gram.                                |
| 📊 **Market Rate Comparison**        | Compares derived ₹/gm with your input market rate and classifies results into four color-coded deal zones. |
| 🔄 **Persistent Settings**           | Market rate is stored in localStorage and persists across refreshes.                                       |
| 🟥 **MMTC Exclusion**                | Products containing “MMTC” or “MMTC-PAMP” are flagged as “BLINKDEAL not applicable”.                       |
| 🧭 **Smart Sorting**                 | Sort all products by lowest effective ₹/gram rate with one click.                                          |
| ⚙️ **Auto-Refresh Support**          | Works even with Myntra’s infinite-scroll product loading.                                                  |

