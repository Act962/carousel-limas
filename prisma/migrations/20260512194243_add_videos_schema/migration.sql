-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'DELETED');

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "durationSeconds" DOUBLE PRECISION,
    "width" INTEGER,
    "height" INTEGER,
    "status" "VideoStatus" NOT NULL DEFAULT 'PENDING',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageQuota" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "usedBytes" BIGINT NOT NULL DEFAULT 0,
    "limitBytes" BIGINT NOT NULL DEFAULT 10737418240,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageQuota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Video_storageKey_key" ON "Video"("storageKey");

-- CreateIndex
CREATE INDEX "Video_status_isActive_displayOrder_idx" ON "Video"("status", "isActive", "displayOrder");

-- CreateIndex
CREATE INDEX "Video_deletedAt_idx" ON "Video"("deletedAt");
