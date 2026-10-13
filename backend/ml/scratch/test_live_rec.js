const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const http = require('http');

const prisma = new PrismaClient();

async function main() {
  const trip = await prisma.trip.findFirst();
  if (!trip) {
    console.log('No trip found.');
    return;
  }
  const driver = await prisma.user.findUnique({ where: { id: trip.driverId } });
  
  const token = jwt.sign(
    { userId: driver.id, role: driver.role },
    process.env.JWT_SECRET || 'dadc4f28-9e2d-4cce-9ca3-cfd2066f7330',
    { expiresIn: '1h' }
  );

  console.log(`Trip ID: ${trip.id}, Driver ID: ${driver.id}`);

  const options = {
    hostname: 'localhost',
    port: 5000,
    path: `/api/v1/recommendations/trip/${trip.id}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('HTTP Status:', res.statusCode);
      console.log('Raw Data:', data);
    });
  });

  req.on('error', (e) => console.error(e));
  req.end();
}

main().finally(() => prisma.$disconnect());
