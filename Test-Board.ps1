param([string]$Port = 'COM3')
$ErrorActionPreference = 'Stop'
$serial = [System.IO.Ports.SerialPort]::new($Port, 115200, 'None', 8, 'One')
$serial.ReadTimeout = 3000
$serial.WriteTimeout = 2000
$serial.NewLine = "`n"
function Assert-Reply([string]$Id, [string]$Command, [string]$Expected) {
    $serial.DiscardInBuffer()
    $serial.Write("`nV1 $Id $Command`n")
    $deadline = [DateTime]::UtcNow.AddSeconds(4)
    do {
        $line = $serial.ReadLine().Trim()
        if ($line.StartsWith("V1 $Id ")) {
            if ($line -ne "V1 $Id $Expected") { throw "Unexpected reply: $line" }
            Write-Output "PASS $Command => $line"
            return
        }
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "No matching reply for $Command"
}
try {
    $serial.Open()
    Start-Sleep -Seconds 2
    Assert-Reply '1' 'ALL_OFF' 'OK AMB82-MINI 0 0'
    Assert-Reply '2' 'BLUE_ON' 'OK AMB82-MINI 1 0'
    Assert-Reply '3' 'GREEN_ON' 'OK AMB82-MINI 1 1'
    Assert-Reply '4' 'BLUE_OFF' 'OK AMB82-MINI 0 1'
    Assert-Reply '41' 'BLINK_THREE' 'OK AMB82-MINI 0 0'
    Assert-Reply '42' 'GREEN_ON' 'OK AMB82-MINI 0 1'
    Assert-Reply '5' 'INVALID' 'ERROR AMB82-MINI 0 1'
    Assert-Reply '6' 'STATUS' 'OK AMB82-MINI 0 1'
    $serial.Write(('X' * 100) + "V1 7 ALL_OFF`n")
    Assert-Reply '8' 'STATUS' 'OK AMB82-MINI 0 1'
    Assert-Reply '9' 'GREEN_OFF' 'OK AMB82-MINI 0 0'
    Assert-Reply '10' 'ALL_OFF' 'OK AMB82-MINI 0 0'
} finally {
    if ($serial.IsOpen) { $serial.Close() }
    $serial.Dispose()
}
