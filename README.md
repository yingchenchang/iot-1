# VoiceRecognitionBlueGreenLEDsBonus

**正式操作方式是使用麥克風說話。** `Terminal-Control.ps1` 只是文字通訊診斷工具，不是語音辨識介面，也不能代替本專案的語音驗收。

在 `iot` 資料夾的 Terminal 執行下列命令啟動網頁（若已啟動則直接開啟網址）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\VoiceRecognitionBlueGreenLEDs\Start-Web.ps1
```

使用電腦版 Chrome 開啟 http://localhost:8766 →「連接開發板」選 COM3 →「開始說話」允許麥克風 → **說出「左邊開燈」或「右邊開燈」**。Terminal 在此只負責啟動介面，不需要輸入燈光口令。

| 需求 | 本專案實作 |
| --- | --- |
| 麥克風語音輸入 | 電腦麥克風，瀏覽器 SpeechRecognition，zh-TW |
| 辨識結果傳送到板卡 | 完整中文口令轉換為 USB 序列控制指令 |
| 操作回饋 | 顯示辨識文字、等待／成功／失敗，以及板卡 GPIO 回讀 |
| 異常處理 | 非指定口令不送控制；拒絕麥克風、無語音、網路／USB 失敗均提示 |
| 硬體確認 | AMB82-MINI；藍 LED_B=23/PF9、綠 LED_G=24/PE6；HIGH 亮、LOW 滅 |

電腦麥克風 → Chrome 語音辨識（zh-TW）→ 完整口令比對 → USB 序列指令 → AMB82-MINI → GPIO 回讀 → 網頁狀態。

本版支援 Windows 電腦版 Chrome，不需要 Wi-Fi 帳密、Node.js、Python 或外部套件。手機版不在本版支援範圍。語音辨識依賴瀏覽器服務，可能需要網際網路並傳送音訊至供應商；USB 控制本身不需要網路。

## 板卡與 LED

使用者已確認實體板卡為 **AMB82-MINI（RTL8735B）**，原交替閃爍程式的兩顆燈可正常亮起。已核對本機 AmebaPro2 `4.1.1-build20260915` 的 `variants/ameba_amb82-mini/variant.h`：

| 口令方位 | LED | Arduino 腳位 | GPIO | 程式控制 |
| --- | --- | --- | --- | --- |
| 左邊 | LED_B 藍燈 | 23 | PF9 | HIGH 開、LOW 關 |
| 右邊 | LED_G 綠燈 | 24 | PE6 | HIGH 開、LOW 關 |

「左右」是語音映射，不代表任意擺放方向下的實體位置。啟動時兩燈關閉；開其中一燈不會自動關掉另一燈。韌體限制選用 AMB82-MINI。

狀態使用開發板 `digitalRead()` 回報，介面不依按鈕或辨識結果猜測。GPIO 回讀證明輸出電位，並不是 LED 發光的光學量測。第一次執行請依下方實測表確認亮滅方向。

本次實體核對：送出 BLUE_ON、回報藍=1／綠=0 時，使用者已確認實際為藍燈亮、綠燈滅。

## 使用方式

### 選用診斷：Terminal 輸入中文指令（不含語音辨識）

在工作區 `iot` 的 Terminal 執行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\VoiceRecognitionBlueGreenLEDs\Terminal-Control.ps1 -Port COM3
```

看到 `指令:` 後輸入 `左邊開燈` 或 `右邊開燈` 並按 Enter。也支援 `左邊關燈`、`右邊關燈`、`全部關燈`、`狀態`、`離開`。這是文字輸入，不使用麥克風；中文由 Terminal 程式轉換成既有韌體協定，不需為此重新燒錄。

使用前先在網頁中斷連線，並關閉 Arduino 序列監控器。亮滅結果僅於收到開發板回覆後顯示，附回報時間；輸入 `狀態` 可重新查詢。輸入其他文字不會改燈。

也可只執行一個口令後離開：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\VoiceRecognitionBlueGreenLEDs\Terminal-Control.ps1 -Port COM3 -Text "左邊開燈"
```

### 網頁語音控制

1. 在 Arduino IDE 開啟 `VoiceRecognitionBlueGreenLEDs.ino`，選擇 **AMB82-MINI** 與板卡 COM 埠，編譯並上傳。序列速率為 **115200**。
2. 關閉 Arduino 序列監控視窗，避免占用連接埠。若板子未執行新程式，按一下 RESET；若仍無回覆，拔除 USB 等 3 秒後重新插入，不要按住 UART_DOWNLOAD。本機燒錄後需重新插拔 USB 才正常執行。
3. 在此專案資料夾開 PowerShell，執行：

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-Web.ps1
   ```

4. 在電腦版 Chrome 開啟 **http://localhost:8766**。保持上述 PowerShell 執行中；Ctrl+C 可停止伺服器。
5. 按「連接開發板」，選 USB 序列埠（此電腦先前為 COM3）。收到符合版本及板型的 STATUS 回覆後才啟用控制。
6. 按「開始說話」，允許麥克風，說出一個口令。網頁顯示辨識文字、傳送結果與板卡回報。

若 8766 已被使用，可加 `-Port 8767` 啟動，並改開 http://localhost:8767。

## 口令

| 語音文字 | 指令 | 效果 |
| --- | --- | --- |
| 左邊開燈 | BLUE_ON | 藍燈亮，綠燈不變 |
| 右邊開燈 | GREEN_ON | 綠燈亮，藍燈不變 |
| 左邊關燈 | BLUE_OFF | 藍燈滅，綠燈不變 |
| 右邊關燈 | GREEN_OFF | 綠燈滅，藍燈不變 |
| 全部關燈 | ALL_OFF | 兩燈滅 |
| 閃爍三次／閃爍3次 | BLINK_THREE | 藍燈、綠燈同步亮 0.3 秒／滅 0.3 秒，共三次，最後兩燈熄滅 |

實機驗證（2026-09-24）：Bonus 韌體已燒錄至 COM3。重新插拔 USB 後送出 `BLINK_THREE`，AMB82-MINI 在約 1.8 秒後回覆 `OK`，GPIO 狀態為藍=0、綠=0，符合三次閃爍後兩燈熄滅的設計。

另接受上表的簡體字版本，以及「藍燈開啟」、「綠燈開啟」。只去除空白和句尾標點後做完整比對，不使用包含關鍵字或模糊配對。「不要左邊開燈」、複合口令與一般聊天不會送出控制指令。辨識服務仍可能聽錯，介面會展示原始文字。

## 通訊與異常處理

USB 序列協定：115200、8N1，以換行結尾。

```text
電腦送出：V1 123 BLUE_ON
板卡回覆：V1 123 OK AMB82-MINI 1 0
讀取狀態：V1 124 STATUS
板卡回覆：V1 124 OK AMB82-MINI 1 0
非法指令：V1 125 INVALID
板卡回覆：V1 125 ERROR AMB82-MINI 1 0
```

最後兩個數字依序為藍／綠 GPIO 回讀，1 表示程式定義的亮、0 表示滅。

- 每次只送一個請求，使用序號配對回覆；其他序號、啟動訊息或錯誤格式不當作成功。
- 2.5 秒未回覆顯示逾時及未知狀態，不自動重送控制。逾時不代表未執行，請讀取狀態確認。
- 閒置時每 3 秒查詢狀態；通訊失敗清除畫面中的亮滅狀態，狀態附有回報時間。
- USB 中斷、麥克風拒絕授權、無語音、辨識服務網路錯誤均提供訊息。
- 韌體使用固定長度緩衝區；過長、非法字元與逾時的半包丟棄到換行，未知指令不寫 GPIO。
- 中斷連線不會自動關燈；需要關燈時先送「全部關燈」。重新啟動開發板則兩燈關閉。

## 驗證

純口令／回覆解析測試：伺服器啟動後開啟 http://localhost:8766/tests.html，應全部顯示 PASS。

網頁整合測試：http://localhost:8766/integration.html，以模擬序列埠與語音事件測試介面，不會控制實體板。

本次驗證（2026-09-24）：韌體編譯通過、官方工具回報燒錄成功；Chrome 18 項口令／協定測試、9 項網頁整合測試、COM3 上 9 項實體板協定／GPIO 測試全部通過。真人麥克風辨識仍需依下方步驟實測。

硬體協定測試：先中斷網頁連線，執行 `powershell -NoProfile -ExecutionPolicy Bypass -File .\Test-Board.ps1 -Port COM3`。此測試會切換兩顆 LED，最後關閉兩燈。

人工驗收：

1. 全部關燈 → 確認實體兩燈滅；左邊開燈 → 僅藍燈亮；右邊開燈 → 兩燈皆亮。
2. 左邊關燈 → 僅綠燈亮；右邊關燈 → 兩燈滅。
3. 以麥克風各說一次左右開燈，核對辨識文字、執行確認和實體燈光。
4. 說「你好」或「不要左邊開燈」→ 不送控制指令，兩燈維持原狀。
5. 拔除 USB → 介面提示通訊失敗／中斷，狀態改為未知；重插後重新連線。
6. 拒絕麥克風權限或停用網路 → 顯示辨識錯誤，不送控制指令。

## 參考文件

- [Realtek AMB82-MINI 官方入門文件：板卡及腳位](https://www.amebaiot.com.cn/en/amebapro2-amb82-mini-arduino-getting-started/)
- [MDN SpeechRecognition：瀏覽器支援及雲端辨識限制](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
- [MDN Web Serial API：瀏覽器與安全環境要求](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
