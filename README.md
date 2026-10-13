# WayBack 🚛

> **Return-Freight Corridor Optimization Platform**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Overview & Problem Statement

In commercial freight transportation, up to **40% of truck journeys are empty-haul return trips** ("deadheading"). After delivering outbound cargo, carriers frequently return to their origin hubs empty due to fragmented brokerage networks, lack of real-time load discovery, and opaque pricing. This causes:
* **Massive fuel and revenue loss** for independent truck drivers and fleet owners.
* **Inflated logistics costs** for shippers and small businesses.
* **Unnecessary carbon emissions** and highway congestion.

**WayBack** solves this crisis by orchestrating an intelligent, bilateral freight matching ecosystem. It continuously scans freight demand corridors, recommends optimal return loads with minimal detour, secures custody with dual cryptographic OTP handovers, provides live GPS tracking with route simulation, and generates statutory electronic consignment waybills complying with Indian and international road transport standards.

---

## Key Features

### 1. Intelligent Return Load Recommendation Engine
* **Corridor & Detour Filtering:** Identifies pending shipments along the return route between the outbound destination and home hub.
* **Hybrid Scoring Architecture:** Combines rule-based heuristic scoring (detour distance, vehicle payload match, driver rating) with an **XGBoost ML model** exported to **ONNX runtime** for sub-millisecond acceptance and delivery probability predictions.

### 2. Bilateral Negotiation & Milestone Escrow
* **Transparent Pricing:** Shippers specify budgets; drivers can accept directly or propose competitive counter-offers.
* **Customer Driver Approval:** Shippers review driver profiles and fleet specifications before confirming bookings.
* **Milestone Freight Settlement:** Customers pay an initial deposit upon confirmation, with remaining balance settled upon verified delivery. No duplicate billing or ambiguous percentages.

### 3. Dual Cryptographic OTP Custody Protocol
* **1st OTP (Pickup Handover):** Shared between customer and driver. The driver enters the OTP provided by the shipper to officially commence the journey and establish physical cargo custody.
* **2nd OTP (Delivery Handover):** Shared between customer and consignee. The driver enters the consignee OTP upon delivery to verify correct recipient handover.

### 4. Real-Time GPS Tracking & Highway Corridor Simulation
* **Live Fleet Telemetry:** WebSocket-powered location broadcast directly to the customer's tracking portal.
* **Interactive Route Simulation:** Real-time driver movement simulation along designated highway corridors, supporting turnaround return trips and origin resets.
* **Turn-by-Turn Geometry:** OpenRouteService integration for accurate driving directions and highway distance calculation.

### 5. Tamper-Proof Proof of Delivery (PoD)
* **Cloudinary Photo Evidence:** Drivers take and upload high-resolution unloading photos directly through the mobile/web interface.
* **Consignee Digital E-Signature:** Touch/mouse-enabled HTML5 canvas capture recording recipient signature upon cargo receipt.

### 6. Complete Trip Dossier & Statutory Consignment Note (Waybill)
* **Carriage by Road Act 2007 Compliance:** Formats trip history into a standardized electronic Consignment Note (Section 10 statutory declaration).
* **Auditable Freight Ledger:** Displays assigned vehicle registration, driver contact details, origin/destination GPS coordinates, dual OTP verification timestamps, unloading photo proof, and invoice settlement ledger.

### 7. Unified Real-Time Collaboration
* **Instant Chat Overlay:** Built-in messaging drawer allowing shippers and drivers to coordinate pickup timings, dock numbers, and transit updates seamlessly.

---

## Architecture

```mermaid
graph TD
    Client[Web Frontend<br/>React + Vite + Tailwind CSS]
    API[Backend API Gateway<br/>Express.js + TypeScript]
    DB[(PostgreSQL + PostGIS<br/>Prisma ORM)]
    ML[ML Inference Engine<br/>ONNX Runtime / XGBoost]
    Socket[Socket.IO Server<br/>Real-Time Telemetry & Chat]
    Cloud[Cloudinary CDN<br/>PoD Media Storage]
    ORS[OpenRouteService<br/>Highway Routing API]

    Client -->|REST API Requests| API
    Client <-->|Bi-directional WebSocket| Socket
    API -->|Data Access Layer| DB
    API -->|Model Evaluation| ML
    API -->|PoD Photos| Cloud
    API -->|Route Polylines| ORS
    Socket <--> API
```

---

## Repository Structure

```text
wayback/
├── backend/                  # Node.js & Express REST API + WebSocket Server
│   ├── src/
│   │   ├── config/           # Database, environment, and logger configurations
│   │   ├── controllers/      # Route controllers (loads, trips, recommendations, payments)
│   │   ├── middlewares/      # Authentication, role verification, and error handlers
│   │   ├── providers/        # Cloudinary, OpenRouteService, and ML ONNX providers
│   │   ├── routes/v1/        # Versioned API routes
│   │   ├── sockets/          # Socket.IO handlers for live tracking and chat
│   │   └── utils/            # Mathematical distance, OTP generators, and helpers
│   ├── prisma/               # Database schema definitions and migration scripts
│   ├── ml/                   # Machine learning pipeline (training scripts, ONNX models)
│   ├── Dockerfile            # Container build specification for backend
│   └── .env.example          # Backend environment variable template
├── frontend/                 # React 18 SPA (Vite + Tailwind CSS + Lucide Icons)
│   ├── src/
│   │   ├── components/       # Reusable UI widgets, navigation, maps, and modals
│   │   ├── context/          # Auth, Socket, and Chat React context providers
│   │   ├── pages/            # Application views (Loads, Trips, Tracking, Dossier, Payments)
│   │   └── lib/              # API fetch clients, socket clients, and utilities
│   ├── Dockerfile            # Container build specification for frontend
│   └── .env.example          # Frontend environment variable template
├── docs/                     # Specifications, QA test reports, and gap analysis
├── docker-compose.yml        
├── .gitignore                # Comprehensive version control ignore rules
├── SETUP.md                  # Step-by-step developer and production setup guide
└── README.md                 # Primary project documentation
```

---

## User Roles & Permissions

| Role | Permissions & Capabilities |
|---|---|
| `CUSTOMER` | Post freight loads, review recommended drivers, negotiate rates, pay milestone deposits, track vehicles live, view Trip Dossiers & Waybills. |
| `DRIVER` | Register commercial trips, view ML-ranked return loads, negotiate bids, verify dual OTPs, simulate/broadcast GPS coordinates, upload PoD proof. |

---

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/M-DhanyaShree/wayback.git
cd wayback
```

### 2. Configure Backend

```bash
cd backend
cp .env.example .env
npm install
```

Configure your PostgreSQL database connection in `backend/.env`:
```env
DATABASE_URL=postgresql://wayback:password@localhost:5432/wayback_db?schema=public
JWT_SECRET=your_jwt_secret_key_min_32_characters
JWT_REFRESH_SECRET=your_jwt_refresh_key_min_32_characters
```

Apply database migrations:
```bash
npx prisma migrate dev --name init
npx prisma generate
npm run dev
```

### 3. Configure Frontend

In a second terminal window:
```bash
cd frontend
npm install
npm run dev
```

The application is available at **http://localhost:5173**.

> 💡 For comprehensive setup instructions, Docker setup, and ML training guides, see the [Setup Guide](SETUP.md).

---

## Docker Deployment

Run the complete multi-service stack with a single command:

```bash
docker compose up --build
```

Services will be accessible at:
* **Frontend:** http://localhost:5173
* **Backend API:** http://localhost:5000
* **PostgreSQL Database:** localhost:5432

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Required |
|---|---|---|
| `PORT` | API server listen port (default: `5000`) | ❌ |
| `DATABASE_URL` | PostgreSQL connection URI | ✅ |
| `JWT_SECRET` | Secret key for signing access tokens | ✅ |
| `JWT_REFRESH_SECRET` | Secret key for signing refresh tokens | ✅ |
| `CLIENT_URL` | Origin URL for CORS configuration | ❌ |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud identifier for PoD images | ❌ |
| `CLOUDINARY_API_KEY` | Cloudinary API Key | ❌ |
| `CLOUDINARY_API_SECRET` | Cloudinary API Secret | ❌ |
| `ORS_API_KEY` | OpenRouteService API key for highway polylines | ❌ |

### Frontend (`frontend/.env`)

| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | Base endpoint for REST API calls | `http://localhost:5000/api/v1` |
| `VITE_SOCKET_URL` | Host URL for Socket.IO connection | `http://localhost:5000` |

---

## Machine Learning Training Pipeline

WayBack includes an automated model retraining pipeline under `backend/ml/`:
1. **Feature Engineering:** Extracts corridor distance, detour ratio, payload utilization, rate per ton-km, and driver trust score.
2. **Model Training:** Trains an **XGBoost Classifier** on historical acceptance outcomes.
3. **ONNX Conversion:** Converts trained models to ONNX format for native execution inside Node.js without Python runtime dependencies.

To retrain models on new interaction data:
```bash
cd backend/ml
python -m venv venv
# Windows: venv\Scripts\activate | Unix: source venv/bin/activate
pip install -r requirements.txt
python training/train.py
```

---

## Security & Data Integrity

* **Dual OTP Verification:** Enforces verified pickup and delivery handovers with time-bound cryptographic tokens.
* **Role-Based Access Control (RBAC):** Strict middleware policies enforce endpoint isolation across roles.
* **Statutory Compliance:** Waybill generation aligns with Section 10 of the Carriage by Road Act 2007.
* **Secure File Handling:** Multipart uploads are filtered, validated, and streamed directly to Cloudinary CDN storage.

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
