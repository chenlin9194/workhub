import { NextResponse } from "next/server";
import { getWbsTemplateImportDiff, importWbsTemplate } from "@/lib/wbs/templatePersistence";
import { readWbsTemplateBuffer } from "@/lib/wbs/import";
import { prisma } from "@/lib/prisma";

const MAX_TEMPLATE_BYTES = 20 * 1024 * 1024;

export async function GET() {
  const templates = await prisma.wbsTemplate.findMany({
    select: {
      id: true,
      version: true,
      sourceFileName: true,
      sourceHash: true,
      status: true,
      importedAt: true,
      _count: { select: { nodes: true } },
    },
    orderBy: { importedAt: "desc" },
  });

  return NextResponse.json({
    activeTemplate: templates.find((template) => template.status === "active") ?? null,
    templates,
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const versionValue = formData.get("version");
    const version = typeof versionValue === "string" && versionValue.trim() ? versionValue.trim() : "V2.0";

    if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "请选择 XLSX 模板文件" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ error: "只支持 .xlsx 文件" }, { status: 400 });
    }
    if (file.size > MAX_TEMPLATE_BYTES) {
      return NextResponse.json({ error: "模板文件不能超过 20 MB" }, { status: 413 });
    }

    const preview = await readWbsTemplateBuffer(file.name, Buffer.from(await file.arrayBuffer()), version);
    const diff = await getWbsTemplateImportDiff(preview);
    preview.changes = diff;

    if (preview.hasStructuralErrors) {
      return NextResponse.json(
        {
          error: "模板存在结构错误，未写入数据库",
          preview: {
            sourceFileName: preview.sourceFileName,
            version: preview.version,
            nodeCount: preview.nodes.length,
            issues: preview.issues,
            gates: preview.gates,
          },
        },
        { status: 422 },
      );
    }

    const result = await importWbsTemplate(preview);
    return NextResponse.json(
      {
        message: `WBS 模板 ${version} 导入完成`,
        result,
        preview: {
          sourceFileName: preview.sourceFileName,
          version: preview.version,
          nodeCount: preview.nodes.length,
          issues: preview.issues,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error importing WBS template:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "导入 WBS 模板失败" }, { status: 500 });
  }
}
