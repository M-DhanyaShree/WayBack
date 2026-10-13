/*
  Warnings:

  - The values [VEHICLE_OWNER] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `outcome` on the `Recommendation` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('PENDING', 'NEGOTIATING', 'RESERVED', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "FlexibilityLevel" AS ENUM ('STRICT', 'BALANCED', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "ReturnIntent" AS ENUM ('YES', 'NO', 'NOT_SURE');

-- CreateEnum
CREATE TYPE "MatchQuality" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('AVAILABLE', 'BUSY', 'OFFLINE', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "LoadSchedulingType" AS ENUM ('IMMEDIATE', 'SCHEDULED');

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'DRIVER', 'CUSTOMER');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
COMMIT;

-- AlterTable
ALTER TABLE "Load" ADD COLUMN     "dropLocation" geometry(Point, 4326),
ADD COLUMN     "pickupLocation" geometry(Point, 4326),
ADD COLUMN     "pickupWindowEnd" TIMESTAMP(3),
ADD COLUMN     "pickupWindowStart" TIMESTAMP(3),
ADD COLUMN     "schedulingType" "LoadSchedulingType" NOT NULL DEFAULT 'IMMEDIATE';

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "addressProofUrl" TEXT,
ADD COLUMN     "historicalAcceptanceRate" DOUBLE PRECISION DEFAULT 0.0,
ADD COLUMN     "idProofUrl" TEXT,
ADD COLUMN     "licenseUrl" TEXT,
ADD COLUMN     "reliabilityScore" DOUBLE PRECISION DEFAULT 5.0,
ADD COLUMN     "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Recommendation" DROP COLUMN "outcome",
ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "categoryMatchScore" DOUBLE PRECISION,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "concession" INTEGER,
ADD COLUMN     "custReliability" DOUBLE PRECISION,
ADD COLUMN     "driverHistAccRate" DOUBLE PRECISION,
ADD COLUMN     "expectedEarning" INTEGER,
ADD COLUMN     "matchQuality" "MatchQuality" NOT NULL DEFAULT 'FAIR',
ADD COLUMN     "proposedPrice" INTEGER,
ADD COLUMN     "recommendationReason" JSONB,
ADD COLUMN     "regionMatchScore" DOUBLE PRECISION,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "reservationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "returnDateGapHours" DOUBLE PRECISION,
ADD COLUMN     "status" "RecommendationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "terms" TEXT,
ADD COLUMN     "vehicleUtilScore" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "customerDeliveryConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "customerESignatureUrl" TEXT,
ADD COLUMN     "deliveryProofPhotoUrl" TEXT,
ADD COLUMN     "destLocation" geometry(Point, 4326),
ADD COLUMN     "driverDeliveryConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "flexibilityOverride" "FlexibilityLevel",
ADD COLUMN     "returnIntent" "ReturnIntent",
ADD COLUMN     "returnLocation" geometry(Point, 4326),
ADD COLUMN     "returnToLat" DOUBLE PRECISION,
ADD COLUMN     "returnToLng" DOUBLE PRECISION,
ADD COLUMN     "returnToName" TEXT,
ADD COLUMN     "returnWindowEnd" TIMESTAMP(3),
ADD COLUMN     "returnWindowStart" TIMESTAMP(3),
ADD COLUMN     "routeLine" geometry(LineString, 4326),
ADD COLUMN     "sourceLocation" geometry(Point, 4326);

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "insuranceDocUrl" TEXT,
ADD COLUMN     "permitDocUrl" TEXT,
ADD COLUMN     "rcDocUrl" TEXT,
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING';

-- DropEnum
DROP TYPE "RecommendationOutcome";

-- CreateTable
CREATE TABLE "DriverPreference" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "status" "DriverStatus" NOT NULL DEFAULT 'AVAILABLE',
    "flexibilityLevel" "FlexibilityLevel" NOT NULL DEFAULT 'BALANCED',
    "preferredCategories" TEXT[],
    "rejectedCategories" TEXT[],
    "preferredRegions" TEXT[],
    "avoidRegions" TEXT[],
    "minExpectedEarnings" INTEGER,
    "preferredDistanceMin" DOUBLE PRECISION,
    "preferredDistanceMax" DOUBLE PRECISION,
    "preferredUtilization" DOUBLE PRECISION NOT NULL DEFAULT 0.8,

    CONSTRAINT "DriverPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "revieweeId" TEXT NOT NULL,
    "tripId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedLocation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoriteDriver" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteDriver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "tripId" TEXT,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriverPreference_driverId_key" ON "DriverPreference"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteDriver_customerId_driverId_key" ON "FavoriteDriver"("customerId", "driverId");

-- AddForeignKey
ALTER TABLE "DriverPreference" ADD CONSTRAINT "DriverPreference_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_revieweeId_fkey" FOREIGN KEY ("revieweeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedLocation" ADD CONSTRAINT "SavedLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteDriver" ADD CONSTRAINT "FavoriteDriver_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteDriver" ADD CONSTRAINT "FavoriteDriver_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
