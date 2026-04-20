$baseUrl = "https://charge-my-ev-backend-production.up.railway.app/api/promo/validate"
$headers = @{"Content-Type"="application/json"}

Write-Host "--- Test 1: Validating a non-existent code ---"
$body1 = @{ code = "INVALID123" } | ConvertTo-Json
try {
    $resp1 = Invoke-RestMethod -Uri $baseUrl -Method Post -Body $body1 -Headers $headers -ErrorAction Stop
    $resp1 | ConvertTo-Json
} catch {
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.Value__)" -ErrorAction SilentlyContinue
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Response Body: $($reader.ReadToEnd())"
    } else {
        Write-Host "Error: $($_.Exception.Message)"
    }
}

Write-Host "`n--- Test 2: Validating empty code ---"
$body2 = @{ code = "" } | ConvertTo-Json
try {
    $resp2 = Invoke-RestMethod -Uri $baseUrl -Method Post -Body $body2 -Headers $headers -ErrorAction Stop
    $resp2 | ConvertTo-Json
} catch {
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.Value__)" -ErrorAction SilentlyContinue
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Response Body: $($reader.ReadToEnd())"
    } else {
        Write-Host "Error: $($_.Exception.Message)"
    }
}
