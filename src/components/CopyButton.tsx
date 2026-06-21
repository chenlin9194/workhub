"use client";

import { useState } from "react";

interface CopyButtonProps {
  text: string;
  label?: string;
}

export default function CopyButton({ text, label = "复制 Markdown" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      alert("复制失败");
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="btn btn-secondary"
      style={{ fontSize: 13 }}
    >
      {copied ? "已复制 ✓" : label}
    </button>
  );
}
