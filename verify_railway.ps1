$base = "https://charge-my-ev-backend-production.up.railway.app"
try {
    $h = Invoke-WebRequest -UseBasicParsing -Uri "$base/health" -Method Get
    Write-Host "HEALTH $($h.StatusCode) $($h.Content)"
} catch {
    if ($_.Exception.Response) {
        $r = [int]$_.Exception.Response.StatusCode
        Write-Host "HEALTH $r"
    } else {
        Write-Host "HEALTH_ERR $($_.Exception.Message)"
    }
}

try {
    $ah = Invoke-WebRequest -UseBasicParsing -Uri "$base/api/health" -Method Get
    Write-Host "API_HEALTH $($ah.StatusCode) $($ah.Content)"
} catch {
    if ($_.Exception.Response) {
        $r = [int]$_.Exception.Response.StatusCode
        Write-Host "API_HEALTH $r"
    } else {
        Write-Host "API_HEALTH_ERR $($_.Exception.Message)"
    }
}

$headers = @{'Content-Type'='application/json'}
$bad = @{bookingId='x';confirmerId='u';role='invalid';confirmed=$true} | ConvertTo-Json

try {
    $p = Invoke-WebRequest -UseBasicParsing -Uri "$base/api/payment/confirm" -Method Post -Headers $headers -Body $bad
    Write-Host "PAY $($p.StatusCode) $($p.Content)"
} catch {
    if ($_.Exception.Response) {
        $r = $_.Exception.Response
        $status = [int]$r.StatusCode
        $sr = New-Object IO.StreamReader($r.GetResponseStream())
        $body = $sr.ReadToEnd()
        Write-Host "PAY $status $body"
    } else {
        Write-Host "PAY_ERR $($_.Exception.Message)"
    }
}
