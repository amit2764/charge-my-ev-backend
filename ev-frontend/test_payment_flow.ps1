$baseUrl = "https://charge-my-ev-backend-production.up.railway.app"
$headers = @{"Content-Type"="application/json"}

Write-Host "--- 1. Request ---"
$reqBody = @{ userId = "u-payment-tester"; location = "12.97,77.59" } | ConvertTo-Json
$req = Invoke-RestMethod -Uri "$baseUrl/api/request" -Method Post -Body $reqBody -Headers $headers
$requestId = $req.requestId
Write-Host "Request ID: $requestId"

Write-Host "--- 2. Respond ---"
$resBody = @{ requestId = $requestId; hostId = "h-pay-test" } | ConvertTo-Json
$res = Invoke-RestMethod -Uri "$baseUrl/api/respond" -Method Post -Body $resBody -Headers $headers
Write-Host "Respond Status: $($res.status)"

Write-Host "--- 3. Book ---"
$bookBody = @{ requestId = $requestId; hostId = "h-pay-test" } | ConvertTo-Json
$bk = Invoke-RestMethod -Uri "$baseUrl/api/book" -Method Post -Body $bookBody -Headers $headers
$bookingId = $bk.bookingId
$startPin = $bk.startPin
$stopPin = $bk.stopPin
Write-Host "Booking ID: $bookingId"

Write-Host "--- 4. Start ---"
if ($startPin) {
    try {
        $startBody = @{ bookingId = $bookingId; pin = $startPin } | ConvertTo-Json
        $st = Invoke-RestMethod -Uri "$baseUrl/api/start" -Method Post -Body $startBody -Headers $headers
        Write-Host "Start: SUCCESS"
    } catch { Write-Host "Start: FAILED ($($_.Exception.Message))" }
}

Write-Host "--- 5. Stop ---"
if ($stopPin) {
    try {
        $stopBody = @{ bookingId = $bookingId; pin = $stopPin } | ConvertTo-Json
        $sp = Invoke-RestMethod -Uri "$baseUrl/api/stop" -Method Post -Body $stopBody -Headers $headers
        Write-Host "Stop: SUCCESS"
    } catch { Write-Host "Stop: FAILED ($($_.Exception.Message))" }
}

Write-Host "--- 6. Confirm Payment ---"
try {
    $confirmBody = @{ bookingId = $bookingId; userId = "u-payment-tester" } | ConvertTo-Json
    $conf = Invoke-WebRequest -Uri "$baseUrl/api/payment/confirm" -Method Post -Body $confirmBody -Headers $headers -ErrorAction Stop
    Write-Host "Confirm Status: $($conf.StatusCode)"
    Write-Host "Confirm Content: $($conf.Content)"
} catch {
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Confirm Status: $($_.Exception.Response.StatusCode.Value__)"
        Write-Host "Confirm Content: $($reader.ReadToEnd())"
    } else {
        Write-Host "Confirm Error: $($_.Exception.Message)"
    }
}

Write-Host "--- 7. Payment Status ---"
try {
    $status = Invoke-RestMethod -Uri "$baseUrl/api/payment/$bookingId/status" -Method Get -Headers $headers
    Write-Host "Status Response: $($status | ConvertTo-Json -Compress)"
} catch { Write-Host "Status Check: FAILED" }
