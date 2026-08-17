---
permalink: false
---

# Public Report-Builder → Funders Network Intake & Phone Follow-up Bridge

## Purpose

The public report-builder stores each generated report in the existing public-site report storage, then sends only normalized report metadata to the Funders Network app.

```text
thefunders.ca report-builder
→ save-report Netlify Function
→ secure app.thefunders.ca intake endpoint
→ Supabase website_report_intakes
→ canonical Funders lead (when email + report consent exist)
→ HubSpot Contact (when configured)
```

When the buyer later requests a financing review from the saved report, the report CTA securely captures a required phone number:

```text
saved report CTA
→ capture-report-phone public Netlify Function
→ existing private app intake endpoint (server-to-server secret)
→ website_report_intakes.buyer_phone
→ linked canonical leads.phone
→ optional HubSpot standard phone update
```

## Required public-site Netlify environment variables

```text
FUNDERS_NETWORK_INGEST_URL=https://app.thefunders.ca/api/public-report-intake
FUNDERS_NETWORK_INGEST_SECRET=<same private shared value configured on the MVP app>
```

These are server-only Netlify Function variables. Never put the secret in browser JavaScript, CMS content, GitHub, a report URL, or an HTML form.

No additional public-site secret is required for phone capture. The browser provides a per-report capability token to the public function; only the public function holds the shared app secret.

## Consent and privacy behaviour

- The primary public flow asks for name/household label, buyer email, MLS number, Terms/Privacy agreement, report consent, and optional marketing consent.
- Buyer-only public reports are presented by The Funders Team and do not create or link a Realtor record.
- Report consent is required before a canonical Funders lead or HubSpot Contact is created.
- The report CTA asks only for a mandatory phone number because name and email were captured before the report was generated.
- The phone CTA expressly requests follow-up about the report. It does **not** create marketing consent, approval, pre-approval, qualification, or lender commitment.
- Phone numbers are sent to the secured Funders Network lead/intake record. They are not placed in URLs, report links, lead-event metadata, or Realtor-visible views.
- Legacy/incomplete events without buyer email or report consent remain intake-only records. Phone capture does not create a lead from an unconsented intake.
- Funders Team members can use the linked canonical lead for calls, activity logging, next actions, and high-level Realtor updates. Realtor privacy boundaries remain unchanged.

## Reliability behaviour

- A generated report opens from its saved permanent `/r/<report-id>` URL only after public report storage confirms success.
- The original intake bridge remains non-blocking for report delivery during a temporary app/HubSpot outage.
- The phone CTA never displays a local success message until the secure server-to-server update succeeds.
- If the secure update cannot be confirmed, the buyer sees a neutral retry/direct-contact message instead.

## Required rollout order

1. Run Supabase migration `017_website_report_phone_capture.sql` after confirming migrations 015 and 016 have completed. This additive schema change is safe before code deployment.
2. Deploy the MVP app phone-capture patch.
3. Confirm the MVP app health version and `Admin Portal → Website Reports` load.
4. Deploy the public P2 + phone-capture patch.
5. In its Netlify Deploy Preview, generate one fictional report using an internal test email and report consent.
6. Open the saved report, click **Request a financing review**, enter a fictional test phone number, and confirm the success message appears only after submission.
7. In the Admin Portal, confirm the Website Reports row says phone captured and its canonical Funders lead shows the phone internally.
8. Assign the test lead to a Funders Team member and confirm the Team Workspace can see the phone and original report.

Do not test with a real buyer until legal/compliance review and launch safeguards are complete.
