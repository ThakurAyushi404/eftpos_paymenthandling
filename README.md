# Payment Handling (Donation Kiosk)

This repository contains a JavaScript module for handling payment and donation transactions in a kiosk application.  
It manages creating donations, processing EFTPOS payments, polling transaction status, and printing receipts securely via REST APIs.

---

## 🚀 Features
- Create Orders records and link them with customer details
- Handle EFTPOS payment processing
- Dynamic machine display modal with action buttons
- Real-time status polling for transactions
- Automatic receipt printing via API
- Timeout handling for API requests
- Modular functions for easy integration

---

## 📂 File Overview
- **paymenthandling.js** – Core JavaScript file containing:
  - `createDonation()` – Creates a new order entry  
  - `processDonationPayment()` – Initiates EFTPOS payment  
  - `pollEftposStatus()` – Polls status until completion  
  - `updateModal()` – Dynamically updates payment modal  
  - `fetchReceiptSettings()` – Retrieves receipt settings  
  - `printReceipt()` – Sends print request to API  
  - Event handlers for retry/cancel buttons

---

## 🔐 Security
- Uses `Authorization` headers with Basic Auth for API requests.
- Implements **request timeouts** and **error handling**.
- Sensitive data like `baseURL`, `kioskGuid`, and `key` are **not included** in this repo.  
- Ensure these credentials are stored securely (e.g., environment variables or server config).

---

## 📦 Installation
Clone this repository:
```bash
git clone https://github.com/ThakurAyushi404/paymenthandling.git
