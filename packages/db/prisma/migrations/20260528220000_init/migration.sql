-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'AGENT', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('SINGLE_FAMILY', 'CONDO', 'TOWNHOUSE', 'MULTI_FAMILY', 'LAND', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "ListingSource" AS ENUM ('MLS', 'MANUAL', 'ZILLOW', 'REALTOR_COM');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'PENDING', 'SOLD', 'WITHDRAWN', 'EXPIRED', 'COMING_SOON');

-- CreateEnum
CREATE TYPE "AIActionStatus" AS ENUM ('PENDING', 'APPROVED', 'EXECUTING', 'EXECUTED', 'SENT', 'DISMISSED', 'SNOOZED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountMember" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountMlsAccess" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "mlsBoardId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountMlsAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Portal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "customDomain" TEXT,
    "accountId" TEXT NOT NULL,
    "themePresetId" TEXT NOT NULL DEFAULT 'classic',
    "logoUrl" TEXT,
    "agentDisplayName" TEXT,
    "agentPhone" TEXT,
    "agentEmail" TEXT,
    "agentHeadlineText" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Portal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cities" TEXT[],
    "zipCodes" TEXT[],
    "schoolDistricts" TEXT[],
    "propertyTypes" "PropertyType"[],
    "styles" TEXT[],
    "features" TEXT[],
    "priceMin" INTEGER,
    "priceMax" INTEGER,
    "bedsMin" INTEGER,
    "sqftMin" INTEGER,
    "sqftMax" INTEGER,
    "yearBuiltMin" INTEGER,
    "yearBuiltMax" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalSegment" (
    "portalId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,

    CONSTRAINT "PortalSegment_pkey" PRIMARY KEY ("portalId","segmentId")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "parcelId" TEXT,
    "propertyType" "PropertyType",
    "bedrooms" INTEGER,
    "bathrooms" DOUBLE PRECISION,
    "squareFeet" INTEGER,
    "lotSize" DOUBLE PRECISION,
    "yearBuilt" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "source" "ListingSource" NOT NULL,
    "accountId" TEXT,
    "mlsBoardId" TEXT,
    "mlsId" TEXT,
    "slug" TEXT,
    "listPrice" DECIMAL(65,30),
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "listDate" TIMESTAMP(3),
    "closeDate" TIMESTAMP(3),
    "imageUrl" TEXT,
    "description" TEXT,
    "rawData" TEXT,
    "listingAgentName" TEXT,
    "listingAgentEmail" TEXT,
    "listingAgentPhone" TEXT,
    "brokerageName" TEXT,
    "brokeragePhone" TEXT,
    "bedrooms" INTEGER,
    "bathrooms" DOUBLE PRECISION,
    "squareFeet" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "order" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalFeaturedListing" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "PortalFeaturedListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "portalId" TEXT,
    "password" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "phoneNumber" TEXT,
    "avatarUrl" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerificationToken" TEXT,
    "passwordResetToken" TEXT,
    "passwordResetExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthIdentity" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "email" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFavorites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserFavorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInquiries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "contactId" TEXT,
    "portalId" TEXT,
    "message" TEXT NOT NULL,
    "contactPreference" TEXT NOT NULL DEFAULT 'EMAIL',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "agentResponse" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserInquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "resultCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactSubmission" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "inquiryType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "contactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'LEAD',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "source" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'NEW',
    "tags" JSONB,
    "avatarUrl" TEXT,
    "assignedMemberId" TEXT,
    "userId" TEXT,
    "lastInteractionAt" TIMESTAMP(3),
    "lastConsultAt" TIMESTAMP(3),
    "lastEventAt" TIMESTAMP(3),
    "nextTaskDueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactTrack" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactInteraction" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "side" TEXT,
    "subject" TEXT,
    "body" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'PROSPECT',
    "address" TEXT,
    "mlsId" TEXT,
    "listPrice" DECIMAL(65,30),
    "salePrice" DECIMAL(65,30),
    "commissionRate" DOUBLE PRECISION,
    "closingDate" TIMESTAMP(3),
    "notes" TEXT,
    "offerPrice" DECIMAL(65,30),
    "sellerCreditAmount" DECIMAL(65,30),
    "sellerCreditNote" TEXT,
    "financingType" TEXT,
    "downPayment" DECIMAL(65,30),
    "bankName" TEXT,
    "saleType" TEXT,
    "mutualDate" TIMESTAMP(3),
    "possessionDate" TIMESTAMP(3),
    "loanApplicationDueDate" TIMESTAMP(3),
    "submittedToListingAgentDate" TIMESTAMP(3),
    "earnestAmount" DECIMAL(65,30),
    "earnestMoneyDueDate" TIMESTAMP(3),
    "inspectionDate" TIMESTAMP(3),
    "inspectionContingencyDate" TIMESTAMP(3),
    "financingContingencyDate" TIMESTAMP(3),
    "appraisalContingencyDate" TIMESTAMP(3),
    "titleContingencyDate" TIMESTAMP(3),
    "propertyType" TEXT,
    "occupancy" TEXT,
    "county" TEXT,
    "yearBuilt" INTEGER,
    "isNewConstruction" BOOLEAN,
    "apnTaxId" TEXT,
    "otherOffersCount" INTEGER,
    "hasHoa" BOOLEAN,
    "hasHomeWarranty" BOOLEAN,
    "homeWarrantyPaidBy" TEXT,
    "buyerType" TEXT,
    "accessInfo" TEXT,
    "assignedAgentId" TEXT,
    "propertyId" TEXT,
    "templateId" TEXT,
    "driveFolderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateDocumentDefinition" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateDocumentDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionDocument" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "documentDefinitionId" TEXT,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'MISSING',
    "notes" TEXT,
    "matchedAttachmentId" TEXT,
    "matchedAt" TIMESTAMP(3),
    "driveFileId" TEXT,
    "driveWebLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestoneDefinition" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilestoneDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateTaskDefinition" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "offsetDays" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL,
    "anchorMilestoneId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateTaskDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateEventDefinition" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "durationHours" INTEGER NOT NULL DEFAULT 1,
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "offsetDays" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL,
    "anchorMilestoneId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateEventDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionMilestone" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "milestoneDefinitionId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionParty" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionSyncRun" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "query" TEXT,
    "messagesFound" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "TransactionSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionDiscoveredMessage" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "syncRunId" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "providerThreadId" TEXT,
    "subject" TEXT,
    "snippet" TEXT,
    "fromEmail" TEXT,
    "fromName" TEXT,
    "sentAt" TIMESTAMP(3),
    "category" TEXT,
    "confidence" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionDiscoveredMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionDiscoveredAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "providerAttachmentId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "suggestedDocType" TEXT,
    "suggestedConfidence" DOUBLE PRECISION,
    "extractedText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionDiscoveredAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionDiscoveredContact" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT,
    "contactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionDiscoveredContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketReport" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subjectPropertyAddress" TEXT NOT NULL,
    "subjectPropertyData" JSONB,
    "comparables" JSONB,
    "aiAnalysis" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "agentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "content" JSONB,
    "targetAudience" JSONB,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "stats" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "assignedToId" TEXT,
    "contactId" TEXT,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "contactId" TEXT,
    "transactionId" TEXT,
    "propertyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "customType" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "assignedAgentId" TEXT,
    "transactionId" TEXT,
    "propertyId" TEXT,
    "providerCalendarId" TEXT,
    "providerEventId" TEXT,
    "providerSyncError" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAttendee" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" TEXT,
    "rsvpStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectedAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "providerAccountId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "scopes" JSONB,
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "gmailHistoryId" TEXT,
    "calendarSyncToken" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalCalendarEvent" (
    "id" TEXT NOT NULL,
    "connectedAccountId" TEXT NOT NULL,
    "providerCalendarId" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "status" TEXT,
    "location" TEXT,
    "organizerEmail" TEXT,
    "attendeeEmails" JSONB,
    "conferenceData" JSONB,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "rawMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "userId" TEXT NOT NULL,
    "contextType" TEXT,
    "contextEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "messageType" TEXT NOT NULL DEFAULT 'chat',
    "suggestedActions" JSONB,
    "modelId" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "toolName" TEXT NOT NULL,
    "toolType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "reason" TEXT,
    "payload" JSONB NOT NULL,
    "previewData" JSONB,
    "contextType" TEXT,
    "contextEntityId" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "workflowKey" TEXT,
    "idempotencyKey" TEXT,
    "contactId" TEXT,
    "propertyId" TEXT,
    "transactionId" TEXT,
    "status" "AIActionStatus" NOT NULL DEFAULT 'PENDING',
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "suggestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "modelId" TEXT,
    "promptVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIActionExecution" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "resultType" TEXT,
    "resultId" TEXT,
    "durationMs" INTEGER,
    "executedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIActionExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventCategory" TEXT NOT NULL,
    "conversationId" TEXT,
    "actionId" TEXT,
    "messageId" TEXT,
    "contextType" TEXT,
    "contextEntityId" TEXT,
    "eventData" JSONB,
    "requestId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIContextSnapshot" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT,
    "messageId" TEXT,
    "contextType" TEXT NOT NULL,
    "entityId" TEXT,
    "contextData" JSONB NOT NULL,
    "retrievedItems" JSONB,
    "retrievalQuery" TEXT,
    "contextTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIContextSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalInquiry" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "visitorName" TEXT NOT NULL,
    "visitorEmail" TEXT NOT NULL,
    "visitorPhone" TEXT,
    "message" TEXT NOT NULL,
    "listingId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountMember_accountId_idx" ON "AccountMember"("accountId");

-- CreateIndex
CREATE INDEX "AccountMember_userId_idx" ON "AccountMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountMember_accountId_userId_key" ON "AccountMember"("accountId", "userId");

-- CreateIndex
CREATE INDEX "AccountMlsAccess_accountId_idx" ON "AccountMlsAccess"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountMlsAccess_accountId_mlsBoardId_key" ON "AccountMlsAccess"("accountId", "mlsBoardId");

-- CreateIndex
CREATE UNIQUE INDEX "Portal_slug_key" ON "Portal"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Portal_customDomain_key" ON "Portal"("customDomain");

-- CreateIndex
CREATE INDEX "Portal_accountId_idx" ON "Portal"("accountId");

-- CreateIndex
CREATE INDEX "Portal_isActive_idx" ON "Portal"("isActive");

-- CreateIndex
CREATE INDEX "Segment_accountId_idx" ON "Segment"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Property_parcelId_key" ON "Property"("parcelId");

-- CreateIndex
CREATE INDEX "Property_city_state_idx" ON "Property"("city", "state");

-- CreateIndex
CREATE INDEX "Property_latitude_longitude_idx" ON "Property"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_slug_key" ON "Listing"("slug");

-- CreateIndex
CREATE INDEX "Listing_status_idx" ON "Listing"("status");

-- CreateIndex
CREATE INDEX "Listing_listPrice_idx" ON "Listing"("listPrice");

-- CreateIndex
CREATE INDEX "Listing_propertyId_idx" ON "Listing"("propertyId");

-- CreateIndex
CREATE INDEX "Listing_accountId_idx" ON "Listing"("accountId");

-- CreateIndex
CREATE INDEX "Listing_slug_idx" ON "Listing"("slug");

-- CreateIndex
CREATE INDEX "Listing_listDate_idx" ON "Listing"("listDate");

-- CreateIndex
CREATE INDEX "Listing_status_listPrice_bedrooms_idx" ON "Listing"("status", "listPrice", "bedrooms");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_mlsBoardId_mlsId_key" ON "Listing"("mlsBoardId", "mlsId");

-- CreateIndex
CREATE INDEX "PortalFeaturedListing_portalId_idx" ON "PortalFeaturedListing"("portalId");

-- CreateIndex
CREATE UNIQUE INDEX "PortalFeaturedListing_portalId_listingId_key" ON "PortalFeaturedListing"("portalId", "listingId");

-- CreateIndex
CREATE INDEX "User_accountId_idx" ON "User"("accountId");

-- CreateIndex
CREATE INDEX "User_portalId_idx" ON "User"("portalId");

-- CreateIndex
CREATE INDEX "AuthIdentity_userId_idx" ON "AuthIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIdentity_provider_providerAccountId_key" ON "AuthIdentity"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "UserFavorites_userId_listingId_key" ON "UserFavorites"("userId", "listingId");

-- CreateIndex
CREATE INDEX "UserInquiries_userId_idx" ON "UserInquiries"("userId");

-- CreateIndex
CREATE INDEX "UserInquiries_listingId_idx" ON "UserInquiries"("listingId");

-- CreateIndex
CREATE INDEX "UserInquiries_contactId_idx" ON "UserInquiries"("contactId");

-- CreateIndex
CREATE INDEX "UserInquiries_portalId_idx" ON "UserInquiries"("portalId");

-- CreateIndex
CREATE INDEX "SavedSearch_userId_idx" ON "SavedSearch"("userId");

-- CreateIndex
CREATE INDEX "Contact_accountId_idx" ON "Contact"("accountId");

-- CreateIndex
CREATE INDEX "Contact_type_idx" ON "Contact"("type");

-- CreateIndex
CREATE INDEX "Contact_stage_idx" ON "Contact"("stage");

-- CreateIndex
CREATE INDEX "Contact_assignedMemberId_idx" ON "Contact"("assignedMemberId");

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "Contact_accountId_stage_updatedAt_idx" ON "Contact"("accountId", "stage", "updatedAt");

-- CreateIndex
CREATE INDEX "Contact_accountId_type_stage_idx" ON "Contact"("accountId", "type", "stage");

-- CreateIndex
CREATE INDEX "Contact_accountId_lastInteractionAt_idx" ON "Contact"("accountId", "lastInteractionAt");

-- CreateIndex
CREATE INDEX "Contact_accountId_nextTaskDueAt_idx" ON "Contact"("accountId", "nextTaskDueAt");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_accountId_userId_key" ON "Contact"("accountId", "userId");

-- CreateIndex
CREATE INDEX "ContactTrack_contactId_idx" ON "ContactTrack"("contactId");

-- CreateIndex
CREATE INDEX "ContactTrack_side_idx" ON "ContactTrack"("side");

-- CreateIndex
CREATE INDEX "ContactTrack_isActive_idx" ON "ContactTrack"("isActive");

-- CreateIndex
CREATE INDEX "ContactTrack_contactId_side_isActive_idx" ON "ContactTrack"("contactId", "side", "isActive");

-- CreateIndex
CREATE INDEX "ContactInteraction_contactId_idx" ON "ContactInteraction"("contactId");

-- CreateIndex
CREATE INDEX "ContactInteraction_contactId_type_idx" ON "ContactInteraction"("contactId", "type");

-- CreateIndex
CREATE INDEX "ContactInteraction_contactId_side_occurredAt_idx" ON "ContactInteraction"("contactId", "side", "occurredAt");

-- CreateIndex
CREATE INDEX "ContactInteraction_occurredAt_idx" ON "ContactInteraction"("occurredAt");

-- CreateIndex
CREATE INDEX "Transaction_accountId_idx" ON "Transaction"("accountId");

-- CreateIndex
CREATE INDEX "Transaction_stage_idx" ON "Transaction"("stage");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");

-- CreateIndex
CREATE INDEX "Transaction_closingDate_idx" ON "Transaction"("closingDate");

-- CreateIndex
CREATE INDEX "Transaction_propertyId_idx" ON "Transaction"("propertyId");

-- CreateIndex
CREATE INDEX "Transaction_assignedAgentId_idx" ON "Transaction"("assignedAgentId");

-- CreateIndex
CREATE INDEX "Transaction_templateId_idx" ON "Transaction"("templateId");

-- CreateIndex
CREATE INDEX "Transaction_accountId_stage_closingDate_idx" ON "Transaction"("accountId", "stage", "closingDate");

-- CreateIndex
CREATE INDEX "Transaction_accountId_stage_updatedAt_idx" ON "Transaction"("accountId", "stage", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionTemplate_key_key" ON "TransactionTemplate"("key");

-- CreateIndex
CREATE INDEX "TemplateDocumentDefinition_templateId_sortOrder_idx" ON "TemplateDocumentDefinition"("templateId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateDocumentDefinition_templateId_key_key" ON "TemplateDocumentDefinition"("templateId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionDocument_matchedAttachmentId_key" ON "TransactionDocument"("matchedAttachmentId");

-- CreateIndex
CREATE INDEX "TransactionDocument_transactionId_idx" ON "TransactionDocument"("transactionId");

-- CreateIndex
CREATE INDEX "TransactionDocument_status_idx" ON "TransactionDocument"("status");

-- CreateIndex
CREATE INDEX "MilestoneDefinition_templateId_sortOrder_idx" ON "MilestoneDefinition"("templateId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "MilestoneDefinition_templateId_key_key" ON "MilestoneDefinition"("templateId", "key");

-- CreateIndex
CREATE INDEX "TemplateTaskDefinition_templateId_sortOrder_idx" ON "TemplateTaskDefinition"("templateId", "sortOrder");

-- CreateIndex
CREATE INDEX "TemplateTaskDefinition_anchorMilestoneId_idx" ON "TemplateTaskDefinition"("anchorMilestoneId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateTaskDefinition_templateId_key_key" ON "TemplateTaskDefinition"("templateId", "key");

-- CreateIndex
CREATE INDEX "TemplateEventDefinition_templateId_sortOrder_idx" ON "TemplateEventDefinition"("templateId", "sortOrder");

-- CreateIndex
CREATE INDEX "TemplateEventDefinition_anchorMilestoneId_idx" ON "TemplateEventDefinition"("anchorMilestoneId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateEventDefinition_templateId_key_key" ON "TemplateEventDefinition"("templateId", "key");

-- CreateIndex
CREATE INDEX "TransactionMilestone_transactionId_date_idx" ON "TransactionMilestone"("transactionId", "date");

-- CreateIndex
CREATE INDEX "TransactionMilestone_milestoneDefinitionId_idx" ON "TransactionMilestone"("milestoneDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionMilestone_transactionId_milestoneDefinitionId_key" ON "TransactionMilestone"("transactionId", "milestoneDefinitionId");

-- CreateIndex
CREATE INDEX "TransactionParty_transactionId_idx" ON "TransactionParty"("transactionId");

-- CreateIndex
CREATE INDEX "TransactionParty_contactId_idx" ON "TransactionParty"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionParty_transactionId_contactId_role_key" ON "TransactionParty"("transactionId", "contactId", "role");

-- CreateIndex
CREATE INDEX "TransactionSyncRun_transactionId_idx" ON "TransactionSyncRun"("transactionId");

-- CreateIndex
CREATE INDEX "TransactionSyncRun_transactionId_startedAt_idx" ON "TransactionSyncRun"("transactionId", "startedAt");

-- CreateIndex
CREATE INDEX "TransactionDiscoveredMessage_transactionId_status_idx" ON "TransactionDiscoveredMessage"("transactionId", "status");

-- CreateIndex
CREATE INDEX "TransactionDiscoveredMessage_transactionId_category_idx" ON "TransactionDiscoveredMessage"("transactionId", "category");

-- CreateIndex
CREATE INDEX "TransactionDiscoveredMessage_syncRunId_idx" ON "TransactionDiscoveredMessage"("syncRunId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionDiscoveredMessage_transactionId_providerMessageI_key" ON "TransactionDiscoveredMessage"("transactionId", "providerMessageId");

-- CreateIndex
CREATE INDEX "TransactionDiscoveredAttachment_messageId_idx" ON "TransactionDiscoveredAttachment"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionDiscoveredAttachment_messageId_providerAttachmen_key" ON "TransactionDiscoveredAttachment"("messageId", "providerAttachmentId");

-- CreateIndex
CREATE INDEX "TransactionDiscoveredContact_messageId_idx" ON "TransactionDiscoveredContact"("messageId");

-- CreateIndex
CREATE INDEX "TransactionDiscoveredContact_email_idx" ON "TransactionDiscoveredContact"("email");

-- CreateIndex
CREATE INDEX "MarketReport_agentId_idx" ON "MarketReport"("agentId");

-- CreateIndex
CREATE INDEX "MarketReport_status_idx" ON "MarketReport"("status");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "Campaign_type_idx" ON "Campaign"("type");

-- CreateIndex
CREATE INDEX "Task_accountId_idx" ON "Task"("accountId");

-- CreateIndex
CREATE INDEX "Task_assignedToId_idx" ON "Task"("assignedToId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_priority_idx" ON "Task"("priority");

-- CreateIndex
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- CreateIndex
CREATE INDEX "Task_contactId_idx" ON "Task"("contactId");

-- CreateIndex
CREATE INDEX "Task_transactionId_idx" ON "Task"("transactionId");

-- CreateIndex
CREATE INDEX "Task_accountId_status_dueDate_idx" ON "Task"("accountId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Task_transactionId_status_dueDate_idx" ON "Task"("transactionId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Task_contactId_status_dueDate_idx" ON "Task"("contactId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Note_authorId_idx" ON "Note"("authorId");

-- CreateIndex
CREATE INDEX "Note_contactId_idx" ON "Note"("contactId");

-- CreateIndex
CREATE INDEX "Note_transactionId_idx" ON "Note"("transactionId");

-- CreateIndex
CREATE INDEX "Note_propertyId_idx" ON "Note"("propertyId");

-- CreateIndex
CREATE INDEX "Event_assignedAgentId_idx" ON "Event"("assignedAgentId");

-- CreateIndex
CREATE INDEX "Event_transactionId_idx" ON "Event"("transactionId");

-- CreateIndex
CREATE INDEX "Event_propertyId_idx" ON "Event"("propertyId");

-- CreateIndex
CREATE INDEX "Event_type_idx" ON "Event"("type");

-- CreateIndex
CREATE INDEX "Event_status_idx" ON "Event"("status");

-- CreateIndex
CREATE INDEX "Event_startAt_idx" ON "Event"("startAt");

-- CreateIndex
CREATE INDEX "Event_assignedAgentId_startAt_idx" ON "Event"("assignedAgentId", "startAt");

-- CreateIndex
CREATE INDEX "Event_providerEventId_idx" ON "Event"("providerEventId");

-- CreateIndex
CREATE INDEX "EventAttendee_eventId_idx" ON "EventAttendee"("eventId");

-- CreateIndex
CREATE INDEX "EventAttendee_contactId_idx" ON "EventAttendee"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "EventAttendee_eventId_contactId_key" ON "EventAttendee"("eventId", "contactId");

-- CreateIndex
CREATE INDEX "ConnectedAccount_userId_idx" ON "ConnectedAccount"("userId");

-- CreateIndex
CREATE INDEX "ConnectedAccount_provider_email_idx" ON "ConnectedAccount"("provider", "email");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedAccount_userId_provider_key" ON "ConnectedAccount"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedAccount_provider_providerAccountId_key" ON "ConnectedAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "ExternalCalendarEvent_connectedAccountId_startAt_idx" ON "ExternalCalendarEvent"("connectedAccountId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalCalendarEvent_connectedAccountId_providerCalendarId_key" ON "ExternalCalendarEvent"("connectedAccountId", "providerCalendarId", "providerEventId");

-- CreateIndex
CREATE INDEX "AIConversation_userId_idx" ON "AIConversation"("userId");

-- CreateIndex
CREATE INDEX "AIConversation_contextType_contextEntityId_idx" ON "AIConversation"("contextType", "contextEntityId");

-- CreateIndex
CREATE INDEX "AIMessage_conversationId_idx" ON "AIMessage"("conversationId");

-- CreateIndex
CREATE INDEX "AIAction_userId_status_suggestedAt_idx" ON "AIAction"("userId", "status", "suggestedAt");

-- CreateIndex
CREATE INDEX "AIAction_userId_status_dueAt_idx" ON "AIAction"("userId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "AIAction_userId_toolType_status_suggestedAt_idx" ON "AIAction"("userId", "toolType", "status", "suggestedAt");

-- CreateIndex
CREATE INDEX "AIAction_contextType_contextEntityId_status_idx" ON "AIAction"("contextType", "contextEntityId", "status");

-- CreateIndex
CREATE INDEX "AIAction_contactId_status_idx" ON "AIAction"("contactId", "status");

-- CreateIndex
CREATE INDEX "AIAction_propertyId_status_idx" ON "AIAction"("propertyId", "status");

-- CreateIndex
CREATE INDEX "AIAction_transactionId_status_idx" ON "AIAction"("transactionId", "status");

-- CreateIndex
CREATE INDEX "AIAction_sourceType_sourceId_idx" ON "AIAction"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "AIAction_userId_sourceType_sourceId_workflowKey_status_idx" ON "AIAction"("userId", "sourceType", "sourceId", "workflowKey", "status");

-- CreateIndex
CREATE INDEX "AIAction_idempotencyKey_idx" ON "AIAction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AIAction_conversationId_idx" ON "AIAction"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "AIActionExecution_actionId_key" ON "AIActionExecution"("actionId");

-- CreateIndex
CREATE INDEX "AIActionExecution_actionId_idx" ON "AIActionExecution"("actionId");

-- CreateIndex
CREATE INDEX "AIActionExecution_resultType_resultId_idx" ON "AIActionExecution"("resultType", "resultId");

-- CreateIndex
CREATE INDEX "AIAuditLog_userId_idx" ON "AIAuditLog"("userId");

-- CreateIndex
CREATE INDEX "AIAuditLog_eventType_idx" ON "AIAuditLog"("eventType");

-- CreateIndex
CREATE INDEX "AIAuditLog_eventCategory_idx" ON "AIAuditLog"("eventCategory");

-- CreateIndex
CREATE INDEX "AIAuditLog_conversationId_idx" ON "AIAuditLog"("conversationId");

-- CreateIndex
CREATE INDEX "AIAuditLog_actionId_idx" ON "AIAuditLog"("actionId");

-- CreateIndex
CREATE INDEX "AIAuditLog_occurredAt_idx" ON "AIAuditLog"("occurredAt");

-- CreateIndex
CREATE INDEX "AIAuditLog_contextType_contextEntityId_idx" ON "AIAuditLog"("contextType", "contextEntityId");

-- CreateIndex
CREATE INDEX "AIContextSnapshot_conversationId_idx" ON "AIContextSnapshot"("conversationId");

-- CreateIndex
CREATE INDEX "AIContextSnapshot_contextType_entityId_idx" ON "AIContextSnapshot"("contextType", "entityId");

-- CreateIndex
CREATE INDEX "PortalInquiry_portalId_idx" ON "PortalInquiry"("portalId");

-- CreateIndex
CREATE INDEX "PortalInquiry_portalId_status_idx" ON "PortalInquiry"("portalId", "status");

-- AddForeignKey
ALTER TABLE "AccountMember" ADD CONSTRAINT "AccountMember_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountMember" ADD CONSTRAINT "AccountMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountMlsAccess" ADD CONSTRAINT "AccountMlsAccess_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portal" ADD CONSTRAINT "Portal_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalSegment" ADD CONSTRAINT "PortalSegment_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "Portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalSegment" ADD CONSTRAINT "PortalSegment_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalFeaturedListing" ADD CONSTRAINT "PortalFeaturedListing_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "Portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalFeaturedListing" ADD CONSTRAINT "PortalFeaturedListing_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "Portal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFavorites" ADD CONSTRAINT "UserFavorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFavorites" ADD CONSTRAINT "UserFavorites_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInquiries" ADD CONSTRAINT "UserInquiries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInquiries" ADD CONSTRAINT "UserInquiries_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInquiries" ADD CONSTRAINT "UserInquiries_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInquiries" ADD CONSTRAINT "UserInquiries_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "Portal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactSubmission" ADD CONSTRAINT "ContactSubmission_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_assignedMemberId_fkey" FOREIGN KEY ("assignedMemberId") REFERENCES "AccountMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactTrack" ADD CONSTRAINT "ContactTrack_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactInteraction" ADD CONSTRAINT "ContactInteraction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TransactionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateDocumentDefinition" ADD CONSTRAINT "TemplateDocumentDefinition_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TransactionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionDocument" ADD CONSTRAINT "TransactionDocument_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionDocument" ADD CONSTRAINT "TransactionDocument_documentDefinitionId_fkey" FOREIGN KEY ("documentDefinitionId") REFERENCES "TemplateDocumentDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionDocument" ADD CONSTRAINT "TransactionDocument_matchedAttachmentId_fkey" FOREIGN KEY ("matchedAttachmentId") REFERENCES "TransactionDiscoveredAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneDefinition" ADD CONSTRAINT "MilestoneDefinition_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TransactionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateTaskDefinition" ADD CONSTRAINT "TemplateTaskDefinition_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TransactionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateTaskDefinition" ADD CONSTRAINT "TemplateTaskDefinition_anchorMilestoneId_fkey" FOREIGN KEY ("anchorMilestoneId") REFERENCES "MilestoneDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateEventDefinition" ADD CONSTRAINT "TemplateEventDefinition_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TransactionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateEventDefinition" ADD CONSTRAINT "TemplateEventDefinition_anchorMilestoneId_fkey" FOREIGN KEY ("anchorMilestoneId") REFERENCES "MilestoneDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionMilestone" ADD CONSTRAINT "TransactionMilestone_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionMilestone" ADD CONSTRAINT "TransactionMilestone_milestoneDefinitionId_fkey" FOREIGN KEY ("milestoneDefinitionId") REFERENCES "MilestoneDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionParty" ADD CONSTRAINT "TransactionParty_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionParty" ADD CONSTRAINT "TransactionParty_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionSyncRun" ADD CONSTRAINT "TransactionSyncRun_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionDiscoveredMessage" ADD CONSTRAINT "TransactionDiscoveredMessage_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionDiscoveredMessage" ADD CONSTRAINT "TransactionDiscoveredMessage_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "TransactionSyncRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionDiscoveredAttachment" ADD CONSTRAINT "TransactionDiscoveredAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "TransactionDiscoveredMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionDiscoveredContact" ADD CONSTRAINT "TransactionDiscoveredContact_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "TransactionDiscoveredMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionDiscoveredContact" ADD CONSTRAINT "TransactionDiscoveredContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketReport" ADD CONSTRAINT "MarketReport_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAttendee" ADD CONSTRAINT "EventAttendee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAttendee" ADD CONSTRAINT "EventAttendee_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectedAccount" ADD CONSTRAINT "ConnectedAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalCalendarEvent" ADD CONSTRAINT "ExternalCalendarEvent_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMessage" ADD CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAction" ADD CONSTRAINT "AIAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAction" ADD CONSTRAINT "AIAction_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAction" ADD CONSTRAINT "AIAction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAction" ADD CONSTRAINT "AIAction_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAction" ADD CONSTRAINT "AIAction_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIActionExecution" ADD CONSTRAINT "AIActionExecution_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "AIAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAuditLog" ADD CONSTRAINT "AIAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIContextSnapshot" ADD CONSTRAINT "AIContextSnapshot_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalInquiry" ADD CONSTRAINT "PortalInquiry_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "Portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Partial unique indexes for User.email (Prisma @@unique can't express WHERE) ───
-- Agents (portalId IS NULL): one email per the entire agent universe.
CREATE UNIQUE INDEX "User_email_agent_key"
    ON "User"("email") WHERE "portalId" IS NULL;

-- Consumers (portalId IS NOT NULL): one email per portal; same email may
-- recur across different portals (even within the same Account).
CREATE UNIQUE INDEX "User_portalId_email_consumer_key"
    ON "User"("portalId", "email") WHERE "portalId" IS NOT NULL;
