$uri = 'https://charge-my-ev-backend-production.up.railway.app/health'
try {
    $res = Invoke-RestMethod -Uri $uri -Method Get
    Write-Host 'HEALTH:' ($res | ConvertTo-Json -Compress)
} catch {
    Write-Host 'HEALTH_ERR:' $_.Exception.Message
}

$uri2 = 'https://charge-my-ev-backend-production.up.railway.app/api/health'
try {
    $res2 = Invoke-RestMethod -Uri $uri2 -Method Get
    Write-Host 'API_HEALTH:' ($res2 | ConvertTo-Json -Compress)
} catch {
    Write-Host 'API_HEALTH_ERR:' $_.Exception.Message
}

$uri3 = 'https://charge-my-ev-backend-production.up.railway.app/api/payment/confirm'
$body = @{bookingId='x';confirmerId='u';role='invalid';confirmed=$true} | ConvertTo-Json
try {
    $res3 = Invoke-RestMethod -Uri $uri3 -Method Post -Body $body -ContentType 'application/json'
    Write-Host 'PAYMENT:' ($res3 | ConvertTo-Json -Compress)
} catch {
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object IO.StreamReader($stream)
        $respBody = $reader.ReadToEnd()
        Write-Host 'PAYMENT_ERR:' ([int]$_.Exception.Response.StatusCode) $respBody
    } else {
        Write-Host 'PAYMENT_FAIL:' $_.Exception.Message
    }
}
