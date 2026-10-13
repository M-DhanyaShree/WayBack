import { PrismaClient, Role, LoadStatus, TripStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Tamil Nadu logistics data...');

  // 1. Create Users (Customers & Drivers)
  const passwordHash = await bcrypt.hash('password123', 10);

  const customer1 = await prisma.user.upsert({
    where: { email: 'chennai_corp@example.com' },
    update: {},
    create: {
      email: 'chennai_corp@example.com',
      password: passwordHash,
      name: 'Chennai Textiles Ltd',
      role: Role.CUSTOMER,
      profile: {
        create: {
          phone: '9876543210',
          address: 'Guindy Industrial Estate, Chennai, TN',
        }
      }
    }
  });

  const customer2 = await prisma.user.upsert({
    where: { email: 'coimbatore_eng@example.com' },
    update: {},
    create: {
      email: 'coimbatore_eng@example.com',
      password: passwordHash,
      name: 'Coimbatore Auto Parts',
      role: Role.CUSTOMER,
      profile: {
        create: {
          phone: '9876543211',
          address: 'Peelamedu, Coimbatore, TN',
        }
      }
    }
  });

  const driver1 = await prisma.user.upsert({
    where: { email: 'velu_driver@example.com' },
    update: {},
    create: {
      email: 'velu_driver@example.com',
      password: passwordHash,
      name: 'Velu K',
      role: Role.DRIVER,
      profile: {
        create: {
          phone: '9876543212',
          address: 'Madurai, TN',
        }
      }
    }
  });

  const driver2 = await prisma.user.upsert({
    where: { email: 'suresh_driver@example.com' },
    update: {},
    create: {
      email: 'suresh_driver@example.com',
      password: passwordHash,
      name: 'Suresh P',
      role: Role.DRIVER,
      profile: {
        create: {
          phone: '9876543213',
          address: 'Salem, TN',
        }
      }
    }
  });

  console.log('Users created.');

  // 2. Create Vehicles for Drivers
  const vehicle1 = await prisma.vehicle.create({
    data: {
      ownerId: driver1.id,
      registrationNo: 'TN-59-AB-1234',
      type: 'TRUCK',
      make: 'Ashok Leyland',
      model: 'Dost',
      year: 2020,
      capacityWeight: 2500, // 2.5 Tons
      capacityVolume: 10,
    }
  });

  const vehicle2 = await prisma.vehicle.create({
    data: {
      ownerId: driver2.id,
      registrationNo: 'TN-30-CD-5678',
      type: 'TRUCK',
      make: 'Tata',
      model: 'Signa',
      year: 2022,
      capacityWeight: 20000, // 20 Tons
      capacityVolume: 20,
    }
  });

  console.log('Vehicles created.');

  // 3. Create Loads (Pending)
  const now = new Date();
  
  // Load from Chennai to Coimbatore (needs a truck)
  const load1 = await prisma.load.create({
    data: {
      customerId: customer1.id,
      pickupName: 'Guindy, Chennai, Tamil Nadu',
      pickupLat: 13.0067,
      pickupLng: 80.2206,
      dropName: 'Peelamedu, Coimbatore, Tamil Nadu',
      dropLat: 11.0270,
      dropLng: 77.0016,
      weight: 2000, // 2 Tons (Fits in Vehicle 1)
      goodsCategory: 'Textiles',
      budget: 800000, // 8000 INR
      status: LoadStatus.PENDING,
    }
  });

  // Load from Coimbatore to Madurai (return load candidate)
  const load2 = await prisma.load.create({
    data: {
      customerId: customer2.id,
      pickupName: 'Peelamedu, Coimbatore, Tamil Nadu',
      pickupLat: 11.0270,
      pickupLng: 77.0016,
      dropName: 'Mattuthavani, Madurai, Tamil Nadu',
      dropLat: 9.9390,
      dropLng: 78.1450,
      weight: 1500, // 1.5 Tons
      goodsCategory: 'Auto Parts',
      budget: 500000, // 5000 INR
      status: LoadStatus.PENDING,
    }
  });

  // Load from Salem to Chennai
  const load3 = await prisma.load.create({
    data: {
      customerId: customer2.id,
      pickupName: 'Suramangalam, Salem, Tamil Nadu',
      pickupLat: 11.6669,
      pickupLng: 78.1369,
      dropName: 'Sriperumbudur, Chennai, Tamil Nadu',
      dropLat: 12.9723,
      dropLng: 79.9440,
      weight: 15000, // 15 Tons (Fits in Vehicle 2)
      goodsCategory: 'Machinery',
      budget: 1500000, // 15000 INR
      status: LoadStatus.PENDING,
    }
  });

  console.log('Loads created.');

  // 4. Create Active Trips
  // Velu is driving from Chennai to Coimbatore (Active Trip)
  const trip1 = await prisma.trip.create({
    data: {
      driverId: driver1.id,
      vehicleId: vehicle1.id,
      sourceName: 'Guindy, Chennai, Tamil Nadu',
      sourceLat: 13.0067,
      sourceLng: 80.2206,
      destName: 'Peelamedu, Coimbatore, Tamil Nadu',
      destLat: 11.0270,
      destLng: 77.0016,
      returnToName: 'Mattuthavani, Madurai, Tamil Nadu', // Driver wants to go back to Madurai
      returnToLat: 9.9390,
      returnToLng: 78.1450,
      status: TripStatus.ONGOING,
      startedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // Started 2 hours ago
    }
  });

  console.log('Trips created.');
  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
