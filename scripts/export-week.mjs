#!/usr/bin/env node

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const BASE_URL = process.env.WORK_HUB_URL || 'http://localhost:3000';

function getWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
}

async function exportWeek() {
  try {
    const { start, end } = getWeekRange();
    console.log(`📥 正在从 Work Hub 导出本周数据 (${start} 至 ${end})...`);

    const res = await fetch(`${BASE_URL}/api/export/range?start=${start}&end=${end}&format=markdown`);

    if (!res.ok) {
      throw new Error(`导出失败: ${res.status} ${res.statusText}`);
    }

    const markdown = await res.text();

    // Create .local-ai/exports directory
    const exportsDir = join(process.cwd(), '.local-ai', 'exports');
    if (!existsSync(exportsDir)) {
      mkdirSync(exportsDir, { recursive: true });
    }

    // Generate filename
    const filename = `week-${start}-to-${end}.md`;
    const filepath = join(exportsDir, filename);

    writeFileSync(filepath, markdown, 'utf-8');

    console.log(`✅ 导出成功: ${filepath}`);
    console.log(`📊 文件大小: ${(markdown.length / 1024).toFixed(2)} KB`);

    return filepath;
  } catch (error) {
    console.error('❌ 导出失败:', error.message);
    process.exit(1);
  }
}

exportWeek();
