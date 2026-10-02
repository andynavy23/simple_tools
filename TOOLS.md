# 工具清單（開發用）

> 給「提新點子 / 要不要新增工具」時查重用。使用者看的簡介在 [README.md](README.md)，這份多了**本機資料鍵**與**連線**欄，用來判斷「這個功能是不是某個工具已經有了」。
>
> **新增、改名或大幅擴充工具時請同步更新本檔**（`node tests/tools.test.js` 會檢查每個頁面都有列在這裡）。

## 新點子怎麼判斷

1. 先在下表找同用途的工具；功能是它的子集或延伸、而且資料在同一個儲存鍵裡 → **擴充既有工具**（指名檔案與要加的分頁），不要另開新檔。
2. 兩個工具都需要的函式 / 樣式，才搬進 `shared/`（見 README「共用模組」）。
3. 都不是才算**新工具**，並在首頁卡片、README、本檔、`tests/tools.test.js` 各補一筆。

## 遊戲輔助

| 工具 | 已有功能 | 本機資料（localStorage） | 連線 |
|---|---|---|---|
| [技能冷卻時間板](game-assist/cooldown-board.html) | 自訂技能冷卻，數字鍵觸發，冷卻完成語音 / 提示音 | `cd_skills`、`cd_opts` |  |
| [經驗效率計算機](game-assist/exp-calculator.html) | 以百分比計算：還需次數、時間、預計完成時刻 | — |  |
| [抽卡機率計算機](game-assist/gacha-calculator.html) | 軟 / 硬保底、UP 與大保底，期望抽數與 50/80/90/99% 抽數 | — |  |
| [困難拉圖斯](game-assist/papulatus.html) | 小怪 / 黑水 / 系統扣時倒數，支援語音與振動 | — |  |
| [團練小工具](game-assist/party.html) | Artale 團練即時同步：經驗追蹤、掉寶統計、生存測試 | `artale_v4_name` | ✓ |
| [RJPQ 門位標記](game-assist/rjpq.html) | 10 層 × 4 門標記，全隊即時共享 | — | ✓ |
| [捲軸期望值計算機](game-assist/scroll-calculator.html) | 算衝捲平均花費與各把握度所需次數，可設定失敗損毀機率 | — |  |

## 小遊戲

| 工具 | 已有功能 | 本機資料（localStorage） | 連線 |
|---|---|---|---|
| [連線海戰](mini-games/battleship.html) | 艦隊只存在自己端；開局送雜湊承諾、賽後揭曉並重算每一槍的回報 | — | ✓ |
| [四子棋](mini-games/connect-four.html) | 本機雙人或連線（房主判定落子），每局輪流先手 | — | ✓ |
| [連線你畫我猜](mini-games/draw-guess.html) | 畫畫或口述（你說我猜）兩種模式；房主判定猜題與計分；題目只傳給畫 / 說的人；筆跡經房主驗證後轉送 | — | ✓ |
| [2048](mini-games/game-2048.html) | 方向鍵 / WASD / 觸控滑動，記錄最高分 | `g2048_best` |  |
| [五子棋](mini-games/gobang.html) | 楓之谷像素風五子棋，本地雙人或房號連線 | — | ✓ |
| [翻牌記憶遊戲](mini-games/memory-match.html) | 單人挑戰最少步數，或連線（最多 4 人，房主驗證）輪流翻牌 | — | ✓ |
| [踩地雷](mini-games/minesweeper.html) | 三種難度、第一步必安全、連鎖展開與快速開格，記錄最佳時間 | — |  |
| [數織 Nonogram](mini-games/nonogram.html) | 5 / 10 / 15 格；出題器用逐行推理驗證可解且唯一；拖曳塗色、標 ✕，記錄最佳時間 | — |  |
| [黑白棋](mini-games/othello.html) | 本機雙人或連線（房主判定）；合法步提示、無子可下自動跳過、雙方無步結算 | — | ✓ |
| [反應速度測試](mini-games/reaction-time.html) | 隨機等待、搶跑偵測、5 次平均，記錄歷史最佳與中位數 | `reaction_best`、`reaction_all` |  |
| [記憶序列 Simon](mini-games/simon.html) | 四色按鈕與音效，越後面越快，記錄最高關卡 | `simon_best` |  |
| [數獨](mini-games/sudoku.html) | 保證唯一解的出題、筆記、提示、衝突標示，記錄最佳時間 | `sudoku_best_<線索數>` |  |
| [打字速度測試](mini-games/typing-test.html) | 中文 / 英文 / 程式碼 / 自訂文章打字測速，每分鐘字數與正確率（自訂文章不記最佳） | `typing_custom` |  |
| [連線終極密碼](mini-games/ultimate-code.html) | 2–8 人；密碼只存在房主端，結束才公布；累計輸的次數 | — | ✓ |

## 趣味

| 工具 | 已有功能 | 本機資料（localStorage） | 連線 |
|---|---|---|---|
| [連線骰子賽跑](fun/board-race.html) | 30 格賽道與前進 / 後退 / 暫停 / 再擲事件格；骰子由房主端擲出 | — | ✓ |
| [骰子工具](fun/dice.html) | 1–6 顆、d4–d100、加成，統計總和分佈（安全亂數） | `dice_history` |  |
| [單字閃卡](fun/flashcards.html) | 多詞庫、簡化版 SM-2 間隔重複（重來 / 困難 / 良好 / 簡單），進度存在本機 | `flash_decks`、`flash_cur` |  |
| [習慣打卡表](fun/habit-tracker.html) | 每日打卡、連續天數、月曆（可補打過去日期） | `habits` |  |
| [連線成語接龍](fun/idiom-chain.html) | 2–8 人；內建 1000+ 成語自動驗證，詞庫外的四字詞由房主裁決；每人 3 命、30 秒限時 | — | ✓ |
| [連線投票 / 搶答](fun/live-poll.html) | 投票（可改選、即時結果）與測驗（單選計分、排行榜），可限時 | — | ✓ |
| [抽獎 / 刮刮樂](fun/lottery.html) | 名單抽 N 位（安全亂數）、已中獎者不再抽、刮刮樂揭曉 | `lottery_won`、`lottery_names` |  |
| [幸運頻道計算機](fun/lucky-channel.html) | 依角色、怪物、日期算今日幸運頻道 | — |  |
| [連線規劃撲克](fun/planning-poker.html) | 費氏數列 / T-shirt 牌組；翻牌前只看得到誰出了牌；平均 / 中位數 / 分佈 | — | ✓ |
| [番茄鐘](fun/pomodoro.html) | 專注 / 休息 / 長休息自動輪替，記錄每日番茄數與專注分鐘，近 7 / 30 天圖表與連續天數 | `pomo_hist`、`pomo_stats` |  |
| [隨機分組 / 抽籤](fun/random-groups.html) | 貼上名單，分成 N 組、每組 M 人，或抽出 K 人 | `groups_names` |  |
| [連線猜拳](fun/rps.html) | 三 / 五 / 七戰制；每局先交換雜湊承諾、兩邊都出完才揭曉並驗證，對手更改選擇會被判作弊 | — | ✓ |
| [簡易畫板](fun/sketchpad.html) | 畫筆 / 橡皮擦、調色盤、手寫筆感壓、復原重做（含清除）、存 PNG | — |  |
| [連線誰是臥底](fun/spy-game.html) | 3–10 人；詞只私下傳給本人；輪流描述（不能含自己的詞）、投票淘汰，7 人以上 2 位臥底 | — | ✓ |
| [計時器 / 碼表](fun/timers.html) | 碼表與分圈、多組倒數（時間戳計算，背景分頁也準） | `timers_defs` |  |
| [待辦清單](fun/todo.html) | 到期日分組（逾期 / 今天 / 明天 / 之後 / 無日期 / 已完成）、組內上下調整、點文字修改 | `todo_items` |  |
| [決策轉盤](fun/wheel.html) | 輸入選項轉盤決定，支援權重，清單自動記住；內建午餐 / 晚餐 / 飲料 / 宵夜 / 週末活動 / 運動常用清單 | `wheel_items` |  |
| [白噪音 / 環境音](fun/white-noise.html) | 即時合成白 / 粉紅 / 棕噪音、雨聲、風聲、機械鍵盤與打字機聲，可定時 | — |  |

## 工具

| 工具 | 已有功能 | 本機資料（localStorage） | 連線 |
|---|---|---|---|
| [進位 / 位元運算工具](utils/base-converter.html) | 2 / 8 / 10 / 16 / 36 進位互轉（BigInt）、位元運算（8–64 位元、二補數）、float32 / float64 拆解 | `base_tab` |  |
| [色彩工具](utils/color-tools.html) | 色碼互轉、配色產生（互補 / 類似 / 三角 / 分裂 / 四角 / 單色 / 漸層）、WCAG 對比度檢查、四種色覺缺陷模擬 | — |  |
| [倒數日 / 紀念日](utils/countdown.html) | 還有 / 已經幾天，可設定每年重複（週年） | `countdown_events` |  |
| [Cron 表達式解析](utils/cron-parser.html) | 5 欄位 cron（* , - / ?、月份星期縮寫、@daily）中文說明與未來 10 次執行時間 | `cron_expr` |  |
| [日期計算機](utils/date-calc.html) | 相差（天 / 週 / 年月日 / 工作日）、加減（含工作日）、星期與 ISO 週次 | `datecalc_tab` |  |
| [編碼解碼](utils/encode-decode.html) | Base64 / URL / Unicode / HTML 實體 / 十六進位；JWT 解析（顯示過期時間，不驗簽）；SHA-1 / 256 / 384 / 512 雜湊 | — |  |
| [記帳本](utils/expense-tracker.html) | 收支分類、月統計、分類佔比；資料只在本機，可匯出 CSV（防公式注入） | `expenses` |  |
| [BMI / 熱量 / 心率計算](utils/health-calc.html) | BMI（台灣標準）、BMR、TDEE、心率區間（含儲備心率法） | — |  |
| [圖片壓縮 / 縮圖 / 轉檔](utils/image-resize.html) | 等比縮放、品質調整、JPEG / PNG / WebP 轉檔；圖片不上傳，重新編碼會移除 EXIF | — |  |
| [JSON 整理器](utils/json-formatter.html) | 美化 / 壓縮 / 驗證、錯誤定位、樹狀檢視 | — |  |
| [貸款 / 複利試算](utils/loan-calculator.html) | 本息 / 本金平均攤還與逐期表；起始本金 + 每月投入的複利成長 | — |  |
| [Markdown 即時預覽](utils/markdown-preview.html) | 標題 / 清單 / 表格 / 程式碼，輸出前消毒，可複製 HTML | `md_src` |  |
| [密碼產生器](utils/password-gen.html) | 以瀏覽器安全亂數在本機產生密碼，可排除易混淆字元 | — |  |
| [QR Code 產生器](utils/qr-code.html) | 自行實作的編碼器（版本 1–40、容錯 L/M/Q/H），可下載 PNG | — |  |
| [正規表示式測試器](utils/regex-tester.html) | 即時標示符合內容、群組與位置 | — |  |
| [薪資 / 加班費試算](utils/salary-calc.html) | 時薪 = 月薪 ÷ 240；平日 / 休息日 / 假日加班費分段倍率；實領概算；113 年度綜合所得稅概算與年終獎金多繳的稅 | `salary_calc` |  |
| [螢幕 / 鍵盤 / 滑鼠測試](utils/screen-test.html) | 全螢幕純色輪播、鍵盤配置逐鍵亮燈、滑鼠按鍵 / 雙擊 / 滾輪偵測 | `screentest_tab` |  |
| [分帳計算](utils/split-bill.html) | 多人多筆支出分帳，轉帳次數最少 | `bill_state` |  |
| [文字差異比對](utils/text-diff.html) | 逐行文字差異比對 | — |  |
| [純文字整理](utils/text-tools.html) | 去重複、排序、刪空行、全半形、大小寫，可復原 | — |  |
| [時區轉換](utils/timezone.html) | 一個時間對照多個城市，處理夏令時間 | `tz_zones` |  |
| [單位與匯率換算](utils/unit-converter.html) | 長度、重量、坪、溫度等單位，以及即時匯率（需連網，有離線快取） | `fx_cache` |  |
| [字數統計 / 閱讀時間](utils/word-count.html) | 中英文分開計算，預估閱讀時間 | `wc_text` |  |

## 閱讀

| 工具 | 已有功能 | 本機資料（localStorage） | 連線 |
|---|---|---|---|
| [摸魚閱讀器](reading/stealth-reader.html) | 本機載入 txt 小說，偽裝 ERP 後台、老闆鍵、進度記憶（開發中） | `erp_settings`、`erp_prog_<書>` |  |

