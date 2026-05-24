import type { ParsedImportMenu } from "@tastetrail/shared";

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
}`;

function normalizeParsedMenu(parsed: any): ParsedImportMenu {
  return {
    restaurant: {
      name: parsed.restaurant?.name || "Unknown Restaurant",
      cuisine: parsed.restaurant?.cuisine || "Other",
      addressSuburb: parsed.restaurant?.addressSuburb,
      notes: parsed.restaurant?.notes,
    },
    items: Array.isArray(parsed.items)
      ? parsed.items.map((item: any) => ({
          name: item.name || "Unknown Item",
          category: item.category,
          price: typeof item.price === "number" ? item.price : undefined,
          description: item.description,
          tags: Array.isArray(item.tags) ? item.tags : [],
          tried: false,
          notes: "",
        }))
      : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
  };
}

export async function parseMenuWithProvider(provider: string, apiKey: string, model: string, content: string, restaurantHint?: string) {
  const prompt = restaurantHint ? `Restaurant hint: ${restaurantHint}\n\nContent:\n${content}` : content;
  if (provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });
    if (!response.ok) {
      throw new Error(`OpenAI API error (${response.status})`);
    }
    const data = await response.json();
    return normalizeParsedMenu(JSON.parse(data.choices[0].message.content));
  }

  if (provider === "gemini") {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }] }],
        generationConfig: {
          temperature: 0.1,
          response_mime_type: "application/json",
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`Gemini API error (${response.status})`);
    }
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Gemini returned an empty response");
    }
    return normalizeParsedMenu(JSON.parse(text));
  }

  throw new Error(`Unsupported AI provider: ${provider}`);
}
