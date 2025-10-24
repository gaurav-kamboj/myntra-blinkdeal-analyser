# myntra-blinkdeal-analyser
Chrome extension that analyzes Myntra’s gold coin listings — applies Blinkdeal 8% discount, calculates effective ₹/gram rate, compares with live market gold rate, and flags best-value deals.


Disclaimer:<br>
- This extension is an independent open-source project created for educational and personal use.
- It is not affiliated with, endorsed by, or connected to Myntra, Blinkdeal, or any of their parent entities.
- All product names, logos, and trademarks are the property of their respective owners.
- The extension simply enhances publicly available web data on Myntra for informational purposes only.
- It does not collect or transmit any user data.

### ✨ Features

| Feature                              | Description                                                                                                |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 💸 **Blinkdeal Discount Calculator** | Automatically applies 8% Blinkdeal discount to Myntra gold coin prices.                                    |
| ⚖️ **Per-Gram Value Calculation**    | Detects product weight (2g, 5g, 10g, or combo) and computes price per gram.                                |
| 📊 **Market Rate Comparison**        | Compares derived ₹/gm with your input market rate and classifies results into four color-coded deal zones. |
| 🔄 **Persistent Settings**           | Market rate is stored in localStorage and persists across refreshes.                                       |
| 🟥 **MMTC Exclusion**                | Products containing “MMTC” or “MMTC-PAMP” are flagged as “BLINKDEAL not applicable”.                       |
| 🧭 **Smart Sorting**                 | Sort all products by lowest effective ₹/gram rate with one click.                                          |
| ⚙️ **Auto-Refresh Support**          | Works even with Myntra’s infinite-scroll product loading.                                                  |

<br>

### 🧮 Comparison Logic (Final Version)

| Difference vs Market (Derived – Market) | Label                                  | Emoji | Color  |
| --------------------------------------- | -------------------------------------- | ----- | ------ |
| ≤ −3 %                                  | **Steal deal – Below sell rate**       | 🟩    | Green  |
| Between −3 % and 0 %                    | **Fair – Below market but above sell** | 🟨    | Yellow |
| Between 0.01 % and +2.99 %              | **Slightly above market – Amber zone** | 🟧    | Orange |
| ≥ +3 %                                  | **Overpriced – Do not buy**            | 🟥    | Red    |

Hover over a label to see the exact percentage difference (e.g. −2.4 % vs market).

<br>

### 🧰 Installation (Developer Mode)

- Clone or download this repository: git clone https://github.com/gauravkamboj/myntra-blinkdeal-analyzer.git
- Open Chrome → chrome://extensions
- Enable Developer Mode
- Click Load unpacked
- Select the folder containing:
<pre> 📂 Project Structure 
  myntra-blinkdeal-analyzer/ 
  ├── manifest.json # Chrome extension manifest (v3) 
  ├── content.js # Core logic for Blinkdeal + market comparison 
  ├── LICENSE # MIT License file 
  ├── README.md # Documentation
  └── assets/ 
  ├── icon128.png # Extension icon 
  └── screenshots/ 
  ├── sample-1.png 
  └── sample-2.png  </pre>


### Visit [Myntra Gold Coin Page](https://www.myntra.com/gold-coin-24k)


### 🚀 Usage

Click “Set Market Rate” → enter current gold rate per gram (e.g., ₹12,500).

The extension instantly labels each product:

- 🟩 Steal deal – Below sell rate
- 🟨 Fair – Below market but above sell
- 🟧 Slightly above market – Amber zone
- 🟥 Overpriced – Do not buy

Click “Sort by ₹/gm ↑” to reorder products by cheapest effective per-gram rate. <br>
Market rate is saved automatically — you don’t need to re-enter it each time.

### ⚙️ Tech Stack

- JavaScript (Vanilla)
- Chrome Extensions API (Manifest v3)
- LocalStorage
- DOM Manipulation (No frameworks)

### 🧭 Future Enhancements

- 🔗 Auto-fetch live gold rate via AllIndiaBullion API
- 💬 Floating market-rate display badge on the page
- 📊 Tooltip showing exact % difference per product
- 🌙 Dark mode compatibility
