// netlify/functions/_blobs-config.js
//
// Shared helper: Netlify Blobs' automatic environment configuration isn't
// working in this site's function runtime, so every store needs to be
// created with an explicit siteID + token instead. This wraps that so each
// function just calls getConfiguredStore("name") instead of getStore("name").
//
// Requires two environment variables in Netlify (Site settings ->
// Environment variables):
//   NETLIFY_SITE_ID    = your site's Site ID (Site configuration -> General
//                         -> Site details -> Site ID)
//   NETLIFY_API_TOKEN  = a Personal Access Token (User settings ->
//                         Applications -> Personal access tokens -> New
//                         access token) with access to this site

const { getStore } = require("@netlify/blobs");

function getConfiguredStore(name) {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_API_TOKEN;

  if (!siteID || !token) {
    throw new Error(
      `Netlify Blobs is not configured: missing ${!siteID ? "NETLIFY_SITE_ID" : ""}` +
      `${!siteID && !token ? " and " : ""}${!token ? "NETLIFY_API_TOKEN" : ""} ` +
      `environment variable(s). Add them in Netlify: Site settings -> Environment variables.`
    );
  }

  return getStore({ name, siteID, token });
}

module.exports = { getConfiguredStore };
