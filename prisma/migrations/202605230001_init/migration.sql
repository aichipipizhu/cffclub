-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'PLAYER') NOT NULL DEFAULT 'PLAYER',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Customer` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `wechat` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'CONFIRMED') NOT NULL DEFAULT 'PENDING',
    `ownerId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Customer_name_idx`(`name`),
    INDEX `Customer_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerAlias` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `alias` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CustomerAlias_alias_idx`(`alias`),
    UNIQUE INDEX `CustomerAlias_customerId_alias_key`(`customerId`, `alias`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `unitPriceCents` INTEGER NOT NULL,
    `platformCommissionRateBps` INTEGER NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Category_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlayerPricingOverride` (
    `id` VARCHAR(191) NOT NULL,
    `playerId` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `unitPriceCents` INTEGER NULL,
    `platformCommissionRateBps` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PlayerPricingOverride_playerId_categoryId_key`(`playerId`, `categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `reportedById` VARCHAR(191) NOT NULL,
    `paymentStatus` ENUM('UNPAID', 'PAID') NOT NULL DEFAULT 'UNPAID',
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Order_code_key`(`code`),
    INDEX `Order_customerId_idx`(`customerId`),
    INDEX `Order_categoryId_idx`(`categoryId`),
    INDEX `Order_paymentStatus_idx`(`paymentStatus`),
    INDEX `Order_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderItem` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `playerId` VARCHAR(191) NOT NULL,
    `gameId` VARCHAR(191) NULL,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NULL,
    `billableMinutes` INTEGER NOT NULL DEFAULT 0,
    `unitPriceCents` INTEGER NOT NULL DEFAULT 0,
    `grossAmountCents` INTEGER NOT NULL DEFAULT 0,
    `platformCommissionRateBps` INTEGER NOT NULL DEFAULT 0,
    `platformCommissionCents` INTEGER NOT NULL DEFAULT 0,
    `playerPayoutCents` INTEGER NOT NULL DEFAULT 0,
    `ownerCommissionRateBps` INTEGER NOT NULL DEFAULT 0,
    `ownerCommissionCents` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('STARTED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'STARTED',
    `payrollStatus` ENUM('UNPAID', 'PAID') NOT NULL DEFAULT 'UNPAID',
    `payrollPaidAt` DATETIME(3) NULL,
    `note` VARCHAR(191) NULL,
    `rejectedReason` VARCHAR(191) NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `submittedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OrderItem_playerId_idx`(`playerId`),
    INDEX `OrderItem_status_idx`(`status`),
    INDEX `OrderItem_payrollStatus_idx`(`payrollStatus`),
    INDEX `OrderItem_startAt_idx`(`startAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OwnerCommission` (
    `id` VARCHAR(191) NOT NULL,
    `orderItemId` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `amountCents` INTEGER NOT NULL,
    `rateBps` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OwnerCommission_orderItemId_key`(`orderItemId`),
    INDEX `OwnerCommission_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Setting` (
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `targetType` VARCHAR(191) NOT NULL,
    `targetId` VARCHAR(191) NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_action_idx`(`action`),
    INDEX `AuditLog_targetType_targetId_idx`(`targetType`, `targetId`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Customer` ADD CONSTRAINT `Customer_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerAlias` ADD CONSTRAINT `CustomerAlias_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlayerPricingOverride` ADD CONSTRAINT `PlayerPricingOverride_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlayerPricingOverride` ADD CONSTRAINT `PlayerPricingOverride_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_reportedById_fkey` FOREIGN KEY (`reportedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OwnerCommission` ADD CONSTRAINT `OwnerCommission_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `OrderItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OwnerCommission` ADD CONSTRAINT `OwnerCommission_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

