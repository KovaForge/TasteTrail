/**
 * AI Provider interfaces and implementations for menu parsing
 * Supports OpenAI and Gemini with proper error handling
 */

export interface ParsedMenu {
  restaurant: {
    name: string;
    cuisine: string;
    addressSuburb?: string;
    notes?: string;
  };
  items: Array<{
    name: string;
    category?: string;
    price?: number;
    description?: string;
    tags?: string[];
    tried: boolean;
    notes: string;
  }>;
  warnings: string[];
}

export interface AIProvider {
  parseMenu(content: string, restaurantHint?: string): Promise<ParsedMenu>;
  testConnection(): Promise<{ success: boolean; message: string; model: string }>;
}

const SYSTEM_PROMPT = `You are a menu extraction assistant. Extract restaurant and menu item data from the provided content.

Return ONLY valid JSON matching this schema:
{
  "restaurant": {
    "name": string,
    "cuisine": string,
    "addressSuburb"?: string,
    "notes"?: string
  },
  "items": [
    {
      "name": string,
      "category"?: string,
      "price"?: number,
      "description"?: string,
      "tags"?: string[],
      "tried": false,
      "notes": ""
    }
  ],
  "warnings": string[]
}

Rules:
- Preserve exact item names as written
- Infer cuisine type if obvious (Italian, Chinese, etc.), otherwise use "Other"
- Leave price as null if unclear or missing
- Do NOT invent menu items
- Include a warning if information is ambiguous or incomplete`;

/**
 * OpenAI GPT Provider
 */
export class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4o') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async parseMenu(content: string, restaurantHint?: string): Promise<ParsedMenu> {
    const userPrompt = restaurantHint 
      ? `Restaurant hint: ${restaurantHint}\n\nContent:\n${content}`
      : content;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    
    return this.validateAndNormalize(parsed);
  }

  async testConnection(): Promise<{ success: boolean; message: string; model: string }> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (response.ok) {
        return {
          success: true,
          message: 'Connection successful',
          model: this.model,
        };
      } else {
        const error = await response.text();
        return {
          success: false,
          message: `Authentication failed: ${error}`,
          model: this.model,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Network error',
        model: this.model,
      };
    }
  }

  private validateAndNormalize(parsed: any): ParsedMenu {
    // Ensure required fields exist with defaults
    return {
      restaurant: {
        name: parsed.restaurant?.name || 'Unknown Restaurant',
        cuisine: parsed.restaurant?.cuisine || 'Other',
        addressSuburb: parsed.restaurant?.addressSuburb,
        notes: parsed.restaurant?.notes,
      },
      items: (parsed.items || []).map((item: any) => ({
        name: item.name || 'Unknown Item',
        category: item.category,
        price: typeof item.price === 'number' ? item.price : undefined,
        description: item.description,
        tags: Array.isArray(item.tags) ? item.tags : [],
        tried: false,
        notes: '',
      })),
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    };
  }
}

/**
 * Google Gemini Provider
 */
export class GeminiProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-2.0-flash-exp') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async parseMenu(content: string, restaurantHint?: string): Promise<ParsedMenu> {
    const userPrompt = restaurantHint 
      ? `Restaurant hint: ${restaurantHint}\n\nContent:\n${content}`
      : content;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${SYSTEM_PROMPT}\n\nUser request:\n${userPrompt}`,
            }],
          }],
          generationConfig: {
            temperature: 0.1,
            response_mime_type: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson?.error?.message?.includes('User location is not supported')) {
          throw new Error('Gemini API is not available in your server\'s region. Please use OpenAI provider instead.');
        }
        throw new Error(`Gemini API error (${response.status}): ${errorJson?.error?.message || errorText}`);
      } catch (e) {
        if (e instanceof Error && e.message.includes('not available')) throw e;
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
      }
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textContent) {
      throw new Error('No response from Gemini');
    }

    const parsed = JSON.parse(textContent);
    return this.validateAndNormalize(parsed);
  }

  async testConnection(): Promise<{ success: boolean; message: string; model: string }> {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}?key=${this.apiKey}`
      );

      if (response.ok) {
        return {
          success: true,
          message: 'Connection successful',
          model: this.model,
        };
      } else {
        const errorText = await response.text();
        let message = `API error (${response.status}): ${errorText}`;

        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson?.error?.message?.includes('User location is not supported')) {
            message = 'Gemini API is not available in your server\'s region. Please use OpenAI provider instead, or deploy your server in a supported region.';
          } else if (errorJson?.error?.message) {
            message = errorJson.error.message;
          }
        } catch {
          // Use raw error text
        }

        return {
          success: false,
          message,
          model: this.model,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Network error',
        model: this.model,
      };
    }
  }

  private validateAndNormalize(parsed: any): ParsedMenu {
    return {
      restaurant: {
        name: parsed.restaurant?.name || 'Unknown Restaurant',
        cuisine: parsed.restaurant?.cuisine || 'Other',
        addressSuburb: parsed.restaurant?.addressSuburb,
        notes: parsed.restaurant?.notes,
      },
      items: (parsed.items || []).map((item: any) => ({
        name: item.name || 'Unknown Item',
        category: item.category,
        price: typeof item.price === 'number' ? item.price : undefined,
        description: item.description,
        tags: Array.isArray(item.tags) ? item.tags : [],
        tried: false,
        notes: '',
      })),
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    };
  }
}

/**
 * Factory function to create provider instances
 */
export function createProvider(provider: string, apiKey: string, model: string): AIProvider {
  if (provider === 'openai') {
    return new OpenAIProvider(apiKey, model);
  } else if (provider === 'gemini') {
    return new GeminiProvider(apiKey, model);
  } else {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }
}
