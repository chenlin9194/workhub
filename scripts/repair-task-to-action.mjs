import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.workItem.count({ where: { type: "task" } });
  if (count === 0) {
    console.log("No WorkItem rows with type=task were found.");
    return;
  }

  const result = await prisma.workItem.updateMany({
    where: { type: "task" },
    data: { type: "action" },
  });

  console.log(`Updated ${result.count} WorkItem rows from task to action.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
