import { prisma } from "../src/lib/prisma";

async function main() {
  const contentItems = await prisma.contentItem.count();
  const wordPacks = await prisma.wordPack.count();
  const reports = await prisma.contentReport.count();
  console.log("Database connected.");
  console.log(`ContentItem rows: ${contentItems}`);
  console.log(`WordPack rows: ${wordPacks}`);
  console.log(`ContentReport rows: ${reports}`);
}

main()
  .catch((error) => {
    console.error("Database check FAILED:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
