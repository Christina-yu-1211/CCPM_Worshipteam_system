-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "role" TEXT NOT NULL,
    "title" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "totalServiceCount" INTEGER NOT NULL DEFAULT 0,
    "consecutiveMonths" INTEGER NOT NULL DEFAULT 0,
    "phone" TEXT,
    "notes" TEXT
);

-- CreateTable
CREATE TABLE "EventSeries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "MinistryEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seriesId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "mealsConfig" TEXT NOT NULL,
    "isRegistrationOpen" BOOLEAN NOT NULL DEFAULT true,
    "registrationDeadline" TEXT NOT NULL,
    "remarks" TEXT,
    "isReportDownloaded" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "MinistryEvent_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "EventSeries" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Signup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "attendingDays" TEXT NOT NULL,
    "meals" TEXT NOT NULL,
    "transportMode" TEXT NOT NULL,
    "arrivalLocation" TEXT,
    "arrivalDate" TEXT,
    "arrivalTime" TEXT,
    "departureMode" TEXT,
    "departureLocation" TEXT,
    "departureDate" TEXT,
    "departureTime" TEXT,
    "notes" TEXT,
    "submissionDate" TEXT NOT NULL,
    CONSTRAINT "Signup_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MinistryEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Signup_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipientName" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "preview" TEXT NOT NULL,
    "sentAt" TEXT NOT NULL,
    "status" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
