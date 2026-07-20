import { mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const repoRoot = resolve(import.meta.dirname, "..");
const backupDirectory = resolve(repoRoot, ".workhub", "backups");
const backupPrefix = "workhub-";
const backupLimit = 14;

function backupName() {
  return `${backupPrefix}${new Date().toISOString().replace(/[:.]/g, "-")}.db`;
}

function sqliteFileUrl(filePath) {
  return `file:${filePath.replace(/\\/g, "/")}`;
}

async function verifyDatabase(filePath) {
  const verifier = new PrismaClient({
    datasources: { db: { url: sqliteFileUrl(filePath) } },
  });

  try {
    const rows = await verifier.$queryRawUnsafe("PRAGMA integrity_check");
    const result = Array.isArray(rows) ? rows[0] : null;
    const value = result && typeof result === "object" ? Object.values(result)[0] : null;
    if (value !== "ok") {
      throw new Error(`SQLite integrity check failed: ${String(value ?? "unknown result")}`);
    }
  } finally {
    await verifier.$disconnect();
  }
}

async function pruneBackups() {
  const entries = await readdir(backupDirectory, { withFileTypes: true });
  const backups = entries
    .filter((entry) => entry.isFile() && entry.name.startsWith(backupPrefix) && entry.name.endsWith(".db"))
    .map((entry) => entry.name)
    .sort()
    .reverse();

  await Promise.all(backups.slice(backupLimit).map((name) => rm(resolve(backupDirectory, name))));
}

async function main() {
  const databasePath = resolve(repoRoot, "prisma", "dev.db");
  if (!existsSync(databasePath)) {
    throw new Error(`Database not found: ${databasePath}`);
  }

  await mkdir(backupDirectory, { recursive: true });
  const outputPath = resolve(backupDirectory, backupName());
  const prisma = new PrismaClient();

  try {
    const quotedPath = outputPath.replace(/'/g, "''");
    await prisma.$executeRawUnsafe(`VACUUM INTO '${quotedPath}'`);
  } finally {
    await prisma.$disconnect();
  }

  await verifyDatabase(outputPath);
  await pruneBackups();
  process.stdout.write(`Backup verified: ${basename(outputPath)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
