#!/bin/bash

# 调用 Claude Code 生成日报
# 步骤：
# 1. 运行 export-today.mjs 导出今日数据
# 2. 调用 claude 命令处理导出的 Markdown
# 3. 输出到 .local-ai/reports/daily-YYYY-MM-DD.md
# 不写回数据库

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
EXPORTS_DIR="$PROJECT_DIR/.local-ai/exports"
REPORTS_DIR="$PROJECT_DIR/.local-ai/reports"

# Create directories if not exist
mkdir -p "$EXPORTS_DIR" "$REPORTS_DIR"

# Step 1: Export today's data
echo "📥 Step 1: 导出今日数据..."
node "$SCRIPT_DIR/export-today.mjs"

# Find the latest export file
TODAY=$(date +%Y-%m-%d)
EXPORT_FILE="$EXPORTS_DIR/today-$TODAY.md"

if [ ! -f "$EXPORT_FILE" ]; then
  echo "❌ 导出文件不存在: $EXPORT_FILE"
  exit 1
fi

# Step 2: Generate report filename
REPORT_FILE="$REPORTS_DIR/daily-$TODAY.md"

# Step 3: Call Claude Code
echo "🤖 Step 2: 调用 Claude Code 生成日报..."

# Create prompt file
PROMPT_FILE=$(mktemp)
cat > "$PROMPT_FILE" << 'EOF'
请根据以下今日工作内容，生成一份简洁的中文日报。

要求：
1. 总结今日主要工作成果（3-5条）
2. 列出关键决策和风险
3. 明日工作计划（3-5条）
4. 需要协调的事项

请使用 Markdown 格式输出。

---

EOF

cat "$EXPORT_FILE" >> "$PROMPT_FILE"

# Call Claude Code
if command -v claude &> /dev/null; then
  claude -p "$(cat "$PROMPT_FILE")" > "$REPORT_FILE"
  echo "✅ 日报生成成功: $REPORT_FILE"
else
  echo "⚠️  claude 命令未找到，请手动处理导出文件: $EXPORT_FILE"
  echo "   可以使用: claude -p \"$(cat "$EXPORT_FILE")\" > $REPORT_FILE"
fi

# Cleanup
rm -f "$PROMPT_FILE"

echo "📊 导出文件: $EXPORT_FILE"
echo "📊 日报文件: $REPORT_FILE"
