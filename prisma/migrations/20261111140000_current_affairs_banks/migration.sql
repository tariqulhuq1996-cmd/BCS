-- DropIndex
DROP INDEX `CaChapter_no_key` ON `CaChapter`;

-- DropIndex
DROP INDEX `CaQuestion_no_key` ON `CaQuestion`;

-- AlterTable
ALTER TABLE `CaBank` ADD COLUMN `bankKey` VARCHAR(191) NOT NULL DEFAULT 'current-affairs',
    ADD COLUMN `name` TEXT NULL;

-- AlterTable
ALTER TABLE `CaChapter` ADD COLUMN `bankKey` VARCHAR(191) NOT NULL DEFAULT 'current-affairs';

-- AlterTable
ALTER TABLE `CaQuestion` ADD COLUMN `bankKey` VARCHAR(191) NOT NULL DEFAULT 'current-affairs';

-- AlterTable
ALTER TABLE `CaRevisionItem` ADD COLUMN `bankKey` VARCHAR(191) NOT NULL DEFAULT 'current-affairs';

-- AlterTable
ALTER TABLE `CaSource` ADD COLUMN `bankKey` VARCHAR(191) NOT NULL DEFAULT 'current-affairs';

-- CreateIndex
CREATE INDEX `CaBank_bankKey_importedAt_idx` ON `CaBank`(`bankKey`, `importedAt`);

-- CreateIndex
CREATE UNIQUE INDEX `CaChapter_bankKey_no_key` ON `CaChapter`(`bankKey`, `no`);

-- CreateIndex
CREATE UNIQUE INDEX `CaQuestion_bankKey_no_key` ON `CaQuestion`(`bankKey`, `no`);

-- CreateIndex
CREATE INDEX `CaRevisionItem_bankKey_order_idx` ON `CaRevisionItem`(`bankKey`, `order`);

