$baseUrl = "https://charge-my-ev-backend-production.up.railway.app"
$headers = @{"Content-Type"="application/json"}

$body = @{ userId = "u-payment-tester"; location = @{ latitude = 12.97; longitude = 77.59 } } | ConvertTo-Json
Write-Host "REQ BODY: $body"
try {
    $req = Invoke-RestMethod -Uri "$baseUrl/api/request" -Method Post -Body $body -Headers $headers
    $requestId = $req.requestId
    Write-Host "Request ID: $requestId"

    $resBody = @{ requestId = $requestId; hostId = "h-pay-test" } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/api/respond" -Method Post -Body $resBody -Headers $headers
    Write-Host "Respond Status: $($res.status)"

    $bookBody = @{ requestId = $requestId; hostId = "h-pay-test"; userId = "u-payment-tester" } | ConvertTo-Json
    $bk = Invoke-RestMethod -Uri "$baseUrl/api/book" -Method Post -Body $bookBody -Headers $headers
    $bookingId = $bk.bookingId
    $startPin = $bk.startPin
    $stopPin = $bk.stopPin
    Write-Host "Booking ID: $bookingId"

    if ($startPin) {
        $st = Invoke-RestMethod -Uri "$baseUrl/api/start" -Method Post -Body (@{ bookingId = $bookingId; pin = $startPin } | ConvertTo-Json) -Headers $headers
        Write-Host "Start: SUCCESS"
    }
    if ($stopPin) {
        $sp = Invoke-RestMethod -Uri "$baseUrl/api/stop" -Method Post -Body (@{ bookingId = $bookingId; pin = $stopPin } | ConvertTo-Json) -Headers $headers
        Write-Host "Stop: SUCCESS"
    }

    $confirmBody = @{ bookingId = $bookingId; userId = "u-payment-tester" } | ConvertTo-Json
    try {
        $conf = Invoke-WebRequest -Uri "$baseUrl/api/payment/confirm" -Method Post -Body $confirmBody -Headers $headers
        Write-Host "Confirm Status: $($conf.StatusCode)"
        Write-Host "Confirm Content: $($conf.Content)"
    } catch {
       if ($_.Exception.Response) {
           $stream = $_.Exception.Response.GetResponseStream(); $reader = New-Object System.IO.StreamReader($stream)
           Write-Host "Confirm Status: $($_.Exception.Response.StatusCode.Value__)"
           Write-Host "Confirm Error: $($reader.ReadToEnd())"
       } else { Write-Host "Confirm Failed: $_" }
    }

    $status = Invoke-RestMethod -Uri "$baseUrl/api/payment/$bookingId/status" -Method Get -Headers $headers
    Write-Host "Status Response: $($status | ConvertTo-Json -Compress)"
} catch {
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream(); $reader = New-Object System.IO.StreamReader($stream)
        Write-Host "ERROR Status: $($_.Exception.Response.StatusCode.Value__)"
        Write-Host "ERROR Content: $($reader.ReadToEnd())"
    } else { Write-Host "FATAL: $_" }
}
