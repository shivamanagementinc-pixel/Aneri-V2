---
permalink: false
---

# P0 Report-Builder Safety Patch

## Scope of this patch

This patch keeps the existing public report-builder functional while removing public wording that could imply:

- a guaranteed pre-approval timeline
- a lender decision or qualification outcome
- a universally preferred rate/product
- current/live pricing when the repository is still using static scenario data

## Changes

- Reframes report output as an **educational property financing scenario**.
- Replaces `Current Mortgage Rates — Updated Weekly` with `Illustrative rate scenarios`.
- Replaces `Our Recommendation` with `Points to review`.
- Replaces `Quick Qualification Snapshot` with `Illustrative affordability context`.
- Removes the public `Get a personalized pre-approval in 48 hours` and `No impact on your credit score` wording.
- Changes the main CTA to `Request a financing review`.
- Uses the approved disclosure:

  ```text
  thefunders.ca operates under BRX Mortgage Inc., FSRA Licence #13463.
  ```

- Updates the standalone sample report at `reports/buyer-report-v3.html` to use the same language.
- Changes static preferred/best-rate labels to neutral scenario language.

## What this patch does not do

It does not create a live rate integration.

The public report-builder still reads scenario data from:

```text
_data/rates.json
```

A later dedicated report-engine/rate-source integration must replace static scenario data with controlled current rate-book logic, including scope guards for insured versus conventional scenarios.

## Privacy note

The existing report links are stored through Netlify Blobs and served at `/r/:id`. Before broad consumer promotion, complete the planned secure report-link/consent/expiry data-bridge work to Supabase and HubSpot.
