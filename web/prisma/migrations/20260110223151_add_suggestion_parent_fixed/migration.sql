-- AlterTable
ALTER TABLE "CategorySuggestion" ADD COLUMN     "parentId" TEXT;

-- AddForeignKey
ALTER TABLE "CategorySuggestion" ADD CONSTRAINT "CategorySuggestion_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
