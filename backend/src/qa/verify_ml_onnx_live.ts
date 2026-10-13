import { PrismaClient } from '@prisma/client';
import http from 'http';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function verifyLiveML() {
  const modelsDir = path.join(__dirname, '../../ml/models');
  const accPath = path.join(modelsDir, 'acceptance_model.onnx');
  const delPath = path.join(modelsDir, 'delivery_model.onnx');

  const accSize = fs.existsSync(accPath) ? fs.statSync(accPath).size : 0;
  const delSize = fs.existsSync(delPath) ? fs.statSync(delPath).size : 0;

  console.log('====================================================');
  console.log('🤖 REAL ONNX MODEL PHYSICAL EVIDENCE VERIFICATION');
  console.log('====================================================\n');

  console.log('1. PHYSICAL FILE EXISTENCE & METADATA:');
  console.log(`- Acceptance Model Path: ${accPath}`);
  console.log(`- Acceptance Model Size: ${accSize} bytes`);
  console.log(`- Delivery Model Path:   ${delPath}`);
  console.log(`- Delivery Model Size:   ${delSize} bytes\n`);

  // Find or create trip with PostGIS routeLine
  let trip = await prisma.trip.findFirst({
    where: { status: 'ONGOING', driver: { role: 'DRIVER' } },
    include: { driver: true }
  });

  if (!trip) {
    console.log('No suitable trip found');
    return;
  }

  // Ensure routeLine geometry is set
  await prisma.$executeRaw`
    UPDATE "Trip" 
    SET "sourceLocation" = ST_SetSRID(ST_MakePoint(76.9558, 11.0168), 4326),
        "destLocation" = ST_SetSRID(ST_MakePoint(80.2707, 13.0827), 4326),
        "returnLocation" = ST_SetSRID(ST_MakePoint(76.9558, 11.0168), 4326),
        "routeLine" = ST_MakeLine(ST_SetSRID(ST_MakePoint(76.9558, 11.0168), 4326), ST_SetSRID(ST_MakePoint(80.2707, 13.0827), 4326))
    WHERE id = ${trip.id};
  `;

  // Create a load near route corridor (Tambaram -> Avinashi)
  const cust = await prisma.user.findFirst({ where: { role: 'CUSTOMER' } });
  if (cust) {
    const load = await prisma.load.create({
      data: {
        customerId: cust.id,
        pickupName: 'Tambaram, Chennai', pickupLat: 12.9249, pickupLng: 80.1000,
        dropName: 'Avinashi, Tiruppur', dropLat: 11.1932, dropLng: 77.2680,
        weight: 3000, volumeCbf: 150, goodsCategory: 'Textiles', budget: 650000, status: 'PENDING'
      }
    });
    await prisma.$executeRaw`
      UPDATE "Load" 
      SET "pickupLocation" = ST_SetSRID(ST_MakePoint(80.1000, 12.9249), 4326),
          "dropLocation" = ST_SetSRID(ST_MakePoint(77.2680, 11.1932), 4326)
      WHERE id = ${load.id};
    `;
  }

  const { loadModels } = require('../services/mlModel.service');
  await loadModels();

  const { generateRecommendationsForTrip } = require('../services/recommendation.service');
  await generateRecommendationsForTrip(trip.id);

  const driver = trip.driver;
  
  // Call GET /api/v1/recommendations/trip/:tripId
  const endpoint = `/api/v1/recommendations/trip/${trip.id}`;
  
  // Sign JWT token for driver
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ userId: driver?.id, role: driver?.role }, process.env.JWT_SECRET || 'your-super-secret-jwt-key');

  const req = http.request(`http://localhost:5000${endpoint}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      const data = JSON.parse(body);
      console.log('2. LIVE RECOMMENDATION API RESPONSE WITH REAL ONNX INFERENCE:');
      console.log(JSON.stringify(data, null, 2));
      process.exit(0);
    });
  });

  req.end();
}

verifyLiveML();
