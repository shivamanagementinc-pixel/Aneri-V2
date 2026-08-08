// netlify/functions/lookup-mls.js
//
// Serverless function: takes an MLS number, asks GPT (with web search) to
// find the public listing and return structured JSON. Checks a same-day
// cache before spending an API call on a repeat lookup.
//
// Requires environment variables set in Netlify (Site settings > Environment
// variables), NOT in this file or the repo:
//   OPENAI_API_KEY = <your OpenAI API key>

const { getConfiguredStore } = require("./_blobs-config");

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

SEARCH STRATEGY (follow this order, do not give up after one attempt):
1. First, search the EXACT simple query: MLS ${mlsId}
2. If that doesn't find it, try: "${mlsId}" real estate
3. If still nothing, try the number with common aggregator sites specifically, since these index MLS numbers directly and are often the fastest way to find a listing: site:zolo.ca ${mlsId}, site:housesigma.com ${mlsId}, site:zoocasa.com ${mlsId}, site:realtor.ca ${mlsId}
4. Also check individual brokerage sites if the above don't work: Royal LePage, RE/MAX, Century 21, Sotheby's, Chestnut Park, and any brokerage name that turns up in earlier results.
5. Note: MLS numbers starting with certain letters (e.g. "N", "W", "E", "C") indicate specific TRREB (Toronto Regional Real Estate Board) districts — this is a real, valid MLS format, not an error, even for rental listings.
6. Only return "not found" after genuinely trying multiple search variations above — a single search returning nothing is NOT sufficient to conclude the listing doesn't exist.

Search the web to find this specific listing using the strategy above.

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
    const cacheStore = getConfiguredStore('mls-cache');
    const cached = await cacheStore.get(cacheKey, { type: 'json' });
    if (cached) {
      return { statusCode: 200, headers, body: JSON.stringify({ ...cached, fromCache: true }) };
    }
  } catch (e) {
    // Cache read failing shouldn't block a fresh lookup — just proceed.
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: 'Server is missing GEMINI_API_KEY. Add it in Netlify: Site settings \u2192 Environment variables, then redeploy.' })
    };
  }

  try {
    const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        model: 'gemini-3.6-flash',
        input: buildPrompt(mlsId),
        tools: [{ type: 'google_search' }]
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Gemini API error', detail: errText.slice(0, 500) }) };
    }

    const data = await resp.json();
    // Interactions API returns a "steps" array of typed items (thought,
    // google_search_call, google_search_result, model_output, ...). The
    // actual answer lives in the step with type "model_output", so scan
    // for it rather than assuming a fixed position.
    const outputStep = (data.steps || []).find(step => step.type === 'model_output');
    const textBlocks = outputStep && outputStep.content ? outputStep.content : [];
    const text = textBlocks.filter(b => b.type === 'text').map(b => b.text || '').join('');

    if (!text) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Gemini returned no text content', detail: JSON.stringify(data).slice(0, 500) }) };
    }

    let parsed;
    try {
      parsed = extractJson(text);
    } catch (e) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Could not parse Gemini response as JSON', detail: text.slice(0, 500) }) };
    }

    if (parsed.error) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: parsed.error, sourceNotes: parsed.sourceNotes || '' }) };
    }

    const clean = sanitize(parsed);

    try {
      const cacheStore = getConfiguredStore('mls-cache');
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
