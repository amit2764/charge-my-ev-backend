$headers = @{"Content-Type"="application/json"}
$uriGet = "https://charge-my-ev-backend-production.up.railway.app/api/disputes/booking/b-test-1"
$uriPost = "https://charge-my-ev-backend-production.up.railway.app/api/disputes"
$body = "{\`"bookingId\`":\`"b-test-1\`",\`"raisedBy\`":\`"u1\`",\`"reason\`":\`"Other\`",\`"description\`":\`"test dispute\`",\`"evidenceUrl\`":\`"\`"}"

Write-Host "--- PowerShell GET ---"
try {
    $r1 = Invoke-WebRequest -Uri $uriGet -Method Get -UseBasicParsing -ErrorAction Stop
    Write-Host "PS_GET_STATUS: $($r1.StatusCode)"
    Write-Host "PS_GET_BODY: $($r1.Content)"
} catch {
    if ($_.Exception.Response) {
        Write-Host "PS_GET_STATUS: $($_.Exception.Response.StatusCode.value__)"
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "PS_GET_BODY: $($reader.ReadToEnd())"
    } else {
        Write-Host "PS_GET_ERROR: $($_.Exception.Message)"
    }
}

Write-Host "`n--- PowerShell POST ---"
try {
    $r2 = Invoke-WebRequest -Uri $uriPost -Method Post -UseBasicParsing -Headers $headers -Body $body -ErrorAction Stop
    Write-Host "PS_POST_STATUS: $($r2.StatusCode)"
    Write-Host "PS_POST_BODY: $($r2.Content)"
} catch {
    if ($_.Exception.Response) {
        Write-Host "PS_POST_STATUS: $($_.Exception.Response.StatusCode.value__)"
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "PS_POST_BODY: $($reader.ReadToEnd())"
    } else {
        Write-Host "PS_POST_ERROR: $($_.Exception.Message)"
    }
}
