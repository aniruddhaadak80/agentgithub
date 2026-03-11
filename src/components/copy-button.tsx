"use client";

import { useState, useCallback } from "react";

export function CopyButton({ text, label = "Copy as AI Instructions" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [text]);

  return (
    <button className={`copy-instructions-btn ${copied ? "copied" : ""}`} onClick={handleCopy} type="button">
      <span className="copy-icon">{copied ? "✓" : "📋"}</span>
      <span>{copied ? "Copied!" : label}</span>
    </button>
  );
}
