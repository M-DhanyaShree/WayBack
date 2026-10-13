import { prisma } from '../../src/server';
import { generateAccessToken } from '../../src/utils/jwt';
import http from 'http';

async function main() {
  const tripId = '0c48c7f4-adcf-43a5-9623-fe347742c9d7';
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) {
    console.log('Trip not found');
    return;
  }

  const driver = await prisma.user.findUnique({ where: { id: trip.driverId } });
  if (!driver) {
    console.log('Driver not found');
    return;
  }

  const token = generateAccessToken({ userId: driver.id, role: driver.role });
  console.log(`Testing GET /api/v1/recommendations/trip/${tripId} as Driver ${driver.name} (${driver.id})`);

  const req = http.request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/v1/recommendations/trip/${tripId}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('HTTP Status:', res.statusCode);
      const parsed = JSON.parse(data);
      console.log('API Status:', parsed.status);
      const recs = parsed.data?.recommendations || [];
      console.log(`Total Recommendations: ${recs.length}`);
      recs.forEach((r: any, idx: number) => {
        console.log(`\n#${idx + 1} Load: ${r.load.goodsCategory} (${r.load.weight} kg) | Score: ${r.score} | Match: ${r.matchQuality}`);
        console.log(`   Pickup: ${r.load.pickupName}`);
        console.log(`   Drop:   ${r.load.dropName}`);
        console.log(`   ML Reason:`, r.recommendationReason);
      });
    });
  });

  req.on('error', e => console.error(e));
  req.end();
}

main().finally(() => prisma.$disconnect());
