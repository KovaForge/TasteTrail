import Tesseract from "tesseract.js";

function htmlToText(html: string) {
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  text = text.replace(/<\/(div|p|li|tr|h[1-6]|section|article|header|footer|nav|br|hr)[^>]*>/gi, "\n");
  text = text.replace(/<(br|hr)\s*\/?>/gi, "\n");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, "\"");
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, " ");
  return text.replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n").trim();
}

export async function extractFromUrl(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "TasteTrailImportBot/2.0",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while loading URL`);
  }
  const html = await response.text();
  const text = htmlToText(html);
  if (!text || text.length < 50) {
    throw new Error("Could not extract meaningful text from URL. JavaScript rendering likely required.");
  }
  return text;
}

export async function extractFromImage(base64Data: string) {
  const imageBuffer = Buffer.from(base64Data, "base64");
  const { data } = await Tesseract.recognize(imageBuffer, "eng", {
    logger: () => {},
  });
  if (!data.text.trim()) {
    throw new Error("No text extracted from image");
  }
  return data.text.trim();
}

export function extractFromText(text: string) {
  if (!text.trim()) {
    throw new Error("Empty text provided");
  }
  return text.trim();
}
