$base='https://charge-my-ev-backend-production.up.railway.app';
$headers=@{'Content-Type'='application/json'};
$body=@{bookingId='booking_nonexistent_smoketest';confirmerId='u-smoke';role='user';confirmed=$true}|ConvertTo-Json;
try { 
    $r=Invoke-WebRequest -UseBasicParsing -Uri "$base/api/payment/confirm" -Method Post -Headers $headers -Body $body; 
    Write-Host "HTTP: $($r.StatusCode)"; 
    Write-Host "BODY: $($r.Content)" 
} catch { 
    if ($_.Exception.Response) { 
        $resp=$_.Exception.Response; 
        Write-Host "HTTP: $([int]$resp.StatusCode)"; 
        $sr=New-Object IO.StreamReader($resp.GetResponseStream()); 
        Write-Host "BODY: $($sr.ReadToEnd())" 
    } else { 
        Write-Host "ERR: $_" 
    } 
}
try { 
    $s=Invoke-WebRequest -UseBasicParsing -Uri "$base/api/payment/booking_nonexistent_smoketest/status" -Method Get -Headers $headers; 
    Write-Host "STATUS_HTTP: $($s.StatusCode)"; 
    Write-Host "STATUS_BODY: $($s.Content)" 
} catch { 
    if ($_.Exception.Response) { 
        $resp=$_.Exception.Response; 
        Write-Host "STATUS_HTTP: $([int]$resp.StatusCode)"; 
        $sr=New-Object IO.StreamReader($resp.GetResponseStream()); 
        Write-Host "STATUS_BODY: $($sr.ReadToEnd())" 
    } else { 
        Write-Host "STATUS_ERR: $_" 
    } 
}
