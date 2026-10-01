# Simple Tools

一個人的網頁小工具箱：有想法就做一個，純靜態、免安裝、即開即用，部署在 GitHub Pages。

👉 **[前往工具箱](https://andynavy23.github.io/simple_tools/)**

## 工具一覽

| 工具 | 分類 | 說明 |
| --- | --- | --- |
| [團練小工具](game-assist/party.html) | 遊戲輔助 | Artale 團練即時同步：經驗追蹤、掉寶統計、生存測試 |
| [困難拉圖斯](game-assist/papulatus.html) | 遊戲輔助 | 小怪 / 黑水 / 系統扣時倒數，支援語音與振動 |
| [RJPQ 門位標記](game-assist/rjpq.html) | 遊戲輔助 | 10 層 × 4 門標記，全隊即時共享 |
| [五子棋](mini-games/gobang.html) | 小遊戲 | 楓之谷像素風五子棋，本地雙人或房號連線 |
| [幸運頻道計算機](fun/lucky-channel.html) | 趣味 | 依角色、怪物、日期算今日幸運頻道 |
| [決策轉盤](fun/wheel.html) | 趣味 | 輸入選項轉盤決定，支援權重，清單自動記住 |
| [番茄鐘](fun/pomodoro.html) | 趣味 | 專注 / 休息 / 長休息自動輪替，記錄今日番茄數 |
| [純文字整理](utils/text-tools.html) | 工具 | 去重複、排序、刪空行、全半形、大小寫，可復原 |
| [摸魚閱讀器](reading/stealth-reader.html) | 閱讀 | 本機載入 txt 小說，偽裝 ERP 後台、老闆鍵、進度記憶（開發中） |

## 專案結構

```text
index.html              工具箱首頁（只負責導覽，分類與搜尋自動依卡片產生）
game-assist/ mini-games/ fun/ utils/ reading/
                        資料夾 = 首頁分類（遊戲輔助 / 小遊戲 / 趣味 / 工具 / 閱讀），
                        每個工具一支獨立 HTML，CSS / JS 內嵌，工具間互不共用
assets/<game>/          遊戲素材圖片（例如 assets/artale/，供 og:image 使用）
assets/og-image.*       首頁分享預覽圖（og-image.html 為來源，以 Edge headless 截圖成 PNG）
temp_*                  開發中的暫存檔，已被 .gitignore 忽略
```

## 新增工具

1. 依分類新增 `<category>/your-tool.html`（自成一體，不依賴其他工具）。
2. 在 `index.html` 複製一張 `<a class="card">`，改連結、`data-cat`、圖示色與文案，分類按鈕會自動出現。
3. 在上方表格補一列。

想先在本機試寫，檔名用 `temp_` 開頭就不會被提交。

## 本機使用

直接開啟 `index.html` 即可；連線功能（PeerJS）與部分字型 / 套件來自 CDN，需要網路。

## 支持

- **ERC20 / Polygon**: `0x390634EfA0f3a4B083572a19B9D17063027feFb6`
- **BSC**: `0x050cC207ba7e1074a95F266D978703Ce332A4cA8`
- [請我喝珍奶](https://awfu.bobaboba.me)

## 授權

[MIT License](LICENSE)
