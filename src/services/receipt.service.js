import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";

const GEMINI_MODEL = "gemini-1.5-flash";

const PROMPT = [
  "You are parsing a receipt image for a budgeting app.",
  "Return only valid JSON with this exact shape:",
  "{",
  '  "storeName": string | null,',
  '  "totalAmount": number | null,',
  '  "date": string | null,',
  '  "items": [{ "name": string, "quantity": number, "unitPrice": number, "totalPrice": number }],',
  '  "suggestedCategory": string,',
  '  "confidence": "high" | "medium" | "low",',
  '  "rawText": string',
  "}",
  "Rules:",
  "- date must be YYYY-MM-DD when known, otherwise null",
  "- totalAmount must be numeric when confidently found, otherwise null",
  "- If no itemized lines are visible, return items as []",
  "- suggestedCategory should be one concise category name",
  "- rawText should contain extracted receipt text if available",
  "- Do not include markdown, comments, or extra keys",
].join("\n");

const safeNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const normalizeDate = (value) => {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
};

const sanitizeItem = (item) => {
  if (!item || typeof item !== "object") return null;
  const name = typeof item.name === "string" ? item.name.trim() : "";
  if (!name) return null;

  const quantity = safeNumber(item.quantity) ?? 1;
  const unitPrice = safeNumber(item.unitPrice) ?? 0;
  const totalPrice = safeNumber(item.totalPrice) ?? unitPrice * quantity;

  if (quantity <= 0 || totalPrice < 0) return null;

  return {
    name,
    quantity: Math.round(quantity * 100) / 100,
    unitPrice: Math.round(unitPrice * 100) / 100,
    totalPrice: Math.round(totalPrice * 100) / 100,
  };
};

const extractJson = (raw) => {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const block = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (block) {
      try {
        return JSON.parse(block[1]);
      } catch {
        return null;
      }
    }

    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      try {
        return JSON.parse(trimmed.slice(first, last + 1));
      } catch {
        return null;
      }
    }

    return null;
  }
};

function normalizeParsedReceipt(data) {
  const storeName = typeof data?.storeName === "string" && data.storeName.trim() ? data.storeName.trim() : null;
  const totalAmount = safeNumber(data?.totalAmount);
  const date = normalizeDate(data?.date);
  const items = Array.isArray(data?.items) ? data.items.map(sanitizeItem).filter(Boolean) : [];
  const suggestedCategory =
    typeof data?.suggestedCategory === "string" && data.suggestedCategory.trim()
      ? data.suggestedCategory.trim()
      : "Others";
  const confidence = ["high", "medium", "low"].includes(data?.confidence) ? data.confidence : "medium";
  const rawText = typeof data?.rawText === "string" ? data.rawText : "";

  return {
    storeName,
    totalAmount,
    date,
    items,
    suggestedCategory,
    confidence,
    rawText,
  };
}

export const receiptService = {
  async parseReceiptImage({ imageBase64, mimeType = "image/jpeg" }) {
    if (!env.GEMINI_API_KEY) {
      throw new AppError("Receipt parsing is not configured on server", 503, "RECEIPT_PARSER_DISABLED");
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: imageBase64,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new AppError(`Gemini request failed (${response.status}): ${body}`, 502, "RECEIPT_PARSER_UPSTREAM_ERROR");
    }

    const payload = await response.json();
    const rawModelText =
      payload?.candidates?.[0]?.content?.parts
        ?.map((part) => (typeof part?.text === "string" ? part.text : ""))
        .join("\n") ?? "";

    const parsed = extractJson(rawModelText);
    if (!parsed) {
      throw new AppError("Gemini response did not contain valid JSON", 502, "RECEIPT_PARSER_INVALID_RESPONSE");
    }

    return normalizeParsedReceipt(parsed);
  },
};
