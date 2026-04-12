# EV Charging Platform Test Cases

## Overview
This document defines test cases for the EV charging system, covering the backend and frontend features. It includes normal flows, edge cases, and failure scenarios.

---

## 1. Normal Flow

### 1.1 User Authentication
- **Case**: Send OTP request
  - Input: valid phone number
  - Expected: success response, OTP delivered, session data saved or mock mode accepted
- **Case**: Verify OTP
  - Input: valid phone number and OTP
  - Expected: success response, user authenticated

### 1.2 Request Charging
- **Case**: Create charging request with location and vehicle type
  - Input: valid userId, valid location coordinates, valid vehicleType
  - Expected: 201 response, request created with status OPEN and stored in database/mock mode

### 1.3 Matching Hosts
- **Case**: Fetch nearby chargers
  - Input: valid lat/lng and radius
  - Expected: success response with sorted station list, distances in km, price per hour

### 1.4 Booking a Station
- **Case**: Create booking after host selection
  - Input: valid userId, hostId, chargerId, price
  - Expected: 201 response, booking created with status PENDING or CONFIRMED

### 1.5 Charging Session
- **Case**: Start charging session
  - Input: bookingId and valid OTP
  - Expected: success response, session marked as active or started
- **Case**: Stop charging session
  - Input: bookingId and valid OTP
  - Expected: success response, final billing calculated, session stopped

### 1.6 Payment Confirmation
- **Case**: Confirm online payment
  - Input: select "I Paid"
  - Expected: status message acknowledges payment confirmation
- **Case**: Confirm cash payment
  - Input: select "Cash Received"
  - Expected: status message acknowledges cash confirmation

### 1.7 Trust Score
- **Case**: Calculate trust score
  - Input: valid completionRate, cancellationRate, averageRating
  - Expected: success response with trustScore and trustLevel
- **Case**: Create/Update trust profile
  - Input: userId with valid metrics
  - Expected: success response, profile persisted

---

## 2. Edge Cases

### 2.1 Geolocation and UI
- **Case**: Location access denied
  - Input: user rejects browser location request
  - Expected: error message shown, user can retry location request
- **Case**: Slow location response
  - Input: location request times out
  - Expected: timeout error displayed, allow retry

### 2.2 Charging Request
- **Case**: Very close radius search
  - Input: small radius (e.g. 0.1 km)
  - Expected: returns only stations within range or empty list
- **Case**: No charging stations available
  - Input: valid location with no stations in radius
  - Expected: empty result with user-friendly messaging

### 2.3 Timer / Cost Calculation
- **Case**: Start/stop quickly
  - Input: start then stop within one second
  - Expected: timer shows `00:00:01` or `00:00:00`, cost updates correctly
- **Case**: Long running session
  - Input: timer runs for multiple minutes/hours
  - Expected: formatted timer remains valid, cost updates every second

### 2.4 Payment Confirmation
- **Case**: Repeated confirmations
  - Input: click "I Paid" then "Cash Received"
  - Expected: UI updates to latest selected confirmation, no duplicate submission state
- **Case**: No action taken
  - Input: user visits page but does not confirm
  - Expected: prompt remains visible and state stays unchanged

### 2.5 Backend Validation
- **Case**: Location fields missing
  - Input: request payload without location or incomplete location
  - Expected: 400 response with validation error
- **Case**: invalid vehicle type
  - Input: vehicleType not in allowed list
  - Expected: 400 response with validation failure

---

## 3. Failure Scenarios

### 3.1 Invalid Input
- **Case**: Invalid OTP
  - Input: wrong OTP code
  - Expected: 400 response with authentication failure
- **Case**: Invalid coordinates
  - Input: latitude 999, longitude -999
  - Expected: 400 response with invalid coordinate error
- **Case**: Negative or non-numeric cost
  - Input: invalid price when booking
  - Expected: 400 response with validation error

### 3.2 Backend Errors
- **Case**: Database unavailable
  - Input: valid request but Firestore unavailable
  - Expected: 500 response, error message indicates internal server error
- **Case**: Missing required fields
  - Input: API call without required body fields
  - Expected: 400 response, clear field requirement error

### 3.3 Network/Connectivity
- **Case**: API request fails from frontend
  - Input: network disconnect while submitting request
  - Expected: UI shows error message and allows retry
- **Case**: Timeout during location lookup
  - Input: geolocation service fails to respond
  - Expected: timeout error, prompt to retry or check settings

### 3.4 UX Failure Conditions
- **Case**: Button disabled state
  - Input: click `Start` when already running
  - Expected: button disabled, no duplicate intervals created
- **Case**: Cost incorrectly displayed after stop
  - Input: stopping session should keep final cost displayed
  - Expected: final amount remains visible and timer stops updating

---

## 4. Suggested Automated Tests

### Backend
- Verify all endpoint validation logic in `src/app.js`
- Test `createChargingRequest`, `getNearbyChargers`, `createBooking`, `startCharging`, `stopCharging` flows
- Test trust score calculator with boundary values

### Frontend
- Validate `RequestCharging` component handles location permission, selection, and submission
- Validate `Matching` component renders station cards, fetches API data, and selects host correctly
- Validate `Charging` component updates timer and running cost every second
- Validate `PaymentConfirmation` component updates state for both confirmation buttons

---

## 5. Test Case Matrix

| Area | Scenario | Type | Expected Outcome |
|------|----------|------|------------------|
| Authentication | Valid OTP | Normal | Success login |
| Charging Request | Valid request | Normal | Request created |
| Matching | Nearby stations found | Normal | Stations list returned |
| Charging | Start timer | Normal | Timer increments every second |
| Charging | Stop timer | Normal | Timer stops, cost freezes |
| Payment | I Paid selected | Normal | Payment confirmed |
| Payment | Cash Received selected | Normal | Cash confirmed |
| Charging Request | Missing vehicle type | Edge | validation error |
| Matching | No stations | Edge | empty state message |
| Charging | Location denied | Failure | error shown, retry option |
| Payment | No action taken | Edge | prompt stays visible |
| Backend | Invalid coordinates | Failure | 400 response |
| Backend | DB failure | Failure | 500 response |

---

## 6. Notes
- Adjust `totalAmount` and `costPerHour` values to match actual pricing logic.
- Add automation around both UI interaction flows and backend validation logic.
- Use frontend state tests and backend API tests to cover both user-facing and system-level behavior.
