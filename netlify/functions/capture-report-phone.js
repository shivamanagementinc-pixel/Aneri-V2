// Receives a buyer phone number from the saved public report CTA.
// The browser never receives the Funders app intake secret. It must present
// both the report ID and an unguessable per-report capability token stored in
// the private Netlify Blobs lead record before this function forwards anything.

const crypto = require('crypto');
const { getConfiguredStore } = require('./_blobs-config');

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function response(statusCode, body) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value.trim());
}

function secureEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function normalizePhone(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 60 || !/^[0-9+().\-\s]+$/.test(raw)) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;
  return digits.length === 10 ? `+1${digits}` : `+${digits}`;
}

async function forwardPhoneCapture({ reportId, buyerPhone }) {
  const endpoint = String(process.env.FUNDERS_NETWORK_INGEST_URL || '').trim();
  const secret = String(process.env.FUNDERS_NETWORK_INGEST_SECRET || '').trim();
  if (!endpoint || !secret) {
    return { ok: false, status: 503, code: 'integration_unavailable' };
  }

  try {
    const result = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-funders-intake-secret': secret,
      },
      body: JSON.stringify({
        action: 'capture_report_phone',
        externalReportId: reportId,
        buyerPhone,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const payload = await result.json().catch(() => ({}));
    if (!result.ok) {
      // Do not return internal service details to a public browser.
      console.error('Funders phone capture forward failed:', result.status, payload?.error || 'unknown error');
      return { ok: false, status: result.status >= 500 ? 503 : 409, code: 'capture_rejected' };
    }
    return { ok: true };
  } catch (error) {
    console.error('Funders phone capture forward failed:', String(error.message || error));
    return { ok: false, status: 503, code: 'integration_unavailable' };
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return response(405, { error: 'Method not allowed' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return response(400, { error: 'Invalid request.' });
  }

  const reportId = String(body.reportId || '').trim();
  const contactToken = String(body.contactToken || '').trim();
  const buyerPhone = normalizePhone(body.buyerPhone);
  if (!isUuid(reportId) || !isUuid(contactToken)) return response(400, { error: 'This report follow-up request could not be verified.' });
  if (!buyerPhone) return response(400, { error: 'Enter a valid phone number with at least 10 digits.' });

  try {
    const leadsStore = getConfiguredStore('leads');
    const leadRecord = await leadsStore.get(reportId, { type: 'json' });
    if (!leadRecord) return response(404, { error: 'This saved report could not be found.' });
    if (!leadRecord.buyerEmail || !leadRecord.buyerReportConsent) {
      return response(409, { error: 'This report is not available for phone follow-up.' });
    }
    if (!leadRecord.contactUpdateToken) {
      return response(409, { error: 'This saved report was created before secure phone follow-up was available. Please contact The Funders Team directly.' });
    }
    if (!secureEqual(contactToken, leadRecord.contactUpdateToken)) {
      return response(401, { error: 'This report follow-up request could not be verified.' });
    }

    const forwarded = await forwardPhoneCapture({ reportId, buyerPhone });
    if (!forwarded.ok) {
      return response(forwarded.status, {
        error: forwarded.code === 'capture_rejected'
          ? 'We could not save your phone number for this report. Please contact The Funders Team directly.'
          : 'Phone follow-up is temporarily unavailable. Please contact The Funders Team directly.',
      });
    }

    // Keep only a non-sensitive confirmation timestamp in the public-site
    // record. The phone number itself is stored once in the secured Funders
    // Network intake/lead record, not duplicated in Netlify Blobs.
    await leadsStore.setJSON(reportId, {
      ...leadRecord,
      phoneCapturedAt: new Date().toISOString(),
    });

    return response(200, { accepted: true, phoneCaptured: true });
  } catch (error) {
    console.error('Report phone capture error:', String(error.message || error));
    return response(500, { error: 'Phone follow-up is temporarily unavailable. Please contact The Funders Team directly.' });
  }
};
