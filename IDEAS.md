# 點子清單

只列「尚未實作」的項目；做完就**從這裡刪除**（功能說明改記在 `TOOLS.md` / `README.md`），避免檔案越來越長。
提新點子前先查 `TOOLS.md`（已有）與本檔（已列），能擴充既有工具就不開新檔。每項標註：新工具 / 擴充哪一頁、需不需要存資料（不存資料的就不要用 localStorage）。
「先查」＝動工前要先確認既有工具是否已涵蓋。
新增點子時格式為「編號. **名稱**（新工具 / 擴充・資料）：說明」，放在合適的分類標題下；`tests/register.mjs` 的 `ideas` 欄用編號刪除已完成項目，並更新下面這行的數字。

目前還有 79 個點子（編號沿用原編號，已完成的已刪除，所以會跳號）。

## UI / 排版（2026-11 健檢）

91. **workout-log 組數列輸入欄過窄**（擴充 fun/workout-log.html・不需存資料）：390px 實測每組的重量(kg)與次數輸入框只有約 27px 寬，截圖看不到輸入的數字（如 100、12） → 把該列改為 flex-wrap 或 grid（`#n 重量 次數 RPE ×`），輸入框 `min-width:64px`；驗收：390px 輸入 135 與 12 可完整看到、無橫向捲動，`node tests/run.mjs workout-log`。
92. **空 select 縮成 46px**（擴充 utils/split-bill.html「誰先付」・不需存資料）：沒有成員時 select 寬度僅 46px，標籤與空白下拉並排顯得壞掉 → 給該 select `min-width:8em`，空時加一個 disabled 的「先新增成員」option；驗收：390px 空資料狀態下拉寬度 ≥ 120px。
93. **空 select 縮成 46px**（擴充 fun/flashcards.html 詞庫選單・不需存資料）：沒有詞庫時 `#deck` 下拉寬度 46px（截圖只剩一個箭頭）→ 給 `min-width:9em` 並在無詞庫時放 disabled「尚無詞庫」option；驗收：390px 空資料下拉寬 ≥ 120px。
94. **file input 原生樣式**（擴充 shared/css/theme.css・不需存資料）：30 個頁面有 `<input type="file">`，theme.css 沒有 `::file-selector-button` 樣式，subtitle-tool 截圖顯示灰色原生小按鈕（高度小於 44px、字體與其他按鈕不同）→ 加 `input[type=file]::file-selector-button` 用 button 的 padding / 圓角 / 邊框 / min-height:44px / margin-right；驗收：subtitle-tool、image-resize 390px 截圖檔案按鈕與一般按鈕同高同字體。
95. **勾選框列點擊範圍與對齊**（擴充 shared/css/theme.css・不需存資料）：checkbox 22px，但包住它的 label 實測高度 20–24px（metronome「第一拍重音」、papulatus、arcade 等超過 100 頁有 `LABEL:20~24`），且 checkbox 與較小的文字基線不對齊 → 在 `@media (pointer:coarse)` 對 `label:has(>input[type=checkbox],>input[type=radio])` 加 `display:inline-flex;align-items:center;gap:8px;min-height:44px`；驗收：metronome、chart-maker、tile-match 390px 量 label 高度 ≥ 44 且 checkbox 與文字垂直置中，並跑 `node tests/run.mjs --ios metronome`。
96. **range 滑桿高度**（擴充 shared/css/theme.css・不需存資料）：29 頁用 `<input type=range>`，theme 把 range 排除在 44px 規則外，實測 bpm / vol / wpm / rate 等滑桿元素高度僅 16px，手指難抓 → 觸控裝置加 `input[type=range]{min-height:44px}`（必要時 `accent-color` 已有）；驗收：metronome、tts、tone-generator 390px 滑桿元素高 ≥ 44，版面不跑掉。
97. **rjpq 標題被右上角按鈕壓住**（擴充 game-assist/rjpq.html・不需存資料）：390px 標題「Romeo and Juliet Party Quest 輔助工具」被固定的「工具箱 / ？」圓鈕蓋住最後兩個字 → header 加 `padding-right:104px`（兩顆 44px 按鈕 + 間距，與 chrome 實際按鈕數一致）；驗收：390px 截圖標題文字完全不被圓鈕蓋到。
98. **stealth-reader 頂欄被右上角按鈕壓住**（擴充 reading/stealth-reader.html・不需存資料）：390px 實測頂欄的「Mount Node」、設定圖示被固定的💾與？圓鈕蓋住（兩鈕在 y 10–52 的區域）→ 頂欄 `padding-right:104px` 或把圓鈕區留成空白列；驗收：390px 截圖頂欄所有項目與圓鈕不重疊。
99. **party 頂部「日誌」鈕與圓鈕重疊**（擴充 game-assist/party.html・不需存資料）：390px 的 `.btn-pixel`「日誌」落在右上角三顆圓鈕下方緊貼處，點擊區域與圓鈕相接（實測矩形相交）→ 標題列 `padding-top` 增加約 56px 或把「日誌」移到標題列左側；驗收：390px 該鈕矩形與 `.st-homebtn` 等圓鈕不相交。
100. **gobang 標題與公會徽章折行**（擴充 mini-games/gobang.html・不需存資料）：390px 標題「MapleStory Gobang - 楓之谷五子棋」與「aespaaa 公會製作」徽章擠成兩行、徽章自己也斷成兩行 → 標題 `flex-wrap` 並讓徽章 `white-space:nowrap`、標題縮到單行或徽章換到下一行；驗收：390px 標題區高度一致、徽章單行。
101. **party 底部分頁列未避開 iPhone 底部橫條**（擴充 game-assist/party.html・不需存資料）：`.nav-bottom` 與 `.fixed-footer` 為 `position:fixed` 但整個檔案沒有 `safe-area-inset-bottom`（同樣情況還有 fun/alarm 的 `#ringing`、mini-games/uno 的 `.fxr`）→ 對 `.nav-bottom` 與 `.fixed-footer` 加 `padding-bottom:env(safe-area-inset-bottom)` 並讓 footer 的 bottom 加上該值；驗收：`node tests/run.mjs --ios party` 無遮擋、底部內容可捲到不被擋。
102. **分頁鈕列缺少「還可左右滑」提示**（擴充 shared/js/chrome.js 的 `.st-scroll` 樣式・不需存資料）：390px chart-maker、text-tools、index 分類列最後一個鈕被切一半（「折」「Int」「小遊戲」）但沒有任何捲動提示，且 scrollbar 被隱藏 → `.st-scroll` 加 `mask-image:linear-gradient(to right,#000 calc(100% - 24px),transparent)`（捲到底時用 JS 加 class 取消）；驗收：chart-maker 390px 截圖右緣有淡出、捲到最右後淡出消失。
103. **periodic-table 搜尋框 placeholder 被截斷**（擴充 utils/periodic-table.html・不需存資料）：390px placeholder 顯示「搜尋（例如：鐵、Fe、26、golc」被切在半個字 → 縮短為「鐵、Fe、26、gold」或加 `aria-label` 搭配短 placeholder「搜尋元素」；驗收：390px 截圖 placeholder 完整可讀。
104. **periodic-table 與 level-puzzles 的 10–11px 小字**（擴充 utils/periodic-table.html・不需存資料）：實測 `SMALL` 11px 共 228 個節點、CSS 內另有 9px / 10px（原子序、符號），在 390px 手機上讀不清 → 把原子序 / 英文名下限提到 12px，格子視需要加寬（表格本身已橫向捲動）；驗收：用 evaluate 掃描所有可見文字 `fontSize ≥ 12`。
105. **level-puzzles 關卡按鈕副標 11px**（擴充 mini-games/level-puzzles.html・不需存資料）：`.lv button small`（星星 / ✓）實測 11px × 32 個，且頁面標題右側緊貼四顆圓鈕、沒有「‹ 工具箱」返回連結（其他工具頁都有）→ 副標改 12px、補上 `<a class="back">`；驗收：390px 截圖有返回連結且標題不與圓鈕相交。
106. **tw-holidays 日曆 9–11px**（擴充 utils/tw-holidays.html・不需存資料）：`.cal .d small`、`#pArea .g .c i/u` 皆 10px，另有 11px 星期標題，是全站字級偏小的重災區（7 處）→ 日曆格內文字提到 12px 並用 `text-overflow` 截斷 / 以顏色圓點取代文字；驗收：390px 日曆格內最小字級 ≥ 12px 且格子不撐寬。
107. **rjpq 門格編號 10px**（擴充 game-assist/rjpq.html・不需存資料）：`.door-cell-id` 實測 10px × 40 個、`.f-label` 11px × 10 個（390px 實測），是遊戲內辨識用的關鍵資訊 → 提到 12px 並讓格子 min-height 容納；驗收：390px 掃描可見文字 `fontSize ≥ 12`。
108. **qr-scan 按鈕圖示 emoji 與全站線條風格不一致**（擴充 utils/qr-scan.html・不需存資料）：「📷 開啟相機掃描」「🖼 選擇圖片」使用彩色 emoji，🖼 在截圖中糊成一小塊且與其他頁線條圖示風格不同 → 改成內嵌單色 SVG（`currentColor`）或直接移除圖示；驗收：390px 兩顆按鈕圖示清晰、跟隨文字顏色（深色模式也一致）。
109. **tetris 控制鈕符號風格混雜**（擴充 mini-games/tetris.html・不需存資料）：觸控列 ◀ ▶ ▼ 為實心三角、⟲ ⟳ ↓ ⏸ 為細線字元，粗細與大小明顯不同，且七顆鈕沒有文字標籤 → 全部改成同一套內嵌 SVG（stroke 2px、`currentColor`）並加 `aria-label`（已有的別重複）；驗收：390px 截圖七顆鈕圖示粗細一致。
110. **papulatus 可點小字 13px**（擴充 game-assist/papulatus.html・不需存資料）：`voice-mobs / restart-mobs / quick-mobs / voice-water…` 等勾選項目實測高度 13px、標籤字約 13px（每個計時卡 3 個 × 多卡），點擊區域遠小於 44px → 該 label 加 `min-height:44px;display:inline-flex;align-items:center` 並讓三個勾選鈕可換行；驗收：390px 每個勾選項目高度 ≥ 44，卡片高度增加不超過 20%。
111. **gobang 下拉與切換鈕 32–36px**（擴充 mini-games/gobang.html・不需存資料）：`#cpu-level`、`#cpu-first` 36px、`#btn-log-toggle` 32px，低於專案 44px 規則（此頁不載入 theme.css，所以沒吃到觸控規則）→ 自己的 CSS 對 `@media (pointer:coarse)` 設 `min-height:44px`；驗收：390px 觸控模擬量測三者高度 ≥ 44。
112. **未載入 theme.css 的 6 頁沒有統一的觸控 / 字級保底**（擴充 mini-games/gobang.html 為代表，另 lucky-channel、party、rjpq、papulatus、stealth-reader・不需存資料）：這 6 頁自成一格主題（楓之谷 / pixel），按鈕、輸入框不吃 44px 與 16px 規則；實測 lucky-channel 的 `predictDate` 等輸入 38px 高。先在 lucky-channel 加 `@media (pointer:coarse){input,select,button{min-height:44px}}`；驗收：lucky-channel 390px 觸控模擬所有輸入框高度 ≥ 44。
113. **markdown-preview 表格工具按鈕 38px 並排太擠**（擴充 utils/markdown-preview.html・不需存資料）：`tAddRow / tDelRow / tAddCol / tDelCol` 實測 38px 高（`.sm`），四顆並排誤觸機率高；同樣 `.sm` 38px 出現在 mind-map 的「改名 / 複製 / 刪除這張」緊鄰按鈕 → 在這兩頁讓 `.sm` 群組列 `gap:10px` 並把破壞性鈕（刪除）與其他鈕隔開；驗收：390px 相鄰 `.sm` 按鈕間距 ≥ 10px，「刪除」類按鈕與非刪除鈕不相鄰。

## 使用者體驗 / 互動流程（2026-11 健檢）

114. **多分頁頁面記住目前分頁**（擴充 shared/js/chrome.js 的 enhance/init・不需 localStorage，用 sessionStorage 鍵 `st_tab:<pathname>`）：實測 35 個多分頁工具（loan-calculator、net-calc、text-tools 13 分頁、image-edit、health-log、reading-list、timers、trip-kit、tw-holidays、art-studio 等）切到第 2 分頁後重新整理，一律跳回第 1 分頁；iOS 背景分頁被回收後回來也一樣 → chrome.js 對 `.tabs,#tabs,[role=tablist]` 內第 N 個按鈕的點擊記錄索引，載入完成後（rAF 一次）若記錄存在且該鈕非目前分頁就 `.click()` 還原；sessionStorage 全包 try/catch，已有自己記分頁的頁面（base-converter、date-calc 等）不受影響（還原後狀態相同即不動）；驗收：node tests/run.mjs 對 loan-calculator 寫 e2e：點第 3 分頁、reload，第 3 分頁仍為 aria-pressed=true；date-calc 等既有記分頁頁面行為不變；新開分頁（新 session）仍從第 1 分頁開始
115. **2048 進行中棋盤可接續**（擴充 mini-games/game-2048.html・需存資料，新鍵 `g2048_cur`，更新 st-keys）：實測按 6 次方向鍵後 reload，棋盤從 2,2,8,2 變成全新 4,2，只有 `g2048_best` 被保留，手機切 App 回來被回收就整局消失 → 每次移動後存 {盤面,分數,模式(每日/自由)}；載入時驗證 4×4 數字為 2 的次方、否則丟棄；新遊戲 / 結束 / 每日跨日時清掉；說明小提醒補一句；驗收：e2e 移動後 reload 盤面與分數相同，塞壞資料（非陣列、含 3）不丟例外並開新局
116. **數獨進行中題目可接續**（擴充 mini-games/sudoku.html・需存資料，新鍵 `sudoku_cur`，更新 st-keys）：實測輸入一個數字後 localStorage 沒有任何 sudoku 鍵，reload 後題目、計時、筆記全部重來，難題要花 10 分鐘以上 → 存 {難度,題目,已填,筆記,已用秒數,是否每日};載入驗證 81 格範圍 0–9、盤面與題目不矛盾，壞資料丟棄；完成或按新題清除；驗收：e2e 填數 reload 後相同、計時延續；塞壞資料不當機
117. **數織進行中棋盤可接續**（擴充 mini-games/nonogram.html・需存資料，新鍵 `nono_cur`，更新 st-keys）：15×15 一局要很久，目前只有 `nono_best_*`，reload 就重出題 → 存 {尺寸,種子或解答,玩家塗色,已用時間}，完成 / 換題清除，載入驗證長度與值域；驗收：e2e 塗幾格 reload 相同、塞壞資料開新局
118. **心情日記未存草稿不遺失**（擴充 fun/mood-journal.html・需存資料，新鍵 `mood_draft`，更新 st-keys）：實測在 #text（日記全文，上限 2000 字）輸入後 reload，文字清空；writing-desk 有草稿但心情日記沒有，手機切到別的 App 被回收就白寫 → 輸入時（節流 500ms）存草稿{文字,心情,標籤}，儲存成功與「清除全部」時一併刪除，載入時截斷到 2000 字並驗證型別；有草稿時在輸入框上方顯示「已還原未儲存的草稿 · 捨棄」；驗收：e2e 輸入、reload 文字仍在、按儲存後 reload 為空
119. **共用 Chrome.toast 加「復原」動作並用在待辦刪除**（擴充 shared/js/chrome.js toast + fun/todo.html・不需存資料）：實測 todo.html 單筆 ✕（第 399 行）直接刪除、沒有 confirm 也沒有復原，手機誤觸即永久遺失；其他資料頁則是 confirm 轟炸 → toast(msg, ms, kind, {label,onClick}) 多一個選用按鈕（鍵盤可聚焦、不改既有呼叫），todo 刪除後 toast「已刪除『xxx』· 復原」6 秒內可還原到原位置（以 id 與原索引插回）、期間再刪第二筆則第一筆不可復原；驗收：e2e 刪除後點復原項目回到原位；shared.test.js 補 toast 無 action 時行為不變
120. **還原備份前提供「先匯出目前資料」**（擴充 shared/js/chrome.js openData 的 restore 預覽・不需存資料）：實測差異預覽寫著「會覆蓋 N 項、覆蓋後無法復原」，但只有「確認載入」與「取消」，使用者在新舊備份間選錯就永久丟資料 → 當 d.over.length>0 時在預覽加「先下載目前資料再載入」按鈕（沿用 exp 的 buildBackup + 下載邏輯，檔名加 `-before-restore`），下載後才啟用「確認載入」；驗收：node tests/run.mjs 對 chrome 備份寫 e2e：有覆蓋時預覽有該按鈕且點擊產生下載檔、無覆蓋時不出現
121. **備份視窗密碼欄支援 Enter**（擴充 shared/js/chrome.js openData・不需存資料）：程式碼顯示加密匯出的 `#st-enc-pw` 與解密時的密碼欄都沒有 keydown，使用者輸入密碼按 Enter 沒反應，手機鍵盤的「前往」鍵也無效 → 解密欄 Enter 觸發「解密」、加密欄 Enter 觸發「匯出備份」，並設 enterkeyhint="go"；驗收：e2e 載入加密檔，輸入密碼按 Enter 進入差異預覽
122. **油耗紀錄 Enter 送出與失敗聚焦**（擴充 utils/fuel-log.html・不需存資料）：實測在 liters 欄填完按 Enter 不會新增（localStorage 無變化），空白按「新增」只出現「請填入日期、里程、公升」文字、focus 留在 BODY → 輸入欄 keydown Enter 觸發 #add；驗證失敗時把焦點移到第一個空必填欄並加 aria-invalid；驗收：e2e 填欄按 Enter 新增一筆；空白送出後 document.activeElement 為 #odo 之類必填欄
123. **健康紀錄 Enter 送出、新增後回到第一欄**（擴充 utils/health-log.html・不需存資料）：實測血壓欄填完按 Enter 沒有新增；新增成功後 focus 留在 BODY（連續記多筆要重點欄位）；失敗訊息「收縮壓請填 50–300」沒有聚焦欄位 → #f_sys/#f_dia/#f_hr/#f_note 的 Enter 觸發 #save、成功後聚焦 #f_sys、失敗聚焦對應欄；驗收：e2e Enter 新增一筆、之後 activeElement=#f_sys；空白送出聚焦 #f_sys
124. **訂閱管理 Enter 送出、新增後聚焦名稱欄**（擴充 utils/subscription-manager.html・不需存資料）：實測 f_amt 填完按 Enter 沒新增、新增後 focus 在 BODY、失敗只顯示「請填服務名稱」 → f_name/f_amt/f_note Enter 觸發 #save，成功後聚焦 #f_name，驗證失敗聚焦出錯欄；驗收：e2e 填名稱與金額按 Enter 新增一筆
125. **我的清單（書籤 / 帳號）Enter 送出**（擴充 utils/my-lists.html・不需存資料）：實測 b_url 填 example.com 按 Enter 不新增（bookmark 一次貼一個網址最常用 Enter）→ b_url/b_name/b_tags/b_note Enter 觸發 #b_save，a_* 欄位 Enter 觸發 #a_save，新增後聚焦 b_url / a_name；驗收：e2e 在 b_url 貼網址 Enter 後書籤清單多一筆且 b_url 清空
126. **螢幕恆亮：番茄鐘**（擴充 fun/pomodoro.html・不需存資料）：實測 grep wakeLock 為 0，專注 25 分鐘期間手機自動鎖屏，timers / kids-routine / party-kit 已有 wakeOn/wakeOff，唯獨番茄鐘沒有，鎖屏後計時提示音常常來不及 → 開始計時時 navigator.wakeLock.request('screen')，暫停 / 結束 / 頁面隱藏時釋放，visibilitychange 回來重新取得（照 fun/timers.html 的 wakeOn/wakeOff 寫法）；不支援就靜默略過、說明小提醒補一句；驗收：e2e 以 stub navigator.wakeLock 驗證開始時 request、暫停時 release
127. **閱讀器 EPUB 鍵盤與滑動翻章**（擴充 reading/epub-reader.html・不需存資料）：實測該頁 grep keydown 為 0、沒有 touch 手勢，只有 #prev/#next 按鈕；同資料夾 stealth-reader 已支援 ← → PageDown 與左右滑 → 電腦鍵盤 ← → 與 PageUp/PageDown 切章（輸入框聚焦時不觸發），手機閱讀區左右滑動 ≥ 60px 且垂直位移小時切章；驗收：e2e 按 ArrowRight 後 #pos 章節 +1
128. **圖片編輯支援拖放與貼上圖片**（擴充 utils/image-edit.html・不需存資料）：實測該頁 grep drop|paste 為 0，只有選檔；image-resize 與 exif-viewer 已支援，截圖後 Ctrl+V 是修圖最常見入口 → 在頁面層註冊 dragover/drop 與 paste（clipboardData.items 取 image/*），餵給現有載入函式，非圖片時顯示既有錯誤訊息；驗收：e2e 以 DataTransfer 觸發 paste/drop，畫布出現圖片
129. **日誌檢視器支援拖放與貼上文字**（擴充 utils/log-viewer.html・不需存資料）：實測只有 #file 選檔，沒有 drop/paste，使用者複製一段 log 無處貼 → 頁面 drop 檔案載入、在非輸入元素聚焦時 paste 純文字視為日誌內容，超過現有大小上限時沿用現有提示；驗收：e2e 貼上多行文字後列表出現對應行數
130. **字幕工具支援拖放字幕檔**（擴充 utils/subtitle-tool.html・不需存資料）：實測只有 #file（accept 字幕副檔名），無 drop → 整頁 drop 接受 .srt/.vtt/.ass/.ssa/.sbv/.txt，與選檔共用同一載入函式，不符副檔名顯示錯誤；驗收：e2e 以 DataTransfer 放入 .srt 後出現字幕列
131. **貸款試算記住上次輸入並可複製結果**（擴充 utils/loan-calculator.html・需存資料，新鍵 `loan_opts`，加 st-keys）：實測改 3 個欄位後 reload 全回預設值，頁面沒有 st-keys、也沒有任何複製按鈕（copyBtn=false），算完要傳給家人只能截圖 → 存目前分頁與所有輸入值（數字範圍驗證、壞資料補預設），加「複製結果」按鈕用 Util.copyWithFeedback 複製目前分頁的摘要文字；說明小提醒補存資料與清除（「重設為預設」按鈕 + confirm）；驗收：e2e 改值 reload 保留、塞壞資料不丟例外、複製按鈕寫入剪貼簿文字含月付金額
132. **分帳結果可複製成群組訊息**（擴充 utils/split-bill.html・不需存資料）：實測全頁沒有任何複製按鈕（copyBtn=false），分帳最後一步就是把「誰付誰多少」貼進 LINE 群組，目前只能手抄 → 結果區加「複製結算文字」，每行「A → B：NT$ 120」，沒有結果時按鈕 disabled，用 Util.copyWithFeedback；驗收：e2e 建立 3 人 2 筆帳後點擊，剪貼簿含每筆轉帳行
133. **所得稅試算可複製摘要**（擴充 utils/income-tax.html・不需存資料）：實測沒有複製按鈕（copyBtn=false），試算結果（應納稅額、級距、扣除項）要留存只能截圖 → 結果卡加「複製摘要」，內容含各項輸入與結果，免責聲明文字一併帶上；驗收：e2e 填入收入後點擊，剪貼簿含「應納稅額」
134. **正規表示式測試器錯誤訊息中文化**（擴充 utils/regex-tester.html・不需存資料）：實測輸入 `([a-` 顯示瀏覽器原文「Invalid regular expression: /([a-/g: Unterminated character class」，與全站中文提示不一致且不說明哪裡錯 → 第 288 行 catch 把常見 V8 / WebKit 訊息（Unterminated character class / group、Nothing to repeat、Invalid escape、Invalid flags）對照成中文一句話，其他維持原文；驗收：tests 以純函式驗證 4 種訊息對照，e2e 輸入壞式樣出現中文提示
135. **派對 / 團練斷線改頁內提示與一鍵重新加入**（擴充 game-assist/party.html・不需存資料，即時協作不存資料）：實測 onClose 與 onRejected 用 alert 後 `location.reload()`（第 958–959 行），手機短暫斷網或切 App 回來就整頁重載、房號與暱稱都要重打；複製邀請也用 alert（第 1182 行） → onClose 改為頁內橫幅「連線中斷 · 重新加入（沿用房號與暱稱）· 離開」，重新加入呼叫原 join 流程不重載頁面；複製邀請改 Util.copyWithFeedback 或 Chrome.toast；驗收：e2e 以 room.destroy 模擬關閉，橫幅出現且按鈕可再次加入
136. **RJPQ 門位標記 alert 全改頁內提示**（擴充 game-assist/rjpq.html・不需存資料，即時協作不存資料）：實測該頁有 11 處 alert（暱稱錯誤、顏色被占用、已複製連結、被踢出、複製路線成功等，第 1137–1862 行），成功類訊息也用阻塞對話框，iOS 主畫面模式中斷操作且即時同步在 alert 期間會卡住 → 錯誤與成功一律改 Chrome.toast（kind=bad / ok），「被踢出」保留可見橫幅；複製連結改 Util.copyWithFeedback；驗收：grep 該頁 `alert(` 為 0，e2e 複製連結後按鈕文字變「已複製」而無 dialog 事件
137. **旅行行程 alert 改 toast**（擴充 utils/trip-kit.html・不需存資料）：實測有 10 處 alert（達上限、日期錯誤、經緯度格式、「已加入」成功訊息等，第 322–451 行），頁面零處使用 Chrome.toast；成功訊息「已加入」以 alert 呈現必須多按一次確認 → 錯誤改 toast(kind=bad)，成功改 toast；上限類訊息文字不變；驗收：grep `alert(` 為 0，e2e 超過 MAX_ITEMS 時出現 .st-toast 而非 dialog
138. **首頁「我的最愛」可調整順序**（擴充 index.html・需存資料，沿用 `home_fav`）：實測 star.onclick 以 `[href, ...fav]` 新加入的排最前面（第 3131 行），沒有任何調整順序入口，常用的工具會被新加入的擠到後面 → 我的最愛每列加「上移 / 置頂」小按鈕（≥44px、aria-label 含工具名），只改陣列順序並 store.set；fav 為壞資料時沿用既有 list_ 驗證；驗收：e2e 加 3 個最愛後對第 3 個按置頂，順序與 localStorage `home_fav` 皆更新
139. **首頁搜尋字串返回後保留**（擴充 index.html・不需存資料，sessionStorage 鍵 `st_home_q`）：實測輸入「倒數」後 reload 搜尋框清空；從搜尋結果點進工具再按瀏覽器返回，非 bfcache 時（iOS 主畫面模式、Safari 記憶體回收）要重新輸入 → 輸入時寫 sessionStorage，載入時還原並 render，Esc 與切換分類（goView）時清除；驗收：e2e 輸入 reload 後 #q 值與結果相同，按 Esc 後 reload 為空
140. **便條紙空狀態引導**（擴充 fun/sticky-notes.html・不需存資料）：實測首次開啟只有「新增便條」按鈕與「0 張」，不像 fuel-log 等頁會寫「還沒有記錄，從上面新增第一筆吧」→ 無資料時顯示一行引導文字（按「新增便條」開始），有資料即消失；驗收：e2e 空資料時文字存在，新增後消失
141. **寵物記錄空狀態引導**（擴充 fun/pet-log.html・不需存資料）：實測首次開啟只有「＋ 新增寵物」→ 無資料時顯示一行引導文字（先新增一隻寵物才能記餵食 / 體重 / 疫苗），有資料即消失；驗收：e2e 空資料時文字存在，新增後消失

## 既有工具功能缺口（2026-11 健檢）

142. **健康記錄可編輯**（擴充 utils/health-log.html・不新增鍵）：TOOLS.md 明載「無編輯功能只有單筆刪除」，血壓 / 血糖 / 體重打錯一個數字只能刪掉重打，且順序與時間會變 → 每筆旁加「編輯」，把該筆帶回表單，按「儲存」以 id 覆蓋原筆（同樣驗證範圍，不增加筆數、上限 5000 不受影響）；help 小提醒移除「無編輯」；驗收：新增一筆血壓 → 編輯改收縮壓 → 列表與趨勢圖更新、筆數不變、時間不變；匯出 CSV 為新值。
143. **記帳本可編輯**（擴充 utils/expense-tracker.html・不新增鍵）：只有刪除，金額 / 分類 / 日期 / 備註記錯得刪掉重記；外幣筆刪了還要重填匯率 → 明細每筆加「編輯」帶回表單，以 id 覆蓋；外幣筆保留當初鎖定的匯率（顯示但可手改），台幣金額重算；驗收：記一筆 USD 30 匯率 32 → 編輯改日期與分類 → 匯率仍 32、月統計與分類占比跟著變、筆數不變。
144. **所得稅補列三項特別扣除**（擴充 utils/income-tax.html・只存上次輸入，沿用 `itax_opts`）：help 明寫未納入「房租支出、幼兒學前、長期照顧」特別扣除，租屋族、有幼兒或失能長輩的家庭算出來會偏高 → 在特別扣除區加三個輸入（房租支出年額，每戶上限；幼兒學前人數 × 每人額；長照人數 × 每人額），額度與上限寫在頁面頂端常數並標註年度「請自行核對」，房租與房貸利息（列舉）互斥時提示；驗收：加一位幼兒 → 所得淨額與稅額減少恰為「額度 × 邊際稅率」，且 `itax_opts` 舊資料（無新欄位）載入不壞。
145. **貸款分頁加寬限期與分段利率**（擴充 utils/loan-calculator.html「貸款」分頁・只存上次輸入的既有鍵若有）：台灣房貸 / 信貸常見「前 N 年寬限只繳息」與「前兩年 1.5%、之後 2.2%」的階梯利率，目前寬限期只在「買房 vs 租房」與就學貸款有，貸款分頁的 `amortize()` 只能單一利率 → 貸款分頁加「寬限期（月）」與「第二段利率 / 從第幾期起」兩個選填欄，逐期表照新規則算，總利息對照單一利率的差額；驗收：寬限 12 期時前 12 期付款 = 本金 × 月利率、餘額不變；第二段利率與第一段相同時結果與現有完全一致；總期數與餘額最後一期為 0。
146. **貸款逐期表複製 / 匯出 CSV**（擴充 utils/loan-calculator.html・不存資料）：逐期明細表目前只能看（頁面無 copy / CSV），要帶到試算表或給銀行比較要手抄 → 表格上方加「複製（TSV）」與「下載 CSV」（Util.csvStringify，防公式注入不需要因全為數字），內容 = 期數 / 月付 / 利息 / 本金 / 餘額；驗收：360 期房貸複製後貼進 Excel 為 360 列 5 欄，最後一期餘額 0。
147. **分帳結算可複製文字**（擴充 utils/split-bill.html・不新增鍵）：結算結果只能在畫面看，實際用途是貼到 LINE 群組請大家轉帳，現在要手抄（頁面無 copy）→ 結算區加「複製結算文字」（用 `Util.copyWithFeedback`），內容為每人應收 / 應付與最少轉帳清單，例「小華 → 小明 300」；驗收：help 範例（小明先付 900、三人分）複製出的文字含兩行轉帳且金額加總 600。
148. **待辦清單搜尋**（擴充 fun/todo.html・不新增鍵）：上限 500 項、分六組＋月曆＋四象限，卻完全沒有搜尋（頁面無 search），項目一多找不到 → 清單頂端加搜尋框，即時以文字包含篩選各分組（含已完成），清空還原，不改資料；驗收：加 3 項含「繳費」其中 1 項已完成 → 搜「繳費」只顯示 3 項並保留所在分組；排序 / 四象限檢視不壞。
149. **待辦重複任務**（擴充 fun/todo.html・沿用 `todo_items`，每筆多一個選填欄 `rep`）：繳房租、倒垃圾、月報這類週期事項目前每次要手動重建 → 新增時可選「重複：每天 / 每週 / 每月」，勾選完成時自動依到期日往後產生下一筆（未完成的舊筆不重複產生、每月遇月底進位到月底），仍受 500 項上限（滿了拒絕並提示）；舊資料沒有 `rep` 視為不重複；驗收：每月 1/31 的待辦完成後下一筆為 2/28（閏年 2/29）；`storage_fuzz` 塞壞 `rep` 值不例外。
150. **日期計算機工作日可排除國定假日**（擴充 utils/date-calc.html・不存資料；需把 tw-holidays 內的假日表抽到 shared/js/ 供兩頁共用，符合「第二個工具需要才抽」）：help 明寫「工作日只排除週六日（不含國定假日與補班）」，算請款到期、交期、試用期時會多算好幾天，而 tw-holidays 已有 2025–2027 資料 → 「相差」與「加減」的工作日模式加勾選「排除國定假日並計入補班」，資料年份範圍外提示「超出內建範圍，僅排除週末」；驗收：2026-02-13 加 5 個工作日（跨春節）結果與 tw-holidays 連假清單吻合；不勾選時與現有結果完全相同（既有測試不變）。
151. **今彩 539 對獎**（擴充 utils/lottery-check.html・不新增鍵）：只有統一發票、大樂透、威力彩，台灣最常買的今彩 539 沒有 → 新增「今彩 539」模式：開獎 5 個號碼（1–39），你的號碼一行一注（5 個），判頭 / 貳 / 參 / 肆獎（中 5 / 4 / 3 / 2 個），獎金表放頁面常數並標註「以官方公告為準」；驗收：開獎 01 05 12 20 39，投注 01 05 12 20 38 → 中 4 個為貳獎；重複號碼或超範圍號碼提示錯誤。
152. **單位換算補壓力 / 能量 / 功率**（擴充 utils/unit-converter.html・不存資料）：現有類別只有長度、重量、黃金、面積、體積、速度、資料量、溫度，輪胎胎壓（bar / psi / kPa）、食物與運動熱量（kcal / kJ）、電器馬力（kW / hp）完全沒有，使用者需要時只能另找 → 在 `CATS` 加三類線性單位（壓力：Pa kPa bar psi atm mmHg；能量：J kJ kcal Wh kWh；功率：W kW 公制馬力 英制馬力），沿用既有介面；驗收：1 atm = 101.325 kPa = 14.696 psi；1 kcal = 4.184 kJ；1 kW = 1.341 hp(英制)。
153. **單位換算補油耗（km/L ⇄ L/100km ⇄ mpg）**（擴充 utils/unit-converter.html・不存資料）：油耗是倒數關係，不能放進線性倍率的 `CATS`，現在無法換算（買進口車、看國外評測常遇到 L/100km 與 mpg）→ 比照 `TEMP` 另建倒數類別；0 與負值顯示「無效」；驗收：10 km/L = 10 L/100km = 23.52 mpg(US) = 28.25 mpg(UK)；輸入 0 不出現 Infinity。
154. **圖片壓縮可批次**（擴充 utils/image-resize.html・不存資料；頁面內已有 ZIP 寫入器可重用）：縮圖 / 轉檔分頁只能一次一張（`#file` 無 multiple），整批照片要縮到同寬或轉 WebP 得重複操作；同站的浮水印頁已支援 30 張批次與 ZIP → 縮圖分頁允許多選（上限 30 張、單檔 30 MB），套用同一組尺寸 / 品質 / 格式，逐張下載或打包 ZIP，檔名加尺寸後綴，單張失敗只標示該張；驗收：丟 3 張 JPEG 轉 WebP 寬 800 → ZIP 內 3 檔、寬皆 800、長寬比不變；選 31 張提示上限。
155. **油耗紀錄可編輯**（擴充 utils/fuel-log.html・沿用 `fuel_entries`）：加油紀錄只能刪除，里程或公升數打錯就要刪掉重打，而且刪除會讓油耗重新計算、順序亂掉 → 每筆加「編輯」以 id 覆蓋，重新驗證（里程需大於前一次）並重算各段油耗；驗收：把中間一筆里程由 12000 改 12100 → 前後兩段油耗同步變更、整體平均重算、筆數不變。
156. **倒數日可編輯**（擴充 utils/countdown.html・沿用 `countdown_events`）：help 只有「× 刪除」，日期或名稱寫錯要刪掉重建，附在上面的清單（行李 / 待辦）也會連帶消失 → 每筆加「編輯名稱 / 日期 / 每年重複」，以 id 覆蓋且保留清單；驗收：編輯日期後排序與「還有 N 天」更新、清單項目與勾選狀態不變。
157. **轉盤抽中後移除 + 本次結果記錄**（擴充 fun/wheel.html・結果記錄不存檔）：現在每次轉都從全部選項抽，輪流請客 / 分配任務會重複抽到同一人（同類的 lottery 頁有「已中獎者不再抽」）→ 加勾選「抽中後從本輪移除」與「重置本輪」，並列出本次開啟期間的結果歷史（最多 50 筆，不存檔、不影響 `wheel_items`）；選項剩 1 個時提示本輪結束；驗收：4 個選項勾選後連轉 4 次各不重複，第 5 次提示重置；未勾選時行為與機率不變。
158. **番茄鐘專注時保持螢幕不熄滅**（擴充 fun/pomodoro.html・不存資料或只存一個開關到既有設定）：手機放桌上專注 25 分鐘螢幕會自動鎖屏，鎖屏後 help 自己承認「可能中斷、聽不到提示音」；同站 timers / ticket-clock / kids-routine 已用 Wake Lock，唯獨番茄鐘沒有 → 計時進行中請求 `navigator.wakeLock`（不支援時靜默略過），暫停 / 結束 / 分頁隱藏時釋放，回前景時重取；help 小提醒補一句；驗收：e2e 以 stub 驗證 開始 → request 一次、暫停 → release、visibilitychange 回前景 → 再 request。
159. **節拍器保持螢幕不熄滅**（擴充 fun/metronome.html・不存資料）：練琴時手機放譜架，螢幕鎖掉後節拍就停，而頁面完全沒用 Wake Lock → 播放中請求 Wake Lock，停止 / 隱藏釋放，不支援則略過；驗收：同番茄鐘，stub 驗證 播放 → request、停止 → release。
160. **白噪音可混音並記住設定**（擴充 fun/white-noise.html・新增鍵 `wn_opts`，須宣告 st-keys）：一次只能選一種聲音（雨聲 + 棕噪音這種疊加是最常見用法），且每次開頁都要重選聲音 / 音量 / 定時 → 聲音按鈕改為可複選（最多 3 種，各自 gain 平均），並把「聲音組合、音量、定時分鐘」存到 `wn_opts`（固定一筆小物件，載入驗證型別 / 範圍並容錯，help 說明可用 💾 備份或清除網站資料）；驗收：選雨聲 + 風聲播放時兩種都有輸出、音量滑桿控制總音量；重開頁面還原選擇；`storage_fuzz` 塞壞值不例外。
161. **單字閃卡可反向複習**（擴充 fun/flashcards.html・沿用 `flash_cur`，加一個選填設定欄）：現在固定正面→背面，背誦英文字義的人更需要「看中文想英文」（輸出方向），目前沒有（頁面無 reverse）→ 詞庫或複習畫面加「方向：正→背 / 背→正 / 隨機」，SM-2 進度依方向各自獨立或共用需在 help 說明（建議共用，避免進度翻倍）；驗收：選背→正時畫面先顯示背面文字、評分後排程與正向相同公式；舊資料缺方向欄位預設正→背。
162. **連假行事曆匯出 ICS**（擴充 utils/tw-holidays.html・不存資料）：只有看與列印（頁面無 download / ics），想把今年連假放進手機行事曆要手動逐一建立；同站 countdown / date-calc / todo / trip-kit 都已能匯出 ICS → 「連假清單」加「下載 .ics」，每個連假一個全天事件（起訖正確，DTEND 為最後一天 +1），含補班日（標題註明）；驗收：2026 春節連假事件起訖與頁面清單一致，匯入後天數相同；用 `資料編輯` 覆蓋的日期也反映。
163. **輪值表匯出 ICS**（擴充 utils/duty-roster.html・不新增鍵）：輪值（倒垃圾、值日）只能複製成文字，排好的未來幾期無法進行事曆提醒 → 加「下載 .ics」，每期一個全天事件（標題「輪值：某某」，依目前設定與跳過週末規則，最多 52 期），可選「只匯出某一位」；驗收：每週輪換 4 人匯出 12 期，事件日期與畫面一致、只匯出某人時只含該人的期數。
164. **重訓記錄匯出 CSV**（擴充 fun/workout-log.html・不新增鍵）：頁面完全沒有匯出，資料只能靠整站 JSON 備份，想用試算表看進步或給教練要手抄（同站 health-log / fuel-log / warranty-log 都有 CSV）→ 加「匯出 CSV」：日期 / 動作 / 組序 / 重量 / 次數 / RPE / 預估 1RM / 備註，重量依目前 kg / lb 偏好並標示單位，文字欄做公式注入防護（`'` 前綴）；驗收：2 次訓練各 3 組 → 6 列；備註含 `=SUM(1)` 輸出時被轉義。
165. **習慣打卡匯出 CSV**（擴充 fun/habit-tracker.html・不新增鍵）：每個習慣最多 3700 天紀錄卻無法匯出（頁面無 csv / download），想做年度檢討或換工具帶不走 → 加「匯出 CSV」長表格：習慣名 / 日期 / 完成（勾選型 1、數量型填數值與單位），依日期排序；驗收：兩個習慣各 5 天 → 10 列，數量型列含數值，名稱含逗號 / 引號時正確轉義。
166. **睡眠記錄匯出 CSV**（擴充 fun/sleep-log.html・不新增鍵）：最多 3650 筆但無匯出（頁面無 csv），要拿給醫師或自己分析無法使用 → 加「匯出 CSV」：日期 / 入睡 / 起床 / 時數 / 品質 / 備註；備註做公式注入防護；驗收：跨午夜一筆（23:30 → 07:00）時數 7.5、日期為起床日一致於畫面。
167. **Markdown 預覽可列印 / 存 PDF**（擴充 utils/markdown-preview.html・不存資料）：只有「複製 HTML」與匯出獨立 .html，要出 PDF 得先下載再開檔再印；頁面沒有 `@media print`，直接 Ctrl+P 會連編輯框與工具列一起印 → 加「列印預覽」按鈕與 print CSS：只印預覽區、隱藏工具列與輸入框、程式碼區塊與表格不被切斷（`break-inside: avoid`）；驗收：e2e 用 `emulateMediaType('print')` 檢查編輯框 `display:none`、預覽區可見。
168. **網路計算補 VLSM 子網分配**（擴充 utils/net-calc.html・不存資料）：現有只能把一個網段「平均切成同大小子網」（`splitP`），網管作業與考試常見「依各部門需要的主機數，由大到小從一個大網段分配」做不到 → 在 CIDR 分頁加 VLSM：輸入母網段與多行「名稱 主機數」，輸出每個部門的網段、前綴長度、可用範圍與剩餘空間，空間不足時明確提示；驗收：192.168.1.0/24 要 100 / 50 / 20 / 2 台 → /25、/26、/27、/30 依序不重疊（用 BigInt 檢查無重疊且皆落在母網段內）；超過母網段容量顯示「空間不足」。
169. **貪睡時間可調**（擴充 fun/alarm.html・沿用 `alarms`，設定存在既有鍵或固定一筆）：貪睡固定 5 分鐘（help 與按鈕寫死），有人習慣 10 分鐘 → 響鈴按鈕前的設定可選 5 / 10 / 15 分鐘（預設 5 維持舊行為），貪睡產生的鬧鐘照用該時間並沿用起床任務；載入時缺值 / 非法值退回 5；驗收：選 10 → 貪睡後新增的鬧鐘時間 = 現在 + 10 分鐘；舊資料載入不壞。

## 已知待改進（小項）

- 台灣連假行事曆：2025–2027 已對人事行政總處公告（2026 起無補班）；2027 端午 / 中秋為 `Intl` 推算、官方逐日 PDF 未逐日核對；2028 年以後需等公告再核對。
- 麻將：台數規則各地不同，台數表可編輯；嚦咕只在算台計算機手動勾選，對局不自動偵測；不允許一炮多響。

## 評估後暫不做

- 影片擷取畫面 / 轉 GIF：GIF 編碼器太重、離線體積大。
- 文字轉語音輸出成音檔：瀏覽器無法擷取語音合成的輸出。
- 注音 / 拼音自動標註：需要完整字典，離線體積大。
- PDF 合併 / 分割 / 文字擷取：沒有函式庫時工程量太大（圖片轉 PDF 因只需寫出，列在待做）。
