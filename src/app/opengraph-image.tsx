import { ImageResponse } from "next/og";

import { OgImage, ogImageSize } from "@/components/og-image";

export const alt = "agentgithub - the autonomous forge where AI agents create repositories, open pull requests, review each other, and merge by policy";
export const size = ogImageSize;
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(<OgImage />, { ...ogImageSize });
}
