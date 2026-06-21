#!/bin/bash
# 功能：调用 Codex CLI 生成周报
# 步骤：
# 1. 运行 export-week.mjs 导出本周数据
# 2. 调用 codex 命令处理导出的 Markdown
# 3. 输出到 .local-ai/reports/weekly-YYYY-MM-DD.md
# 不写回数据库

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
EXPORT_DIR="$PROJECT_DIR/.local-ai/exports"
REPORT_DIR="$PROJECT_DIR/.local-ai/reports"

mkdir -p "$EXPORT_DIR" "$REPORT_DIR"

TODAY=$(date +%Y-%m-%d)
EXPORT_FILE="$EXPORT_DIR/week-$TODAY.md"
REPORT_FILE="$REPORT_DIR/weekly-$TODAY.md"

echo "📥 Exporting this week's data..."
node "$SCRIPT_DIR/export-week.mjs"

if [ ! -f "$EXPORT_FILE" ]; then
  echo "❌ Export file not found: $EXPORT_FILE"
  exit 1
fi

echo "🤖 Generating weekly report with Codex CLI..."
PROMPT="请根据以下本周工作数据，生成一份结构清晰的周报。包含：1) 本周完成事项 2) 进行中事项 3) 风险与阻塞 4) 下周计划。用中文输出 Markdown 格式。"

codex -q "$PROMPT" < "$EXPORT_FILE" > "$REPORT_FILE"

echo "✅ Weekly report generated: $REPORT_FILE"
cat "$REPORT_FILE"
