// netlify/functions/list-leads.js
//
// Returns all logged leads for the dashboard. Protected using the same
// Netlify Identity system already set up for /admin — the frontend must
// send the logged-in user's JWT as a Bearer token, and Netlify populates
// context.clientContext.user automatically when that token is valid.
// No extra login system needed; the same account that can access /admin
// can access /leads.

const { getConfiguredStore } = require("./_blobs-config");

exports.handler = async (event, context) => {
  const headers = { "Content-Type": "application/json" };

  // Netlify populates this automatically from a valid Identity JWT sent in
  // the Authorization header. If it's missing, the request isn't logged in.
  const user = context.clientContext && context.clientContext.user;
  if (!user) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "Not authenticated. Please log in." }) };
  }

  try {
    const leadsStore = getConfiguredStore("leads");
    const { blobs } = await leadsStore.list();

    const leads = await Promise.all(
      blobs.map(async (b) => {
        const record = await leadsStore.get(b.key, { type: "json" });
        return record;
      })
    );

    leads.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return { statusCode: 200, headers, body: JSON.stringify({ leads }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to list leads", detail: String(err).slice(0, 500) }) };
  }
};
