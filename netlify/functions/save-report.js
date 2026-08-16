// netlify/functions/save-report.js
//
// Called right after a report is generated. Stores:
//  - the full frozen report HTML (so a shareable link always shows exactly
//    what was generated, even if rates change later)
//  - a lightweight "lead" record for the dashboard (buyer, agent, MLS,
//    address, price, timestamp) — kept separate from the HTML so listing
//    all leads doesn't require reading every full report body

const { getConfiguredStore } = require("./_blobs-config");
const crypto = require("crypto");

function publicOrigin(event) {
  const host = event.headers?.host || event.headers?.Host || 'thefunders.ca';
  return `https://${host}`;
}

async function forwardToFundersNetwork(payload) {
  const endpoint = String(process.env.FUNDERS_NETWORK_INGEST_URL || '').trim();
  const secret = String(process.env.FUNDERS_NETWORK_INGEST_SECRET || '').trim();
  // The current public report must continue opening even before the bridge is
  // configured. A missing bridge is intentionally non-blocking during rollout.
  if (!endpoint || !secret) return { status: 'skipped', reason: 'bridge_not_configured' };
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-funders-intake-secret': secret,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { status: 'failed', error: data.error || `HTTP ${response.status}` };
    return { status: 'accepted', intakeId: data.intakeId || null, intakeStatus: data.status || null };
  } catch (error) {
    // Never fail report delivery because the CRM bridge is temporarily unavailable.
    return { status: 'failed', error: String(error.message || error).slice(0, 300) };
  }
}

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

  const {
    reportHtml,
    buyer,
    agent,
    mlsId,
    address,
    price,
    source,
    id: clientId,
    agentEmail,
    agentPhone,
    buyerEmail,
    buyerReportConsent,
    buyerMarketingConsent,
  } = body;

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

    const reportsStore = getConfiguredStore("reports");
    await reportsStore.set(id, reportHtml, { metadata: { contentType: "text/html" } });

    const leadsStore = getConfiguredStore("leads");
    const reportUrl = `${publicOrigin(event)}/r/${id}`;
    const intake = await forwardToFundersNetwork({
      externalReportId: id,
      source: 'website_report_builder',
      reportUrl,
      reportCreatedAt: now,
      buyerLabel: buyer,
      buyerEmail: String(buyerEmail || '').trim(),
      buyerReportConsent: Boolean(buyerReportConsent),
      buyerMarketingConsent: Boolean(buyerMarketingConsent),
      realtorName: agent,
      realtorEmail: String(agentEmail || '').trim(),
      realtorPhone: String(agentPhone || '').trim(),
      propertyAddress: address || null,
      mlsNumber: mlsId || null,
      listPrice: price || null,
    });
    const leadRecord = {
      id,
      buyer,
      buyerEmail: String(buyerEmail || '').trim() || null,
      buyerReportConsent: Boolean(buyerReportConsent),
      buyerMarketingConsent: Boolean(buyerMarketingConsent),
      agent,
      agentEmail: String(agentEmail || '').trim() || null,
      agentPhone: String(agentPhone || '').trim() || null,
      mlsId: mlsId || null,
      address: address || null,
      price: price || null,
      source: source || "quick-generate", // 'quick-generate' | 'manual'
      reportUrl,
      fundersNetworkIntake: intake,
      createdAt: now
    };
    await leadsStore.setJSON(id, leadRecord);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ id, viewUrl: `/r/${id}`, intake })
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to save report", detail: String(err).slice(0, 500) }) };
  }
};
