# WayBack — Complete Installation & Setup Guide

This guide walks you through setting up and running **WayBack** on your local development machine or using Docker Compose.

---

## 📋 Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Quick Start (Local Development)](#2-quick-start-local-development)
3. [Database Configuration (PostgreSQL)](#3-database-configuration-postgresql)
4. [Backend Configuration & Startup](#4-backend-configuration--startup)
5. [Frontend Configuration & Startup](#5-frontend-configuration--startup)
6. [Machine Learning Engine Setup (Optional)](#6-machine-learning-engine-setup-optional)
7. [Running with Docker Compose](#7-running-with-docker-compose)
8. [End-to-End Workflow Verification](#8-end-to-end-workflow-verification)
9. [Troubleshooting & FAQ](#9-troubleshooting--faq)

---

## 1. Prerequisites

Ensure you have the following installed before beginning:

| Tool | Recommended Version | Purpose |
|---|---|---|
| **Node.js** | `v20.x` or `v22.x` (LTS) | Backend runtime & Frontend build tools |
| **npm** | `v9.x`+ / `v10.x`+ | Package management |
| **PostgreSQL** | `15.x` or `16.x` | Relational database (with PostGIS extension) |
| **Python** | `3.10+` | ML training pipeline (XGBoost, ONNX) |
| **Git** | Latest | Version control |
| **Docker Desktop** | Latest (Optional) | For containerized multi-service deployment |

---

## 2. Quick Start (Local Development)

```bash
# 1. Clone the repository
git clone https://github.com/your-username/wayback.git
cd wayback

# 2. Configure Backend
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npx prisma generate
npm run dev

# 3. Configure Frontend (in a separate terminal)
cd ../frontend
npm install
npm run dev
```

* **Frontend App:** [http://localhost:5173](http://localhost:5173)
* **Backend REST API:** [http://localhost:5000/api/v1](http://localhost:5000/api/v1)
* **API Health Check:** [http://localhost:5000/api/v1/health](http://localhost:5000/api/v1/health)

---

## 3. Database Configuration (PostgreSQL)

### 3.1 Create User and Database

Open `psql` (or your PostgreSQL client):

```bash
psql -U postgres
```

Run the following SQL commands:

```sql
CREATE USER wayback WITH PASSWORD 'password';
CREATE DATABASE wayback_db OWNER wayback;
GRANT ALL PRIVILEGES ON DATABASE wayback_db TO wayback;
\q
```

### 3.2 Verify Database Connection

```bash
psql -U wayback -d wayback_db -h localhost
# Successful connection indicates credentials and database are active. Type \q to exit.
```

---

## 4. Backend Configuration & Startup

### 4.1 Install Backend Dependencies

```bash
cd backend
npm install
```

### 4.2 Configure Environment Variables (`backend/.env`)

Copy the provided example file:

```bash
cp .env.example .env
```

Review and update the variables in `backend/.env`:

```env
NODE_ENV=development
PORT=5000

# PostgreSQL Connection
DATABASE_URL=postgresql://wayback:password@localhost:5432/wayback_db?schema=public

# JWT Security Secrets (Use strong random strings)
JWT_SECRET=super_secret_jwt_access_token_key_32chars_min
JWT_EXPIRES_IN=30m
JWT_REFRESH_SECRET=super_secret_jwt_refresh_token_key_32chars_min
JWT_REFRESH_EXPIRES_IN=7d

# CORS Allowed Origin
CLIENT_URL=http://localhost:5173

# Cloudinary (Required for PoD camera uploads & bill of lading documents)
# Create a free account at https://cloudinary.com/
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# OpenRouteService (Turn-by-turn routing and highway distance geometry)
# Sign up for a free key at https://openrouteservice.org/
ORS_API_KEY=your_ors_api_key
```

### 4.3 Database Migration & Prisma Generation

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 4.4 Start Backend Server

```bash
npm run dev
```

You should see:
```text
info: Database connected successfully
info: Server running on port 5000 in development mode
```

---

## 5. Frontend Configuration & Startup

### 5.1 Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

### 5.2 Optional Environment Configuration (`frontend/.env`)

If running backend on standard `http://localhost:5000`, no configuration is needed. To customize endpoints:

```bash
cp .env.example .env
```

```env
VITE_API_URL=http://localhost:5000/api/v1
VITE_SOCKET_URL=http://localhost:5000
```

### 5.3 Start Frontend Development Server

```bash
npm run dev
```

Visit **http://localhost:5173** in your browser.

---

## 6. Machine Learning Engine Setup (Optional)

WayBack uses a hybrid recommendation system. By default, it operates with **Heuristic Rule-Based Scoring** without requiring Python. Once you have logged interaction data, you can train and activate the XGBoost ML models:

### 6.1 Set Up Python Virtual Environment

```bash
cd backend/ml
python -m venv venv
```

Activate the environment:
* **Windows (PowerShell):** `venv\Scripts\Activate.ps1`
* **macOS / Linux:** `source venv/bin/activate`

### 6.2 Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 6.3 Train the Models

Ensure `DATABASE_URL` is configured in `backend/.env`, then run:

```bash
python training/train.py
```

This trains:
1. **Acceptance Probability Model** (XGBoost → ONNX format)
2. **Delivery Success Model** (XGBoost → ONNX format)
3. Outputs are saved into `backend/ml/models/`

Restarting the backend will automatically load the models:
```text
info: ML: Acceptance model loaded
info: ML: Delivery model loaded
```

---

## 7. Running with Docker Compose

To run the complete platform (PostgreSQL + Backend + Frontend) in isolated Docker containers:

```bash
# From the project root
docker compose up --build
```

| Service | Access URL |
|---|---|
| **Frontend Application** | http://localhost:5173 |
| **Backend API** | http://localhost:5000 |
| **PostgreSQL Database** | localhost:5432 |

To stop the services:
```bash
docker compose down
```

---

## 8. End-to-End Workflow Verification

Test the core features of the platform:

1. **User Registration & Roles:**
   * Register a **Customer** at `/register` (role: `CUSTOMER`).
   * Register a **Driver** in an incognito window (role: `DRIVER`).
2. **Post a Load:**
   * As Customer, go to **Post Load** (`/loads/new`) and enter pickup, delivery, weight, and budget.
3. **Initiate Trip & Get Return Loads:**
   * As Driver, create a new trip (`/trips`) with origin and destination.
   * View the **Smart Return Load Recommendations** ranked by route detour and pricing.
4. **Bilateral Confirmation & Escrow Deposit:**
   * Customer confirms the driver in the **Loads** tab.
   * Driver accepts.
   * Customer pays the initial milestone deposit.
5. **Dual OTP Custody Handover:**
   * **1st OTP (Pickup):** Driver enters customer-provided OTP to start the journey.
   * **Route Simulation:** Use the interactive simulation to track the vehicle in real time.
   * **2nd OTP (Delivery):** Driver enters consignee-provided OTP upon arrival.
6. **Proof of Delivery (PoD):**
   * Driver captures/uploads an unloading photo (Cloudinary) and collects digital signature.
7. **Complete Trip Dossier & Settlement:**
   * Customer views the **Complete Trip Dossier & Statutory Waybill** under `/loads/:id`.
   * Final freight settlement is disbursed.

---

## 9. Troubleshooting & FAQ

### Port 5000 Already In Use (`EADDRINUSE`)
If port 5000 is occupied by another process:
```bash
# Windows (PowerShell)
Get-NetTCPConnection -LocalPort 5000 | Select-Object OwningProcess
Stop-Process -Id <PID> -Force

# macOS / Linux
lsof -i :5000
kill -9 <PID>
```

### PowerShell Execution Policy Error
If running `npm` commands throws a script execution policy error on Windows:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
# Or execute commands via cmd:
cmd /c "npm run dev"
```

### Prisma Client Out of Sync
If schema fields are missing or out of sync:
```bash
cd backend
npx prisma generate
npx prisma migrate dev
```

### Cloudinary Upload Error
Ensure valid Cloudinary credentials are set in `backend/.env`. If omitted, local mock URLs or fallback uploads will be used for testing.
