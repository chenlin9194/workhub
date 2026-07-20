import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

function sqliteFileUrl(filePath) {
  return `file:${filePath.replace(/\\/g, "/")}`;
}

async function main() {
  const suppliedPath = process.argv[2];
  if (!suppliedPath) {
    throw new Error("Usage: npm.cmd run db:restore-check -- <backup-file>");
  }

  const backupPath = resolve(suppliedPath);
  if (!existsSync(backupPath)) {
    throw new Error(`Backup not found: ${backupPath}`);
  }

  const verifier = new PrismaClient({
    datasources: { db: { url: sqliteFileUrl(backupPath) } },
  });

  try {
    const rows = await verifier.$queryRawUnsafe("PRAGMA integrity_check");
    const result = Array.isArray(rows) ? rows[0] : null;
    const value = result && typeof result === "object" ? Object.values(result)[0] : null;
    if (value !== "ok") {
      throw new Error(`SQLite integrity check failed: ${String(value ?? "unknown result")}`);
    }

    const [projects, items, logs] = await Promise.all([
      verifier.project.count(),
      verifier.workItem.count(),
      verifier.workLog.count(),
    ]);
    process.stdout.write(`Backup verified: projects=${projects}, items=${items}, logs=${logs}\n`);
  } finally {
    await verifier.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
