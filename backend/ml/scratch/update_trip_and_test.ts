import { prisma } from '../../src/server';
import { generateRecommendationsForTrip } from '../../src/services/recommendation.service';
import { loadModels } from '../../src/services/mlModel.service';

async function main() {
  await loadModels();
  
  const tripId = '0c48c7f4-adcf-43a5-9623-fe347742c9d7';
  
  // Update availableWeight to vehicle capacity
  await prisma.trip.update({
    where: { id: tripId },
    data: { availableWeight: 9999.63 }
  });
  console.log('Trip availableWeight updated to 9999.63 kg.');

  // Generate recommendations
  await generateRecommendationsForTrip(tripId);

  const recs = await prisma.recommendation.findMany({
    where: { tripId },
    include: { load: true },
    orderBy: { score: 'desc' }
  });

  console.log(`\nGenerated ${recs.length} recommendations for Trip:`);
  for (const r of recs) {
    console.log(`\n--- Recommendation ---`);
    console.log(`Load: ${r.load.goodsCategory} (${r.load.weight} kg)`);
    console.log(`Pickup: ${r.load.pickupName} -> Drop: ${r.load.dropName}`);
    console.log(`Score: ${r.score} | Match Quality: ${r.matchQuality}`);
    console.log(`Route Overlap: ${r.routeOverlap} | Distance Deviation: ${r.distanceDeviation} km`);
    console.log(`Reason:`, JSON.stringify(r.recommendationReason, null, 2));
  }
}

main().finally(() => prisma.$disconnect());
