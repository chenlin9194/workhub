import { resolve } from "node:path";
import { formatTemplatePreview, readWbsTemplateFile } from "../src/lib/wbs/import.ts";
import { getWbsTemplateImportDiff, importWbsTemplate } from "../src/lib/wbs/templatePersistence.ts";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const dryRun = args.includes("--dry-run");
const positional = args.filter((arg) => !arg.startsWith("--"));
const filePath = positional[0];
const version = positional[1] ?? "V2.0";

if (!filePath || (!apply && !dryRun)) {
  console.error("用法：npm.cmd run wbs:template:preview -- --dry-run <xlsx路径> <版本> ");
  process.exitCode = 2;
} else {
  try {
    const preview = await readWbsTemplateFile(resolve(filePath), version);
    preview.changes = await getWbsTemplateImportDiff(preview);
    console.log(formatTemplatePreview(preview));
    if (apply) {
      if (preview.hasStructuralErrors) {
        console.error("拒绝执行：模板存在结构错误，未写入数据库。");
        process.exitCode = 2;
      } else {
        const result = await importWbsTemplate(preview);
        console.log(`模板入库完成：templateId=${result.templateId}，节点=${result.nodeCount}，新增=${result.diff.add}，更新=${result.diff.update}，忽略=${result.diff.ignore}，删除=${result.diff.remove}`);
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
