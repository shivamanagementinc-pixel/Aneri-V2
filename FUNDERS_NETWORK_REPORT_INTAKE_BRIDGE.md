---
permalink: false
---

# Public Report-Builder → Funders Network Intake Bridge

## Purpose

The public report-builder continues to store its generated report in the existing public-site report storage. After saving, it can now send normalized metadata to the Funders Network app.

```text
thefunders.ca report-builder
→ save-report Netlify Function
→ secure app.thefunders.ca intake endpoint
→ Supabase website_report_intakes
→ HubSpot Contact only when buyer email + report consent exist
```

## Required public-site Netlify environment variables

```text
FUNDERS_NETWORK_INGEST_URL=https://app.thefunders.ca/api/public-report-intake
FUNDERS_NETWORK_INGEST_SECRET=<same private shared value configured on the MVP app>
```

These are server-only Netlify Function variables. Never put the secret in browser JavaScript, CMS content, GitHub, or an HTML form.

## Non-blocking behaviour

Report generation remains available if the bridge is not configured or is temporarily unavailable. The function records a local status but never blocks the requested report from opening.

## Consent behaviour

- Buyer email is optional.
- If a buyer email is supplied, report consent is required before the email is forwarded to the Funders Network and HubSpot.
- Marketing consent is optional and is forwarded as intake metadata only.
- If buyer email or report consent is missing, an Admin intake record is still created when the bridge is configured, but no HubSpot Contact is created.

## Rollout order

1. Deploy the MVP app patch and run migration 015.
2. Configure the shared secret on the MVP app Netlify site.
3. Confirm `Admin Portal → Website Reports` works.
4. Configure the two public-site environment variables.
5. Deploy this public-site patch.
6. Generate one fictional report with an email you control.
7. Confirm the intake and HubSpot status in the Admin Portal.
