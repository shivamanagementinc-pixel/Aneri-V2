// netlify/functions/view-report.js
//
// Serves a previously saved report by ID. Reached via the redirect rule
// /r/:id -> /.netlify/functions/view-report?id=:id (add to netlify.toml,
// see instructions).

const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const id = event.queryStringParameters && event.queryStringParameters.id;

  if (!id) {
    return { statusCode: 400, headers: { "Content-Type": "text/plain" }, body: "Missing report id" };
  }

  try {
    const reportsStore = getStore("reports");
    const html = await reportsStore.get(id, { type: "text" });

    if (!html) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "text/html" },
        body: "<h1>Report not found</h1><p>This link may have expired or the report ID is incorrect.</p>"
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: html
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain" },
      body: "Failed to load report: " + String(err).slice(0, 300)
    };
  }
};
