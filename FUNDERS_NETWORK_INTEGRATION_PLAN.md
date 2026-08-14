---
permalink: false
---

# The Funders Network — Public Website / App Integration Plan

## Decision

Keep the public marketing site and Funders Network application as separate Netlify sites for the first production rollout:

```text
thefunders.ca      Public marketing, buyer education, blog, current report-builder
app.thefunders.ca  Funders Network application: Realtor, Funders Team, Admin, QR, reports
```

This avoids a route and authentication conflict because this repository already uses:

```text
/admin/             Decap CMS / Netlify Identity
```

while the Funders Network application uses Supabase Auth and its own Administrator portal.

## Domain work

### Public site

No DNS change is required for the existing `thefunders.ca` site.

### App site

Add `app.thefunders.ca` as a custom domain on the Funders Network MVP Netlify site, then create the required DNS record in the domain provider.

After the domain is live, configure the Funders Network application's production environment:

```text
PUBLIC_APP_URL=https://app.thefunders.ca
```

Configure this public Eleventy site as well (not a secret):

```text
FUNDERS_NETWORK_APP_URL=https://app.thefunders.ca
```

Configure Supabase Auth:

```text
Site URL:
https://app.thefunders.ca

Redirect URL:
https://app.thefunders.ca/auth-callback.html
```

## Public-site routes added in this repository

```text
/for-realtors/      Funders Network Realtor landing page
/funders-network    Redirect to /for-realtors/
/partner-login      Redirect to the Realtor login on app.thefunders.ca
```

## Public report-builder and app data: do not leave two disconnected systems

This repository currently uses Netlify Blobs for report storage and lead records:

```text
netlify/functions/save-report.js
netlify/functions/view-report.js
netlify/functions/list-leads.js
```

The Funders Network MVP uses Supabase and HubSpot.

### Recommended transition

1. Keep `/report-builder/` active initially so the consumer flow is not disrupted.
2. Add a secure server-to-server intake bridge from this site's `save-report.js` to the app.
3. Record a normalized source such as:

```text
website_report_builder
```

4. Create/update the same Supabase/HubSpot lead/contact pipeline used by Funders Network QR campaigns.
5. Later consolidate report calculations, consent, secure-link expiry, and rate data into one source of truth.

Do not add a Supabase service-role key to browser code. Do not store app secrets in the repository. Use a server-only shared intake secret or a dedicated authenticated server endpoint.

## Rate-data transition

This repository has a separate static rate file:

```text
_data/rates.json
```

Before public launch, replace hard-coded public rate/recommendation copy with a controlled rate-source process. The live website must not show insured-only products as conventional pricing or imply that a generic rate is the right fit for every buyer.

## Content changes made in this integration patch

- Added `/for-realtors/` with Funders Network positioning.
- Added Partner Login and For Realtors navigation.
- Added homepage Funders Network bridge section.
- Removed unsupported/hard-coded 48-hour pre-approval wording.
- Reframed the homepage report as educational and property-specific, not a lender decision.
- Replaced the hard-coded rate recommendation in the homepage report mock.
- Reframed the payment estimator as illustrative, not a qualification result.
- Updated report-builder consent wording to remove public-posting language and clarify scenario boundaries.

## Required review before production launch

- [ ] Confirm DNS for `app.thefunders.ca`
- [ ] Update Supabase Auth URLs
- [ ] Set custom SMTP, magic-link login, email verification, approved invites
- [ ] Set `FUNDERS_AUTH_REQUIRED=true`
- [ ] Set `FUNDERS_SECURITY_FEATURES_ENABLED=true`
- [ ] Review or replace public Netlify Blobs report-link storage with secure expiry/consent controls
- [ ] Create a source-of-truth rate process
- [ ] Supply conventional/uninsured rate products before showing 20% scenarios as priced options
- [ ] Review privacy, terms, report consent, data retention, testimonials, and rewards programme language
- [ ] Review travel/ticket/referral-compensation/tax requirements for the rewards programme
- [ ] Test Realtor, Funders Team, Admin, buyer QR, and report-builder paths with real test records
