# 點子清單

只列「尚未實作」的項目；做完就**從這裡刪除**（功能說明改記在 `TOOLS.md` / `README.md`），避免檔案越來越長。
提新點子前先查 `TOOLS.md`（已有）與本檔（已列），能擴充既有工具就不開新檔。每項標註：新工具 / 擴充哪一頁、需不需要存資料（不存資料的就不要用 localStorage）。
「先查」＝動工前要先確認既有工具是否已涵蓋。
新增點子時格式為「編號. **名稱**（新工具 / 擴充・資料）：說明」，放在合適的分類標題下；`tests/register.mjs` 的 `ideas` 欄用編號刪除已完成項目，並更新下面這行的數字。

目前還有 1 個點子（編號沿用原編號，已完成的已刪除，所以會跳號）。

## UI / 排版（2026-11 健檢）


## 使用者體驗 / 互動流程（2026-11 健檢）

114. **多分頁頁面記住目前分頁**（已做：僅限沒宣告 st-keys 的頁面；有 st-keys 的多分頁頁面（health-log、timers 等）與既有 e2e 的壞資料預期衝突，需逐頁各自記分頁）（擴充 shared/js/chrome.js 的 enhance/init・不需 localStorage，用 sessionStorage 鍵 `st_tab:<pathname>`）：實測 35 個多分頁工具（loan-calculator、net-calc、text-tools 13 分頁、image-edit、health-log、reading-list、timers、trip-kit、tw-holidays、art-studio 等）切到第 2 分頁後重新整理，一律跳回第 1 分頁；iOS 背景分頁被回收後回來也一樣 → chrome.js 對 `.tabs,#tabs,[role=tablist]` 內第 N 個按鈕的點擊記錄索引，載入完成後（rAF 一次）若記錄存在且該鈕非目前分頁就 `.click()` 還原；sessionStorage 全包 try/catch，已有自己記分頁的頁面（base-converter、date-calc 等）不受影響（還原後狀態相同即不動）；驗收：node tests/run.mjs 對 loan-calculator 寫 e2e：點第 3 分頁、reload，第 3 分頁仍為 aria-pressed=true；date-calc 等既有記分頁頁面行為不變；新開分頁（新 session）仍從第 1 分頁開始

## 既有工具功能缺口（2026-11 健檢）


## 已知待改進（小項）

- 台灣連假行事曆：2025–2027 已對人事行政總處公告（2026 起無補班）；2027 端午 / 中秋為 `Intl` 推算、官方逐日 PDF 未逐日核對；2028 年以後需等公告再核對。
- 麻將：台數規則各地不同，台數表可編輯；嚦咕只在算台計算機手動勾選，對局不自動偵測；不允許一炮多響。

## 評估後暫不做

- 影片擷取畫面 / 轉 GIF：GIF 編碼器太重、離線體積大。
- 文字轉語音輸出成音檔：瀏覽器無法擷取語音合成的輸出。
- 注音 / 拼音自動標註：需要完整字典，離線體積大。
- PDF 合併 / 分割 / 文字擷取：沒有函式庫時工程量太大（圖片轉 PDF 因只需寫出，列在待做）。
