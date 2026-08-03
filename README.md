# 羅傑全資產戰情室

可直接部署到 GitHub Pages 的純 HTML / CSS / JavaScript 網站。

## 部署到 GitHub Pages

1. 在 GitHub 建立一個 Public repository，例如 `roger-stock-live`。
2. 把本資料夾內所有檔案上傳到 repository 根目錄。
3. 前往 `Settings` → `Pages`。
4. `Build and deployment` 選擇 `Deploy from a branch`。
5. Branch 選 `main`，資料夾選 `/ (root)`，按 `Save`。
6. 等 GitHub 顯示網站網址後開啟。

## 設定即時股價

本網站預設使用 Twelve Data：

1. 申請 Twelve Data API Key。
2. 開啟網站，按「API 設定」。
3. 貼上 Key，儲存。
4. Key 只存於該瀏覽器的 localStorage，不會寫進 GitHub repository。

注意：GitHub Pages 是靜態網站，沒有後端保護 API Key。正式公開網站建議改用 Cloudflare Worker / Vercel Function 代理 API。

免費 API 方案通常有請求次數、延遲行情與市場支援限制。此版本每分鐘會針對可用標的逐一更新；若超過額度，會保留上一次或預設價格。

## 修改股票

編輯 `config.js` 的 `holdings`：

- `cost`: 每股入場成本
- `qty`: 持有股數
- `fallbackPrice`: API 失敗時顯示價格
- `apiSymbol`: Twelve Data 的查詢代號
- `apiSymbol: null`: 僅使用手動價格

目前以下標的預設為手動：

- `SKHY`：需確認實際可交易代號
- `DRAM`：需確認實際 ETF 代號
- `SPCX / SpaceX`：SpaceX 並非公開上市股票，沒有一般公開即時股價

## 修改 Twitch / Facebook / YouTube

在 `config.js` 修改 `socialLinks` 的網址。

## 放入自己的 MP3

將音效檔放進：

`assets/sounds/`

預設檔名：

- `lose-1.mp3`
- `lose-2.mp3`
- `win-1.mp3`
- `alert-1.mp3`

也可以在 `config.js` 的 `mp3Files` 修改檔名。若檔案不存在，網站會自動使用內建電子音效。

## 重要提醒

網站顯示內容僅供娛樂，不構成投資建議。行情資料的即時性與正確性以 API 供應商及交易所授權為準。
