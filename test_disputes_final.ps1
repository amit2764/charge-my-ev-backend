$headers = @{"Content-Type"="application/json"}
$uriGet = "https://charge-my-ev-backend-production.up.railway.app/api/disputes/booking/b-test-1"
$uriPost = "https://charge-my-ev-backend-production.up.railway.app/api/disputes"
$body = "{\`"bookingId\`":\`"b-test-1\`",\`"raisedBy\`":\`"u1\`",\`"reason\`":\`"Other\`",\`"description\`":\`"test dispute\`",\`"evidenceUrl\`":\`"\`"}"

Write-Host "--- PowerShell GET ---"
try {
    $r1 = Microsoft.PowerShell.Commands\Invoke-WebRequest -Uri $uriGet -Method Get -UseBasicParsing -ErrorAction Stop
    Write-Host "Status: $($r1.StatusCode)"
    Write-Host "Body: $($r1.Content)"
} catch {
    if ($_.Exception.Response) {
        Write-Host "Status: $($_.Exception.Response.StatusCode.value__)"
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Body: $($reader.ReadToEnd())"
    } else {
        Write-Host "Error: $($_.Exception.Message)"
    }
}

Write-Host "`n--- PowerShell POST ---"
try {
    $r2 = Microsoft.PowerShell.Commands\Invoke-WebRequest -Uri $uriPost -Method Post -UseBasicParsing -Headers $headers -Body $body -ErrorAction Stop
    Write-Host "Status: $($r2.StatusCode)"
    Write-Host "Body: $($r2.Content)"
} catch {
    if ($_.Exception.Response) {
        Write-Host "Status: $($_.Exception.Response.StatusCode.value__)"
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Body: $($reader.ReadToEnd())"
    } else {
        Write-Host "Error: $($_.Exception.Message)"
    }
}
