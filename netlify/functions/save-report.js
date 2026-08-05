// netlify/functions/save-report.js
//
// Called right after a report is generated. Stores:
//  - the full frozen report HTML (so a shareable link always shows exactly
//    what was generated, even if rates change later)
//  - a lightweight "lead" record for the dashboard (buyer, agent, MLS,
//    address, price, timestamp) — kept separate from the HTML so listing
//    all leads doesn't require reading every full report body

const { getStore } = require("@netlify/blobs");
const crypto = require("crypto");

exports.handler = async (event) => {
  const headers = { "Content-Type": "application/json" };

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  const { reportHtml, buyer, agent, mlsId, address, price, source, id: clientId } = body;

  if (!reportHtml || !buyer || !agent) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "reportHtml, buyer, and agent are required" }) };
  }
  // Basic sanity limit so this can't be used to store arbitrary huge blobs
  if (reportHtml.length > 2_000_000) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Report HTML too large" }) };
  }
  // If the client supplied an id (a UUID it generated itself so it could bake
  // the report's own permanent URL into the HTML before saving), use it as-is
  // only if it looks like a real UUID — otherwise generate a fresh one.
  const isValidUuid = typeof clientId === "string" && /^[0-9a-f-]{36}$/i.test(clientId);

  try {
    const id = isValidUuid ? clientId : crypto.randomUUID();
    const now = new Date().toISOString();

    const reportsStore = getStore("reports");
    await reportsStore.set(id, reportHtml, { metadata: { contentType: "text/html" } });

    const leadsStore = getStore("leads");
    const leadRecord = {
      id,
      buyer,
      agent,
      mlsId: mlsId || null,
      address: address || null,
      price: price || null,
      source: source || "quick-generate", // 'quick-generate' | 'manual'
      createdAt: now
    };
    await leadsStore.setJSON(id, leadRecord);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ id, viewUrl: `/r/${id}` })
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to save report", detail: String(err).slice(0, 500) }) };
  }
};
