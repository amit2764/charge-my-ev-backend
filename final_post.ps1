$baseUrl = "https://charge-my-ev-backend-production.up.railway.app";
$headers = @{"Content-Type"="application/json"};
$body = '{"bookingId":"b-test-1","raisedBy":"u1","reason":"Other","description":"test dispute","evidenceUrl":""}';
try { $post = Invoke-WebRequest -Uri "$baseUrl/api/disputes" -Method Post -Body $body -Headers $headers -ErrorAction Stop; Write-Host "POST Status: $($post.StatusCode)"; Write-Host $post.Content } catch { Write-Host "POST Failed: $($_.Exception.Message)"; if ($_.Exception.Response) { $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream()); Write-Host "POST Body: $($reader.ReadToEnd())" } }
