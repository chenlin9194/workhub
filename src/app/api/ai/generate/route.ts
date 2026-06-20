import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/ai/generate — call AI model with OpenAI-compatible API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { providerId, prompt, systemPrompt } = body;

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt 不能为空" }, { status: 400 });
    }

    // Get provider
    let provider;
    if (providerId) {
      provider = await prisma.aiProvider.findUnique({ where: { id: providerId } });
    } else {
      provider = await prisma.aiProvider.findFirst({ where: { isDefault: true } });
    }

    if (!provider) {
      return NextResponse.json({ error: "请先在 AI 配置中添加至少一个模型" }, { status: 400 });
    }

    // Build messages
    const messages: { role: string; content: string }[] = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    // Call OpenAI-compatible API
    const baseUrl = provider.baseUrl.replace(/\/+$/, "");
    const apiUrl = `${baseUrl}/chat/completions`;

    const aiRes = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI API error:", aiRes.status, errText);
      return NextResponse.json({
        error: `AI 模型调用失败 (${aiRes.status})：${errText.slice(0, 200)}`,
      }, { status: 502 });
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    const usage = aiData.usage;

    return NextResponse.json({
      content,
      model: provider.model,
      providerName: provider.label,
      usage,
    });
  } catch (error) {
    console.error("POST /api/ai/generate error:", error);
    return NextResponse.json({ error: "AI 生成失败" }, { status: 500 });
  }
}
