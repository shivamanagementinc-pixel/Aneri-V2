// netlify/functions/lookup-mls.js
//
// Serverless function: takes an MLS number, asks GPT (with web search) to
// find the public listing and return structured JSON. Checks a same-day
// cache before spending an API call on a repeat lookup.
//
// Requires environment variables set in Netlify (Site settings > Environment
// variables), NOT in this file or the repo:
//   OPENAI_API_KEY = <your OpenAI API key>

const { getStore } = require("@netlify/blobs");

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}


const REQUIRED_FIELDS = [
  'address', 'mlsNumber', 'listPrice', 'photoUrl', 'photoIsDirect',
  'beds', 'baths', 'sqft', 'propertyType', 'annualPropertyTax',
  'monthlyCondoFee', 'estMonthlyRent', 'basementRent', 'sourceNotes', 'confidence'
];

const VALID_TYPES = ['Detached', 'Semi-Detached', 'Townhouse', 'Condo'];

function buildPrompt(mlsId) {
  return `You are helping a licensed mortgage broker in Ontario, Canada gather PUBLIC real estate listing details for MLS number "${mlsId}".

Search the web (realtor.ca, Zillow.ca, Sotheby's, Royal LePage, Century 21, RE/MAX, brokerage sites, TRREB-affiliated listing pages, etc.) to find this specific listing.

Return ONLY a single JSON object. No markdown code fences. No commentary before or after. Use exactly these fields:

{
  "address": string,
  "mlsNumber": string,
  "listPrice": number,
  "photoUrl": string,
  "photoIsDirect": boolean,
  "beds": number,
  "baths": number,
  "sqft": number,
  "propertyType": "Detached" | "Semi-Detached" | "Townhouse" | "Condo",
  "annualPropertyTax": number,
  "monthlyCondoFee": number,
  "estMonthlyRent": number,
  "basementRent": number,
  "sourceNotes": string,
  "confidence": "high" | "medium" | "low"
}

Rules:
- "photoUrl": if you can find a DIRECT image file URL (ends in .jpg/.jpeg/.png/.webp, or is a known image CDN link), use that and set "photoIsDirect" to true. Otherwise use the best listing page URL you found and set "photoIsDirect" to false.
- "monthlyCondoFee": 0 if freehold / no condo fee.
- "basementRent": 0 if there's no separately rentable basement/suite.
- "estMonthlyRent": give ONE best-estimate number, not a range. If the listing doesn't state a rent estimate, use comparable market rent for similar properties in the area and lower "confidence" accordingly, and say so in "sourceNotes".
- "sourceNotes": 1-2 short sentences on where this came from and anything you're unsure about.
- "confidence": "high" only if you found the actual listing with most fields explicitly stated. "medium" if you found the listing but had to estimate some fields (like rent). "low" if you're relying mostly on inference/comparables rather than the actual listing.
- If you cannot find this listing at all, return exactly: {"error": "not found", "sourceNotes": "<why>"}

Return ONLY the JSON object, nothing else.`;
}

function extractJson(text) {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw e;
  }
}

function sanitize(parsed) {
  const out = {};
  out.address = String(parsed.address || '').trim();
  out.mlsNumber = String(parsed.mlsNumber || '').trim();
  out.listPrice = Number(parsed.listPrice) || 0;
  out.photoUrl = String(parsed.photoUrl || '').trim();
  out.photoIsDirect = !!parsed.photoIsDirect;
  out.beds = Number(parsed.beds) || 0;
  out.baths = Number(parsed.baths) || 0;
  out.sqft = Number(parsed.sqft) || 0;
  out.propertyType = VALID_TYPES.includes(parsed.propertyType) ? parsed.propertyType : 'Detached';
  out.annualPropertyTax = Number(parsed.annualPropertyTax) || 0;
  out.monthlyCondoFee = Number(parsed.monthlyCondoFee) || 0;
  out.estMonthlyRent = Number(parsed.estMonthlyRent) || 0;
  out.basementRent = Number(parsed.basementRent) || 0;
  out.sourceNotes = String(parsed.sourceNotes || '').trim();
  out.confidence = ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low';
  return out;
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let mlsId;
  try {
    const body = JSON.parse(event.body || '{}');
    mlsId = (body.mlsId || '').trim();
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!mlsId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'mlsId is required' }) };
  }
  if (mlsId.length > 40) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'mlsId looks invalid (too long)' }) };
  }

  // Same-day cache: if this MLS number was already looked up today, reuse
  // that result instead of spending another API call.
  const cacheKey = `${mlsId}__${todayKey()}`;
  try {
    const cacheStore = getStore('mls-cache');
    const cached = await cacheStore.get(cacheKey, { type: 'json' });
    if (cached) {
      return { statusCode: 200, headers, body: JSON.stringify({ ...cached, fromCache: true }) };
    }
  } catch (e) {
    // Cache read failing shouldn't block a fresh lookup — just proceed.
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: 'Server is missing OPENAI_API_KEY. Add it in Netlify: Site settings \u2192 Environment variables, then redeploy.' })
    };
  }

  try {
    const resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-5.6-luna',
        input: buildPrompt(mlsId),
        tools: [{ type: 'web_search' }]
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'OpenAI API error', detail: errText.slice(0, 500) }) };
    }

    const data = await resp.json();
    // Responses API returns an "output" array of typed items. When a web_search
    // tool call happens first, the message item (with the actual text) may not
    // be output[0], so scan for the first "message" item rather than assuming.
    const messageItem = (data.output || []).find(item => item.type === 'message');
    const textParts = messageItem && messageItem.content ? messageItem.content : [];
    const text = textParts.filter(p => p.type === 'output_text').map(p => p.text || '').join('');

    if (!text) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'OpenAI returned no text content', detail: JSON.stringify(data).slice(0, 500) }) };
    }

    let parsed;
    try {
      parsed = extractJson(text);
    } catch (e) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Could not parse OpenAI response as JSON', detail: text.slice(0, 500) }) };
    }

    if (parsed.error) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: parsed.error, sourceNotes: parsed.sourceNotes || '' }) };
    }

    const clean = sanitize(parsed);

    try {
      const cacheStore = getStore('mls-cache');
      await cacheStore.setJSON(cacheKey, clean);
    } catch (e) {
      // Cache write failing shouldn't fail the request — the lookup itself
      // already succeeded, just skip caching this time.
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ...clean, fromCache: false }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to process listing lookup', detail: String(err).slice(0, 500) }) };
  }
};
