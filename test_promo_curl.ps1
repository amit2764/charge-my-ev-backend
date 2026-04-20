$baseUrl = "https://charge-my-ev-backend-production.up.railway.app/api/promo/validate"
$headers = @{"Content-Type"="application/json"}

$body1 = @{ code = "INVALID123" } | ConvertTo-Json
$r1 = curl -s -X POST $baseUrl -H "Content-Type: application/json" -d $body1 -i
Write-Host "--- Test 1 (Invalid Code) ---"
$r1

$body2 = @{ code = "" } | ConvertTo-Json
$r2 = curl -s -X POST $baseUrl -H "Content-Type: application/json" -d $body2 -i
Write-Host "--- Test 2 (Empty Code) ---"
$r2
