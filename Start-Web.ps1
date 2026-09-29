param([int]$Port = 8766)
$ErrorActionPreference = 'Stop'
$webRoot = Join-Path $PSScriptRoot 'web'
# Loopback only; fixed allowlist, no external modules or administrator rights.
$routes = @{
    '/' = @('index.html', 'text/html; charset=utf-8')
    '/index.html' = @('index.html', 'text/html; charset=utf-8')
    '/style.css' = @('style.css', 'text/css; charset=utf-8')
    '/protocol.js' = @('protocol.js', 'text/javascript; charset=utf-8')
    '/app.js' = @('app.js', 'text/javascript; charset=utf-8')
    '/tests.html' = @('tests.html', 'text/html; charset=utf-8')
    '/integration.html' = @('integration.html', 'text/html; charset=utf-8')
}
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Host "Open Chrome: http://localhost:$Port (Ctrl+C to stop)"
try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $stream.ReadTimeout = 2000
            $stream.WriteTimeout = 2000
            $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
            $request = $reader.ReadLine()
            $headerLength = 0
            do {
                $header = $reader.ReadLine()
                $headerLength += $header.Length
                if ($headerLength -gt 8192) { throw 'Headers too long' }
            } while ($header)
            $path = if ($request -match '^GET (/[^ ]*) HTTP/1\.[01]$') { ($Matches[1] -split '\?')[0] } else { '' }
            $route = $routes[$path]
            if ($route) {
                $body = [System.IO.File]::ReadAllBytes((Join-Path $webRoot $route[0]))
                $status = '200 OK'; $type = $route[1]
            } else {
                $body = [System.Text.Encoding]::UTF8.GetBytes('Not found')
                $status = '404 Not Found'; $type = 'text/plain; charset=utf-8'
            }
            $head = [System.Text.Encoding]::ASCII.GetBytes("HTTP/1.1 $status`r`nContent-Type: $type`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nX-Content-Type-Options: nosniff`r`nConnection: close`r`n`r`n")
            $stream.Write($head, 0, $head.Length)
            $stream.Write($body, 0, $body.Length)
            $stream.Flush()
        } catch { Write-Verbose $_ }
        finally { $client.Close() }
    }
} finally { $listener.Stop() }
