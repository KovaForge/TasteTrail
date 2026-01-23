/**
 * Content extraction utilities for different source types
 * - URL: HTTP fetch with HTML-to-text conversion
 * - Image: Tesseract.js for OCR
 * - Text: Direct passthrough
 */

import Tesseract from 'tesseract.js';

/**
 * Strip HTML tags and decode entities, returning visible text content
 */
function htmlToText(html: string): string {
  // Extract text from JSON-LD structured data if present (common for restaurant menus)
  const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  let structuredText = '';
  if (jsonLdMatches) {
    for (const match of jsonLdMatches) {
      const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '');
      try {
        const data = JSON.parse(jsonContent);
        if (data['@type'] === 'Menu' || data['@type'] === 'Restaurant' || data.hasMenu) {
          structuredText += JSON.stringify(data, null, 2) + '\n';
        }
      } catch {
        // Not valid JSON, skip
      }
    }
  }

  // Also look for embedded state/data in script tags (common in SPAs)
  const stateMatches = html.match(/<script[^>]*>\s*(?:window\.__INITIAL_STATE__|window\.__NEXT_DATA__|window\.__NUXT__)\s*=\s*({[\s\S]*?})\s*;?\s*<\/script>/gi);
  if (stateMatches) {
    for (const match of stateMatches) {
      const jsonPart = match.replace(/<script[^>]*>\s*(?:window\.__\w+__)\s*=\s*/i, '').replace(/;?\s*<\/script>/i, '');
      try {
        const data = JSON.parse(jsonPart);
        structuredText += JSON.stringify(data, null, 2) + '\n';
      } catch {
        // Not valid JSON, skip
      }
    }
  }

  // Remove script and style blocks
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  // Replace block-level tags with newlines
  text = text.replace(/<\/(div|p|li|tr|h[1-6]|section|article|header|footer|nav|br|hr)[^>]*>/gi, '\n');
  text = text.replace(/<(br|hr)\s*\/?>/gi, '\n');

  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));

  // Collapse whitespace
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n/g, '\n');
  text = text.trim();

  // Prepend structured data if found
  if (structuredText) {
    return `[Structured Data]\n${structuredText}\n\n[Page Content]\n${text}`;
  }

  return text;
}

/**
 * Extract text content from a URL using HTTP fetch
 * Falls back to raw HTML text extraction since Playwright is not available on Azure Functions
 */
export async function extractFromUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    if (!html || html.trim().length === 0) {
      throw new Error('Empty response from URL');
    }

    const text = htmlToText(html);

    if (!text || text.trim().length < 50) {
      throw new Error(
        'Could not extract meaningful text from URL. The page may require JavaScript rendering. ' +
        'Try copying and pasting the menu text directly instead.'
      );
    }

    return text;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Could not extract')) {
      throw error;
    }
    throw new Error(`Failed to extract from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from an image using Tesseract OCR
 */
export async function extractFromImage(imageBuffer: Buffer): Promise<string> {
  try {
    const { data: { text } } = await Tesseract.recognize(
      imageBuffer,
      'eng',
      {
        logger: () => {}, // Suppress logs
      }
    );

    if (!text || text.trim().length === 0) {
      throw new Error('No text extracted from image');
    }

    return text.trim();
  } catch (error) {
    throw new Error(`Failed to extract from image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Text passthrough (no extraction needed)
 */
export function extractFromText(text: string): string {
  if (!text || text.trim().length === 0) {
    throw new Error('Empty text provided');
  }
  return text.trim();
}
