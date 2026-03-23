-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "appId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "webhookSecret" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "publicUrl" TEXT,
    "isSetupComplete" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "image" TEXT,
    "installationId" TEXT
);

-- CreateTable
CREATE TABLE "Share" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repoFullName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "passwordHash" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "allowGitClone" BOOLEAN NOT NULL DEFAULT true,
    "installationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Share_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnalyticEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shareId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticEvent_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "Share" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

