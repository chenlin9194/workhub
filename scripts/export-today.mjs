#!/usr/bin/env node

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const BASE_URL = process.env.WORK_HUB_URL || 'http://localhost:3000';

async function exportToday() {
  try {
    console.log('📥 正在从 Work Hub 导出今日数据...');

    const res = await fetch(`${BASE_URL}/api/export/today?format=markdown`);

    if (!res.ok) {
      throw new Error(`导出失败: ${res.status} ${res.statusText}`);
    }

    const markdown = await res.text();

    // Create .local-ai/exports directory
    const exportsDir = join(process.cwd(), '.local-ai', 'exports');
    if (!existsSync(exportsDir)) {
      mkdirSync(exportsDir, { recursive: true });
    }

    // Generate filename with today's date
    const today = new Date().toISOString().split('T')[0];
    const filename = `today-${today}.md`;
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

exportToday();
