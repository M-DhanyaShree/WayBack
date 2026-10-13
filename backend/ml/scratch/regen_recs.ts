import { prisma } from '../../src/server';
import { generateRecommendationsForTrip } from '../../src/services/recommendation.service';
import { loadModels } from '../../src/services/mlModel.service';

async function test() {
  await loadModels();
  
  const trip = await prisma.trip.findFirst();
  if (!trip) {
    console.log('No trip found');
    return;
  }

  console.log(`Re-running recommendations for trip: ${trip.id}`);
  await generateRecommendationsForTrip(trip.id);

  const recs = await prisma.recommendation.findMany({
    where: { tripId: trip.id },
    orderBy: { score: 'desc' }
  });

  console.log(`\nUpdated ${recs.length} recommendations in database:`);
  for (const r of recs) {
    console.log(`- Recommendation ID: ${r.id}`);
    console.log(`  Load ID: ${r.loadId}`);
    console.log(`  Score: ${r.score}`);
    console.log(`  Match Quality: ${r.matchQuality}`);
    console.log(`  Route Overlap: ${r.routeOverlap}`);
    console.log(`  Distance Deviation: ${r.distanceDeviation}`);
    console.log(`  Recommendation Reason:`, JSON.stringify(r.recommendationReason, null, 2));
  }
}

test().finally(() => prisma.$disconnect());
