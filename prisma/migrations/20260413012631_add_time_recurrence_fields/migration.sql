-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "endTime" TEXT,
ADD COLUMN     "recurrence" TEXT,
ADD COLUMN     "recurrenceEndDate" TIMESTAMP(3),
ADD COLUMN     "recurrenceInterval" INTEGER,
ADD COLUMN     "startTime" TEXT;
