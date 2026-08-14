const withoutTrailingSlash = (value) => String(value || '').replace(/\/$/, '');

module.exports = {
  // Set FUNDERS_NETWORK_APP_URL in the public-site Netlify environment for
  // staging/production. This is intentionally not a secret.
  appUrl: withoutTrailingSlash(process.env.FUNDERS_NETWORK_APP_URL || 'https://app.thefunders.ca'),
};
