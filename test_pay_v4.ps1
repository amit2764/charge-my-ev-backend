$baseUrl = "https://charge-my-ev-backend-production.up.railway.app"
$headers = @{"Content-Type"="application/json"}
$body = '{"userId":"u-payment-tester","location":{"lat":12.97,"lng":77.59}}'
Write-Host "REQ BODY: $body"
try {
    $req = Invoke-WebRequest -Uri "$baseUrl/api/request" -Method Post -Body $body -Headers $headers
    $reqJson = $req.Content | ConvertFrom-Json
    $requestId = $reqJson.requestId
    Write-Host "Request ID: $requestId"

    $resBody = "{\`"requestId\`":\`"$requestId\`",\`"hostId\`":\`"h-pay-test\`"}"
    Invoke-RestMethod -Uri "$baseUrl/api/respond" -Method Post -Body $resBody -Headers $headers

    $bookBody = "{\`"requestId\`":\`"$requestId\`",\`"hostId\`":\`"h-pay-test\`",\`"userId\`":\`"u-payment-tester\`"}"
    $bk = Invoke-RestMethod -Uri "$baseUrl/api/book" -Method Post -Body $bookBody -Headers $headers
    $bookingId = $bk.bookingId
    Write-Host "Booking ID: $bookingId"

    $confirmBody = "{\`"bookingId\`":\`"$bookingId\`",\`"userId\`":\`"u-payment-tester\`"}"
    $conf = Invoke-WebRequest -Uri "$baseUrl/api/payment/confirm" -Method Post -Body $confirmBody -Headers $headers
    Write-Host "Confirm Status: $($conf.StatusCode)"
    Write-Host "Confirm Content: $($conf.Content)"
    
    $status = Invoke-RestMethod -Uri "$baseUrl/api/payment/$bookingId/status" -Method Get -Headers $headers
    Write-Host "Payment Status: $($status | ConvertTo-Json -Compress)"
} catch {
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream(); $reader = New-Object System.IO.StreamReader($stream)
        Write-Host "ERROR Status: $($_.Exception.Response.StatusCode.Value__)"
        Write-Host "ERROR Content: $($reader.ReadToEnd())"
    } else { Write-Host "FATAL: $_" }
}
