-- AlterTable
ALTER TABLE "room_stays" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;
