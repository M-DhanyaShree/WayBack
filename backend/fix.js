const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRaw`UPDATE "User" SET "role" = 'CUSTOMER' WHERE "role" = 'VEHICLE_OWNER';`;
  console.log("Updated users");
}

main().finally(() => prisma.$disconnect());
