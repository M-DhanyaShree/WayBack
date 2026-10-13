/**
 * Real-World Indian Logistics Dynamic Pricing & Cost Engine
 * Calculates dynamic freight rates based on fuel, vehicle wear, driver allowance, tolls, and return-load rebates.
 */

export interface PricingInput {
  distanceKm: number;
  weightKg?: number;
  vehicleType?: 'TRUCK' | 'MINI_TRUCK' | 'PICKUP' | 'TEMPO' | 'VAN' | 'OTHER';
  isReturnTrip?: boolean;
}

export interface PricingBreakdown {
  distanceKm: number;
  fuelExpense: number;        // Direct diesel expense (Distance / Mileage * ₹92.5/L)
  vehicleBaseRent: number;    // Vehicle base rental and maintenance
  wearAndTearCost: number;    // Tyres, oil, maintenance per km
  driverAllowance: number;    // Daily driver bata / food & night halt allowance
  tollEstimate: number;       // National & State Highway toll gate fees
  weightSurcharge: number;    // Cargo weight loading factor
  standardMarketRate: number; // Standard one-way spot market rate
  returnTripDiscount: number; // 20% return rebate (saving deadhead empty run)
  finalEstimatedFare: number; // Final fair transparent rate in ₹
  milestones: {
    assurance10Percent: number; // 10% mandatory booking lock (cancellation deadline)
    minAdvance20Percent: number; // 20% standard diesel advance
    maxAdvance40Percent: number; // 40% maximum permissible advance
    defaultAdvance30Percent: number; // 30% recommended advance
    balanceOnDelivery70Percent: number; // Remaining 70% payable on delivery
  };
}

const DIESEL_PRICE_PER_LITRE = 92.50; // INR

const VEHICLE_SPECS: Record<string, { mileageKmpl: number; baseRent: number; wearPerKm: number; driverDailyBata: number }> = {
  MINI_TRUCK: { mileageKmpl: 12.0, baseRent: 600, wearPerKm: 3.5, driverDailyBata: 400 },
  TEMPO:      { mileageKmpl: 11.0, baseRent: 700, wearPerKm: 4.0, driverDailyBata: 450 },
  PICKUP:     { mileageKmpl: 9.5,  baseRent: 850, wearPerKm: 5.0, driverDailyBata: 500 },
  VAN:        { mileageKmpl: 13.0, baseRent: 500, wearPerKm: 3.0, driverDailyBata: 350 },
  TRUCK:      { mileageKmpl: 5.5,  baseRent: 1600, wearPerKm: 8.5, driverDailyBata: 700 },
  OTHER:      { mileageKmpl: 7.0,  baseRent: 1000, wearPerKm: 6.0, driverDailyBata: 550 },
};

export function calculateDynamicPricing(input: PricingInput): PricingBreakdown {
  const dist = Math.max(5, Number(input.distanceKm) || 20);
  const vType = input.vehicleType || 'PICKUP';
  const specs = VEHICLE_SPECS[vType] || VEHICLE_SPECS.PICKUP;
  const weight = Number(input.weightKg) || 500;

  // 1. Direct Diesel Expense
  const fuelLitres = dist / specs.mileageKmpl;
  const fuelExpense = Math.round(fuelLitres * DIESEL_PRICE_PER_LITRE);

  // 2. Vehicle Wear & Base Depreciation
  const vehicleBaseRent = specs.baseRent;
  const wearAndTearCost = Math.round(dist * specs.wearPerKm);

  // 3. Driver Daily Allowance (bata) - scaled if trip exceeds 300km (multi-day)
  const tripDays = Math.max(1, Math.ceil(dist / 350));
  const driverAllowance = specs.driverDailyBata * tripDays;

  // 4. Highway Toll Estimates (~₹1.8 per km on NH/SH for commercial carriers)
  const tollEstimate = dist > 40 ? Math.round((dist - 30) * 1.75) : 0;

  // 5. Weight surcharge (over 1000kg)
  const weightSurcharge = weight > 1000 ? Math.round(((weight - 1000) / 500) * 250) : 0;

  // 6. Total Standard Market Freight
  const standardMarketRate = Math.round(
    fuelExpense + vehicleBaseRent + wearAndTearCost + driverAllowance + tollEstimate + weightSurcharge
  );

  // 7. Return Load Discount (20% discount for utilizing returning deadhead capacity)
  const isReturn = input.isReturnTrip !== false; // default true for WayBack platform
  const returnTripDiscount = isReturn ? Math.round(standardMarketRate * 0.20) : 0;

  const finalEstimatedFare = Math.max(500, standardMarketRate - returnTripDiscount);

  // 8. Dynamic Milestones
  const assurance10 = Math.round(finalEstimatedFare * 0.10);
  const minAdvance20 = Math.round(finalEstimatedFare * 0.20);
  const defaultAdvance30 = Math.round(finalEstimatedFare * 0.30);
  const maxAdvance40 = Math.round(finalEstimatedFare * 0.40);
  const balance70 = Math.round(finalEstimatedFare - defaultAdvance30);

  return {
    distanceKm: Math.round(dist * 10) / 10,
    fuelExpense,
    vehicleBaseRent,
    wearAndTearCost,
    driverAllowance,
    tollEstimate,
    weightSurcharge,
    standardMarketRate,
    returnTripDiscount,
    finalEstimatedFare,
    milestones: {
      assurance10Percent: assurance10,
      minAdvance20Percent: minAdvance20,
      defaultAdvance30Percent: defaultAdvance30,
      maxAdvance40Percent: maxAdvance40,
      balanceOnDelivery70Percent: balance70,
    }
  };
}
