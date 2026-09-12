import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const hasText = (value) => typeof value === "string" && value.length > 0;

function localDate(value) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const fields = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

function legacyNote(log) {
  if (hasText(log.title) && hasText(log.content)) return `${log.title}\n${log.content}`;
  if (hasText(log.title)) return log.title;
  return log.content;
}

async function loadSourceData(client) {
  const [items, actions, logs, projects] = await Promise.all([
    client.workItem.findMany({
      select: { id: true, title: true, project: true, projectId: true, module: true, tags: true, sourceUrl: true },
      orderBy: { id: "asc" },
    }),
    client.actionItem.findMany({
      select: { id: true, title: true, status: true, workItemId: true, workLogId: true, projectId: true, doneAt: true, doneNote: true, createdAt: true, updatedAt: true },
      orderBy: { id: "asc" },
    }),
    client.workLog.findMany({
      select: { id: true, workDate: true, title: true, content: true, note: true, project: true, projectId: true, itemId: true, actionItemId: true, type: true, source: true, module: true, tags: true, reportable: true, sourceUrl: true },
      orderBy: { id: "asc" },
    }),
    client.project.findMany({ select: { id: true, name: true }, orderBy: { id: "asc" } }),
  ]);
  return { items, actions, logs, projects };
}

function validateSourceData(data) {
  const itemById = new Map(data.items.map((item) => [item.id, item]));
  const projectById = new Map(data.projects.map((project) => [project.id, project]));
  const doneActions = data.actions.filter((action) => hasText(action.doneNote));

  for (const action of doneActions) {
    if (!action.workItemId) throw new Error(`ActionItem ${action.id} has doneNote but no workItemId`);
    const item = itemById.get(action.workItemId);
    if (!item) throw new Error(`ActionItem ${action.id} references missing WorkItem ${action.workItemId}`);
    if (action.projectId && item.projectId && action.projectId !== item.projectId) {
      throw new Error(`ActionItem ${action.id} project mismatch: ${action.projectId} vs ${item.projectId}`);
    }
    const projectId = action.projectId || item.projectId;
    if (projectId && !projectById.has(projectId)) throw new Error(`ActionItem ${action.id} references missing Project ${projectId}`);
  }

  return { itemById, projectById, doneActions };
}

function assertOriginalIds(before, after) {
  const afterItems = new Set(after.items.map((item) => item.id));
  const afterActions = new Set(after.actions.map((action) => action.id));
  const afterLogs = new Set(after.logs.map((log) => log.id));
  for (const item of before.items) if (!afterItems.has(item.id)) throw new Error(`Original WorkItem disappeared: ${item.id}`);
  for (const action of before.actions) if (!afterActions.has(action.id)) throw new Error(`Original ActionItem disappeared: ${action.id}`);
  for (const log of before.logs) if (!afterLogs.has(log.id)) throw new Error(`Original WorkLog disappeared: ${log.id}`);
}

async function migrate() {
  const before = await loadSourceData(prisma);
  const source = validateSourceData(before);
  const logsToBackfill = before.logs.filter((log) => !hasText(log.note));
  const createdProgressLogIds = [];
  let notesBackfilled = 0;
  let progressLogsCreated = 0;
  let progressLogsSkipped = 0;
  let doneAtFallbackCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const log of logsToBackfill) {
      const note = legacyNote(log);
      if (!hasText(note)) throw new Error(`WorkLog ${log.id} has no usable title/content for note backfill`);
      await tx.workLog.update({ where: { id: log.id }, data: { note } });
      notesBackfilled += 1;
    }

    for (const action of source.doneActions) {
      const item = source.itemById.get(action.workItemId);
      const projectId = action.projectId || item.projectId || null;
      const projectName = projectId ? source.projectById.get(projectId)?.name || null : item.project || null;
      const existing = await tx.workLog.findFirst({
        where: { actionItemId: action.id, itemId: item.id, note: action.doneNote },
        select: { id: true },
      });
      if (existing) {
        progressLogsSkipped += 1;
        continue;
      }

      const sourceDate = action.doneAt || action.updatedAt || action.createdAt;
      if (!action.doneAt) doneAtFallbackCount += 1;
      const created = await tx.workLog.create({
        data: {
          workDate: localDate(sourceDate),
          title: `行动项完成：${action.title}`,
          content: action.doneNote,
          note: action.doneNote,
          type: "update",
          source: "manual",
          project: projectName,
          projectId,
          module: item.module,
          tags: item.tags,
          reportable: false,
          sourceUrl: item.sourceUrl,
          itemId: item.id,
          actionItemId: action.id,
        },
        select: { id: true },
      });
      createdProgressLogIds.push(created.id);
      progressLogsCreated += 1;
    }
  });

  const after = await loadSourceData(prisma);
  const afterValidation = validateSourceData(after);
  assertOriginalIds(before, after);

  const originalLogsWithNote = before.logs.filter((log) => hasText(log.note)).length;
  for (const log of before.logs) {
    const migrated = after.logs.find((candidate) => candidate.id === log.id);
    if (!hasText(migrated?.note)) throw new Error(`Original WorkLog ${log.id} has no note after migration`);
  }

  let recoverableDoneNoteLogs = 0;
  for (const action of source.doneActions) {
    const matches = after.logs.filter((log) => log.actionItemId === action.id && log.itemId === action.workItemId && log.note === action.doneNote);
    if (matches.length === 0) throw new Error(`doneNote not recoverable for ActionItem ${action.id}`);
    recoverableDoneNoteLogs += 1;
    const expectedProjectId = action.projectId || afterValidation.itemById.get(action.workItemId).projectId || null;
    for (const match of matches) {
      if (match.projectId !== expectedProjectId) throw new Error(`Progress log ${match.id} has incorrect projectId`);
    }
  }

  const projectlessProgressLogsWithProject = after.logs.filter((log) => log.actionItemId && !log.projectId && log.itemId && !afterValidation.itemById.get(log.itemId)?.projectId);
  if (projectlessProgressLogsWithProject.length > 0) throw new Error("A projectless progress log was incorrectly assigned to a project");

  return {
    phase: "Phase 1",
    migration: { notesBackfilled, progressLogsCreated, progressLogsSkipped, doneAtFallbackCount, createdProgressLogIds },
    verification: {
      originalWorkItems: before.items.length,
      finalWorkItems: after.items.length,
      originalActionItems: before.actions.length,
      finalActionItems: after.actions.length,
      originalWorkLogs: before.logs.length,
      finalWorkLogs: after.logs.length,
      originalLogsWithNote,
      doneNoteActionItems: source.doneActions.length,
      recoverableDoneNoteLogs,
      projectlessProgressLogsWithProject: projectlessProgressLogsWithProject.length,
    },
    idempotentKey: "actionItemId + itemId + note",
    doneAtFallbackRule: "doneAt ?? updatedAt ?? createdAt",
  };
}

try {
  console.log(JSON.stringify(await migrate(), null, 2));
} finally {
  await prisma.$disconnect();
}
