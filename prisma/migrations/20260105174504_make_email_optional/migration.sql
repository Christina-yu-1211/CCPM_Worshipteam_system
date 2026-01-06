-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT,
    "role" TEXT NOT NULL,
    "title" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "totalServiceCount" INTEGER NOT NULL DEFAULT 0,
    "consecutiveMonths" INTEGER NOT NULL DEFAULT 0,
    "phone" TEXT,
    "notes" TEXT
);
INSERT INTO "new_User" ("consecutiveMonths", "email", "id", "isApproved", "name", "notes", "password", "phone", "role", "title", "totalServiceCount") SELECT "consecutiveMonths", "email", "id", "isApproved", "name", "notes", "password", "phone", "role", "title", "totalServiceCount" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
