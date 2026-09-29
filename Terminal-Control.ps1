param(
    [string]$Port = 'COM3',
    [string]$Text = ''
)
$ErrorActionPreference = 'Stop'
$commands = @{
    '左邊開燈' = 'BLUE_ON'
    '右邊開燈' = 'GREEN_ON'
    '左邊關燈' = 'BLUE_OFF'
    '右邊關燈' = 'GREEN_OFF'
    '全部關燈' = 'ALL_OFF'
    '閃爍三次' = 'BLINK_THREE'
    '狀態' = 'STATUS'
}
$sequence = Get-Random -Minimum 100000 -Maximum 1000000000
$serial = [System.IO.Ports.SerialPort]::new($Port, 115200, 'None', 8, 'One')
$serial.ReadTimeout = 300
$serial.WriteTimeout = 2000
$serial.NewLine = "`n"

function Send-Control([string]$Command) {
    $script:sequence++
    $id = [string]$script:sequence
    $serial.DiscardInBuffer()
    $serial.Write("`nV1 $id $Command`n")
    $deadline = [DateTime]::UtcNow.AddSeconds(3)
    while ([DateTime]::UtcNow -lt $deadline) {
        try { $line = $serial.ReadLine().Trim() }
        catch [System.TimeoutException] { continue }
        if ($line -notmatch "^V1 $id (OK|ERROR) AMB82-MINI ([01]) ([01])$") { continue }
        if ($Matches[1] -ne 'OK') { throw '開發板拒絕指令；請輸入「狀態」重新確認。' }
        $blue = $Matches[2] -eq '1'
        $green = $Matches[3] -eq '1'
        $valid = switch ($Command) {
            'BLUE_ON' { $blue }
            'GREEN_ON' { $green }
            'BLUE_OFF' { -not $blue }
            'GREEN_OFF' { -not $green }
            'ALL_OFF' { -not $blue -and -not $green }
            'BLINK_THREE' { -not $blue -and -not $green }
            'STATUS' { $true }
            default { $false }
        }
        if (-not $valid) { throw 'GPIO 回讀與指令不符；請輸入「狀態」重新確認。' }
        $blueLabel = if ($blue) { '亮' } else { '滅' }
        $greenLabel = if ($green) { '亮' } else { '滅' }
        Write-Host "[$(Get-Date -Format HH:mm:ss)] 開發板已確認：左邊藍燈=$blueLabel，右邊綠燈=$greenLabel" -ForegroundColor Green
        return
    }
    throw '回覆逾時，LED 狀態未知（指令可能已執行）。請確認板卡已啟動，再輸入「狀態」。'
}

try {
    if ($Text -and -not $commands.ContainsKey($Text.Trim())) {
        throw '不支援的完整指令，未連接或控制開發板。請輸入「左邊開燈」或「右邊開燈」等指定文字。'
    }
    $serial.Open()
    Write-Host "已開啟 $Port。請勿同時開啟網頁連線或 Arduino 序列監控器。"
    Start-Sleep -Milliseconds 1500
    Send-Control 'STATUS'
    if ($Text) {
        Send-Control $commands[$Text.Trim()]
    } else {
        Write-Host '輸入：左邊開燈、右邊開燈、左邊關燈、右邊關燈、全部關燈、閃爍三次、狀態、離開'
        Write-Host '顯示的是上次開發板 GPIO 回報；要更新請輸入「狀態」。離開不會自動關燈。'
        while ($true) {
            $inputText = Read-Host '指令'
            if ($null -eq $inputText) { break }
            $inputText = $inputText.Trim()
            if ($inputText -eq '離開' -or $inputText -eq 'exit') { break }
            if (-not $commands.ContainsKey($inputText)) {
                Write-Host '不是支援的完整指令，未送出控制，燈光不變。' -ForegroundColor Yellow
                continue
            }
            try { Send-Control $commands[$inputText] }
            catch { Write-Host "通訊失敗／狀態未知：$($_.Exception.Message)" -ForegroundColor Red }
        }
    }
} catch {
    Write-Host "無法完成操作：$($_.Exception.Message)" -ForegroundColor Red
    Write-Host '若 COM 埠被占用，先中斷網頁連線並關閉序列監控器；燒錄後無回應可重新插拔 USB。'
    exit 1
} finally {
    if ($serial.IsOpen) { $serial.Close() }
    $serial.Dispose()
}
