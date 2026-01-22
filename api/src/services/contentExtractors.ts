/**
 * Content extraction utilities for different source types
 * - URL: Playwright for JavaScript-rendered pages
 * - Image: Tesseract.js for OCR
 * - Text: Direct passthrough
 */

import { chromium } from 'playwright';
import Tesseract from 'tesseract.js';

/**
 * Extract visible text content from a URL using headless Chromium
 * Handles JavaScript-rendered menus and ordering pages
 */
export async function extractFromUrl(url: string): Promise<string> {
  let browser;
  
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    const page = await browser.newPage();
    
    // Set reasonable timeout and wait for network to be mostly idle
    await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    
    // Extract visible text from the page
    const text = await page.evaluate(() => {
      // Remove script and style tags
      const scripts = document.querySelectorAll('script, style, noscript');
      scripts.forEach(el => el.remove());
      
      return document.body.innerText;
    });
    
    await browser.close();
    
    if (!text || text.trim().length === 0) {
      throw new Error('No text content extracted from URL');
    }
    
    return text.trim();
  } catch (error) {
    if (browser) {
      await browser.close();
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
