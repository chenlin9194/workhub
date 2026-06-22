import type { CSSProperties, ReactNode } from "react";

type AutoLinkTextProps = {
  text: string;
  className?: string;
  style?: CSSProperties;
};

function splitTrailingPunctuation(rawUrl: string) {
  let url = rawUrl;
  let trailing = "";

  while (url.length > 0 && /[)\].,;:!?]$/.test(url)) {
    trailing = url.slice(-1) + trailing;
    url = url.slice(0, -1);
  }

  return { url, trailing };
}

export default function AutoLinkText({ text, className, style }: AutoLinkTextProps) {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  const urlRegex = /https?:\/\/[^\s<>"'`]+/gi;

  for (const match of text.matchAll(urlRegex)) {
    const rawUrl = match[0];
    const start = match.index ?? 0;
    const { url, trailing } = splitTrailingPunctuation(rawUrl);

    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }

    nodes.push(
      <a
        key={`${start}-${url}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "var(--accent-blue)", textDecoration: "underline" }}
      >
        {url}
      </a>
    );

    if (trailing) {
      nodes.push(trailing);
    }

    lastIndex = start + rawUrl.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return (
    <span className={className} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", ...style }}>
      {nodes.length > 0 ? nodes : text}
    </span>
  );
}
