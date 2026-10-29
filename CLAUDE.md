# Project instructions

- 寫程式、修改、重構、審查時，一律遵循 ponytail 原則（呼叫 `ponytail:ponytail` skill）：選最簡單、最短、最少依賴的可行解，優先用標準函式庫與原生平台功能。

# 專案開發筆記

個人網頁小工具箱：純靜態、離線優先、無建置步驟，部署在 GitHub Pages。開發者只有使用者本人；不替使用者 commit。

## 結構

- `index.html`：首頁，只負責導覽；分類與搜尋由卡片自動產生。
- `game-assist/ mini-games/ fun/ utils/ reading/`：資料夾 = 首頁分類，一個工具一支 HTML，頁面專屬的 CSS / JS 寫在頁面內。
- `shared/css/theme.css`（5 套風格 × 淺色 / 深色 + 手機基礎樣式）、`shared/css/maple.css`（楓之谷風格）、`shared/js/chrome.js`（套用風格 / 明暗、右上角「？說明」與「🎨外觀」）、`shared/js/util.js`（全域 `Util`）、`shared/js/p2p-room.js`（全域 `P2PRoom`，房主制 PeerJS 連線）。
- `TOOLS.md`：工具清單（功能、localStorage 鍵、是否連線），**提新點子前先查**；`IDEAS.md`：尚未實作的點子 / 待改進清單（做完就從裡面刪除，不留已完成項目）；`tests/`：node 測試；`assets/`：素材與首頁分享圖；`temp_*`：暫存檔（已 gitignore）。

## 共用模組收錄原則

放進 `shared/` 缺一不可：至少兩個工具已在用；用起來不必再調整。只有一個工具用到的，留在頁面內，等第二個需要時再抽。改共用檔會影響所有用到的頁面，改完跑兩個測試。

頁面引用（路徑依資料夾）：`<link rel="stylesheet" href="../shared/css/theme.css">`（放在頁面 `<style>` 之前）、`<script src="../shared/js/util.js">`、`<script src="../shared/js/p2p-room.js">`。頁面寬度用 `:root { --wrap-w: 720px; }`。

連線只負責連線層：訊息內容與規則在房主端處理，房主端必須驗證成員送來的一切資料；隱藏資訊用 SHA-256 加鹽承諾，私密內容只用 `sendTo`。

## 外觀、手機與說明（每個頁面都要遵守）

- **上色只用 theme.css 的變數**（`--bg --card --text --muted --fill --line --blue --on-blue --ok --bad --radius --radius-sm --btn-radius`…），不要寫死色碼，這樣 5 套風格 × 明暗才會整頁一起換。遊戲專屬的色彩（牌色、棋子色）可以寫死，但底色、文字、卡片、按鈕一律用變數。
- 風格 / 明暗由 `<html data-ui-style data-ui-mode>` 決定（chrome.js 設定）。**不要在頁面用 `data-style` / `data-mode` 屬性**（已經出過撞名 bug）。
- 每頁 `<head>` 在 theme.css 之後放 `<script src="../shared/js/chrome.js"></script>`（`index.html` 與根目錄頁面路徑不用 `../`）。
- **手機優先**：以 390px 寬為基準設計。按鈕與可點區域 ≥ 44px（theme.css 已對觸控裝置處理）；不可橫向捲動；棋盤 / 畫布用 `aspect-ratio` 與 `%` / `vw`，不要寫死像素；輸入框字級 ≥ 16px（避免 iOS 放大）；常用操作放在拇指好按的位置。改完用 390×844（`isMobile`）截圖檢查。
- **iPhone / Safari 專屬陷阱**：文字輸入（input / select / textarea）在觸控裝置上字級必須 ≥ 16px，否則 iOS 聚焦時會自動放大整個頁面（之後版面變寬、要手動縮回；chrome.js 已用 `!important` 全站強制，不要再用更小的字級）；高度用 `dvh`（寫在 `vh` 後面當後援），不要只用 `vh`；不要對 html / body 設 `overflow:hidden`；不要依賴外部 CDN（樣式、字型、圖示都要本地化，網路慢或 App 內建瀏覽器載入失敗時頁面會壞）；大面積 `touch-action:none`（遊戲盤面、畫布）會讓手指在上面無法捲動頁面，要確保盤面外有可滑動的區域，或提供「捲動頁面」模式切換。手機排版用真正的 WebKit（iPhone 17 模擬）稽核：`ios_audit.mjs`（6 種視窗狀態，約 20 秒，有快取）。
- **每個工具頁都要有說明**：頁面內放 `<template id="help">`，用 `<h3>` 分段：這是什麼 / 什麼時候用 / 怎麼用（或怎麼玩）/ 範例（`<div class="eg">`）/ 小提醒。第一次進入會自動彈出一次，之後從右上角「？」開啟。連線遊戲要寫清楚怎麼開房、怎麼邀請、規則與限制，以及單機模式怎麼玩。
- **本機資料一定要能備份**：頁面只要讀寫 localStorage，就必須在 `<head>` 宣告 `<meta name="st-keys" content="鍵1,鍵2,前綴_*">`（動態鍵用 `*` 結尾的前綴）；chrome.js 會因此在右上角出現「💾」，提供匯出 / 載入 JSON 備份（首頁是 `content="*"` 全站備份）。新增或改名鍵時同步更新這行（`tools.test.js` 會靜態檢查、`e2e_keys.mjs` 會執行期檢查）。讀取資料時一律驗證並容錯，因為還原會把舊版資料寫回來。
- **連線遊戲必須有單機模式**（電腦玩家 / 練習模式），不連線也能玩。
- 首頁（`index.html`）由卡片 `<a class="card" data-cat data-topic>` 自動產生分類磚 / 搜尋 / 最愛 / 最近使用；新工具要填 `data-topic`（見檔內註解）。
- 新卡片還要填：`data-kw`（4–10 個詞、空白分隔，寫別名 / 英文名 / 用途詞，不重複標題與說明已有的詞）、`data-added="YYYY-MM-DD"`（上線當天，之後不改；30 天內顯示「新」並進「最近新增」）、`data-store="1"`（`TOOLS.md` 第 3 欄有 localStorage 鍵才加）。搜尋、篩選、新標籤、主題跳轉全由這些屬性自動產生；`tests/new-f1.test.js` 會檢查格式。首頁是 PWA（`sw.js`、`manifest.webmanifest`）：改了 `sw.js` 要同步 `index.html` 的 `SW_CACHE` 版本常數。

## 資料管理規則（每個會存資料的工具都要遵守；新增與改版都要逐條檢查）

「能新增就要能刪除」：只做新增、沒做刪除 / 清理，是這個專案出過的典型 bug（心情日記標籤、貪睡鬧鐘、每日挑戰的動態鍵）。

1. **成長要有上限**：每一份會累積的資料（清單、歷史、紀錄、每個項目 / 日期一個的動態鍵）都要有上限，超過時的行為要一致：**拒絕新增並提示**（不要默默刪舊資料；真的是「最近 N 筆」性質的歷史才可淘汰最舊，並在介面或說明講清楚）。上限要比一般使用量寬鬆很多。動態鍵（如 `xxx_<日期>`、`erp_prog_<檔名>`）必須有修剪（例如只留最近 30 天 / 100 筆）。
2. **每種使用者資料都要有清除出口**：單筆刪除、清除全部 / 重置、（有最佳紀錄的遊戲）清除最佳紀錄；一律先 `confirm` 說明會刪什麼、無法復原；會重新載入頁面的要在確認文字講明「頁面會重新載入、進行中的這一局會結束」。
3. **刪除要乾淨**：用 id 而不是畫面索引刪（排序 / 篩選後索引會錯）；刪除項目時連帶清掉相關資料（打卡紀錄、學習進度、分配表、統計），不留孤兒資料；刪除後更新畫面與選取狀態；「清除全部」不能漏鍵、也不能清到別的工具的鍵。
4. **載入一律驗證並容錯**：備份還原、手動改壞、舊版資料都會讓資料缺欄位或型別不對（`null`、非陣列、非數字）。載入時驗證、補預設值、截斷到上限，壞資料不能讓整頁壞掉。
5. **儲存失敗要讓使用者知道**：用 `Util.store.set(key, value)`，失敗（空間滿、被封鎖）會自動顯示共用提示（`Chrome.storageFailed()`）；必須自己處理的情況可傳第三個參數 `true`（quiet）再自行說明。**直接用 `localStorage.setItem` 的地方必須在 catch 內呼叫 `window.Chrome && Chrome.storageFailed()`**（`tools.test.js` 會檢查）。不要在頁面裡再自己做一份「儲存失敗」提示。單筆可能很大的資料（日記全文、圖片、CSV、Markdown）要有大小限制。
6. **備份宣告**：新增或改名鍵時更新 `<meta name="st-keys">`（見上一節）。
7. **每個新增的資料功能都要自問**：它怎麼刪？怎麼清？滿了會怎樣？壞資料載入會怎樣？存不下會怎樣？並把答案寫進該頁的說明（`<template id="help">` 的「小提醒」）與單元測試。

## 測試

測試是固定腳本，**通過時不該花任何心力或 token**：用安靜的執行器，只有失敗才會印出內容，只針對失敗的那幾項去讀、去修。

```bash
node tests/run.mjs                    # 共用模組 + 工具單元測試（shared.test.js、tools.test.js，後者已含 solo-* / new-*，約 1 分鐘）
node tests/run.mjs 頁名片段            # 只跑「內容提到該片段」的單元測試與 e2e，例如 markdown-preview
node tests/run.mjs --ios [片段]        # iPhone 17 版面稽核（真 WebKit，6 種視窗，約 25 秒，有快取）
node tests/run.mjs --smoke [片段]      # 全站煙霧測試（Edge 手機視窗：無例外、無 404、無橫向溢出，約 25 秒）
node tests/run.mjs --e2e               # tests/e2e/ 內所有頁面 e2e
node tests/run.mjs --all               # 全部（單元 + 強制全站 iPhone 稽核 + 煙霧 + 全部 e2e），通過只印一行、失敗才印內容
```

- **不要把測試輸出整段讀進對話**：用 `node tests/run.mjs …`（通過只有一行）；直接跑 `tools.test.js` 會印幾百行 `ok`。失敗時才看最後幾行，修完只重跑那一個檔。
- **只跑受這次變動影響的測試**：改哪一頁就跑 `node tests/run.mjs 頁名`；`tools.test.js` 只在改到它涵蓋的頁面、登錄文件（index / README / TOOLS）或共用檔時才跑；改共用檔（theme.css / chrome.js / util.js / p2p-room.js）才做較大範圍回歸，且只挑受影響的類型。
- 純邏輯寫在頁面的 `// --- pure ---` 與 `// --- /pure ---` 之間，測試用 `load(file, 'names')` 取出來執行（`tests/<批次>.test.js`；單機 / 電腦玩家放 `solo-*.test.js`，新工具放 `new-*.test.js`，`tools.test.js` 會自動載入）。
- **畫面 / P2P / 下載的測試是 repo 內的固定腳本**，放 `tests/e2e/*.mjs`（不要寫在 repo 以外的暫存資料夾，工作階段結束就消失）。一律用 `tests/e2e/lib.mjs` 的 `launchEdge()`（Edge + puppeteer-core；第一次需在 `tests/e2e` 執行 `npm install`）：它把下載導到暫存資料夾、結束時整個暫存設定檔與 Edge 一併清掉（包含測試中途失敗的情況），**不要自己 `puppeteer.launch`**（會把下載檔丟進使用者的「下載」資料夾、留下殘留視窗）。連線工具開多個分頁，點擊用 DOM `.click()`；腳本結尾要 `await browser.close()`。
- 新增 / 修改頁面時，把它的畫面行為寫成 `tests/e2e/<頁名>.mjs`（例如 `markdown-layout.mjs` 驗證原文再長也不會撐寬 / 拉長整頁），之後同類問題由腳本擋下，不用再人工看。
- 截圖等除錯產物放暫存資料夾（系統 temp），用完刪除，不要留在 repo 或「下載」。

## 新增 / 合併工具

0. 登錄用 `node tests/register.mjs temp_reg_*.json`（規格檔寫在 repo 根目錄的 `temp_reg_<代號>.json`，欄位見 `tests/register.mjs` 檔頭）：一次補好首頁卡片、README、TOOLS，並刪掉 IDEAS.md 已完成的編號；不用手動改四個檔。

1. 先查 `TOOLS.md`：是既有工具的子集或延伸 → 擴充它（指名要加的分頁），不另開新檔；兩個工具共用同一份資料 / 輸入 → 合併。
2. 新增：依分類建 `<category>/xxx.html`（含 chrome.js 與 help 模板），並在 `index.html`（複製一張 `<a class="card">`，填 `data-cat` / `data-topic`）、`README.md` 表格、`TOOLS.md`、`tests/tools.test.js` 各補一筆；若點子來自 `IDEAS.md`，做完把該項從 `IDEAS.md` 刪除。
3. 刪除或改名頁面時，同步改上述四處，並讓舊 localStorage 鍵能被新頁面帶過去。
4. 提供「每日挑戰」用 `Util.seeded(種子)`；台灣時間用 UTC+8 算術；`Util.rnd(n)` 只支援 n ≤ 2^32。
