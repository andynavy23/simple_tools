# Project instructions

- 寫程式、修改、重構、審查時，一律遵循 ponytail 原則（呼叫 `ponytail:ponytail` skill）：選最簡單、最短、最少依賴的可行解，優先用標準函式庫與原生平台功能。

# 專案開發筆記

個人網頁小工具箱：純靜態、離線優先、無建置步驟，部署在 GitHub Pages。開發者只有使用者本人；不替使用者 commit。

## 結構

- `index.html`：首頁，只負責導覽；分類與搜尋由卡片自動產生。
- `game-assist/ mini-games/ fun/ utils/ reading/`：資料夾 = 首頁分類，一個工具一支 HTML，頁面專屬的 CSS / JS 寫在頁面內。
- `shared/css/theme.css`（蘋果風格）、`shared/css/maple.css`（楓之谷風格）、`shared/js/util.js`（全域 `Util`）、`shared/js/p2p-room.js`（全域 `P2PRoom`，房主制 PeerJS 連線）。
- `TOOLS.md`：工具清單（功能、localStorage 鍵、是否連線），**提新點子前先查**；`tests/`：node 測試；`assets/`：素材與首頁分享圖；`temp_*`：暫存檔（已 gitignore）。

## 共用模組收錄原則

放進 `shared/` 缺一不可：至少兩個工具已在用；用起來不必再調整。只有一個工具用到的，留在頁面內，等第二個需要時再抽。改共用檔會影響所有用到的頁面，改完跑兩個測試。

頁面引用（路徑依資料夾）：`<link rel="stylesheet" href="../shared/css/theme.css">`（放在頁面 `<style>` 之前）、`<script src="../shared/js/util.js">`、`<script src="../shared/js/p2p-room.js">`。頁面寬度用 `:root { --wrap-w: 720px; }`。

連線只負責連線層：訊息內容與規則在房主端處理，房主端必須驗證成員送來的一切資料；隱藏資訊用 SHA-256 加鹽承諾，私密內容只用 `sendTo`。

## 測試

```bash
node tests/shared.test.js   # 共用模組（記憶體內的假 PeerJS）
node tests/tools.test.js    # 各工具純邏輯，約 1–1.5 分鐘；順便檢查 TOOLS.md / README / index 與頁面一致
```

- 純邏輯寫在頁面的 `// --- pure ---` 與 `// --- /pure ---` 之間，測試用 `load(file, 'names')` 取出來執行。
- 畫面與 P2P 要在真實瀏覽器測（puppeteer-core + Edge，需 `--disable-extensions`，點擊用 DOM `.click()`）；連線工具開多個分頁。

## 新增 / 合併工具

1. 先查 `TOOLS.md`：是既有工具的子集或延伸 → 擴充它（指名要加的分頁），不另開新檔；兩個工具共用同一份資料 / 輸入 → 合併。
2. 新增：依分類建 `<category>/xxx.html`，並在 `index.html`（複製一張 `<a class="card">`）、`README.md` 表格、`TOOLS.md`、`tests/tools.test.js` 各補一筆。
3. 刪除或改名頁面時，同步改上述四處，並讓舊 localStorage 鍵能被新頁面帶過去。
4. 提供「每日挑戰」用 `Util.seeded(種子)`；台灣時間用 UTC+8 算術；`Util.rnd(n)` 只支援 n ≤ 2^32。
