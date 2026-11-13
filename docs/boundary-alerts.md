# Albay boundary monitoring

Implemented in the normalized GPS pipeline; the browser does not decide crossings
or money. A minute sweep reconciles fresh tracker snapshots and retries durable,
deduplicated in-app/browser-push notifications. Position timestamps, tracker
assignment, vehicle status and actual rental handover determine responsibility.

## Defaults and operation

Admin → Settings → Penalties contains the boundary controls, incidents and review
actions. Defaults: alerts on; penalties off; advance warning 2 km; border tolerance
200 m; confirmation 60 seconds with at least two distinct fixes; grace 15 minutes;
proposed fixed charge PHP 500, once per rental, always reviewed by an admin.
PHP 500 is an adjustable business starting point, not a statutory penalty.

Use alerts-only observation with physical trackers before enabling penalties.
Trackers can skip the warning band between reports; an advance warning or browser
push delivery is not guaranteed. Persistent in-app notices remain available.
The bundled province geometry includes islands and coastal boundaries, so advance
warnings can also occur near the coast. Its source/version/license is recorded in
`server/data/boundaries/source.json` and `LICENSE.txt`. It is approximate geographic
evidence, not a cadastral or legal boundary survey. The map's source must be
reviewed when replacing it; retain attribution and test inland/island/border cases.

Crossing confirmation atomically saves the in-app warning and starts the grace
period at server confirmation time; delayed GPS timestamps cannot shorten it.
Missing GPS and long gaps pause
evidence; they do not prove continued travel or reentry. Border jitter does not
reset the countdown. Reentry requires fresh inside fixes beyond the tolerance.
Returning resolves the alert but retains any already eligible financial review.
Resolving an alert manually does not waive the incident or approve a charge.

Customers see a warning before accepting booking terms, a locked policy snapshot
in accepted terms, notifications, and a current warning panel on their booking.
No boundary charge is proposed for rentals without an accepted enabled policy.
New settings cannot raise a locked amount or shorten the locked grace period.
An admin must supply a reason to approve, reduce or waive a proposed charge. The
customer's outside warning must have been persisted before approval. Accepted
charges become ordinary rental ledger entries with an incident reference, appear
separately on statements, and participate in balance/payment calculations.

Admins can approve an outside trip for an ongoing rental, with an expiry up to 30
days and a reason, or revoke it. The permission history is retained. Approval
cancels active incidents and waives pending reviews for that rental; it does not
erase already approved charges. Fresh evidence starts a new incident after expiry.

Disabling boundary alerts disables penalties, resolves boundary alerts, cancels
countdowns and pending financial reviews, and discards undelivered boundary
warnings. Financial approval/waiver notices still deliver. Approved ledger charges and incident history remain. Other GPS alert
types are unaffected. Reenabling requires fresh crossing confirmation.

MongoDB replica-set transactions and existing database guards serialize policy
changes, crossing evaluation and approvals. Partial unique indexes prevent more
than one active incident/alert per vehicle, and a rental-level marker prevents a
second approved charge. Use the application's normal model index initialization
on deployment. No backfill or production data migration is needed.

## Verification

- `node --test tests/gps/boundary.test.js`: geography, chronology and policy rules.
- `node --test tests/gps/boundaryIntegration.test.js` from `server`: isolated local
  MongoDB replica-set tests, HTTP permissions, review/waiver/exemptions and money.
  The suite uses only a uniquely named test database and mocked SMTP.
- `node tools/verify-boundary-feature.mjs`: isolated browser API fixtures, mobile
  widths and landscape, light/dark themes, toggle/save/review interaction. No live
  account or rental writes.

Remaining operational validation: physical GPS reporting cadence and accuracy,
real border-route observation, and push permissions/delivery on customer devices.
Keep penalties disabled until that observation is satisfactory.

## Audit corrections

Boundary events are explicitly allowlisted for browser push. Customers' notices
link to the affected booking; admin notices link to Penalty Settings. Reentry,
exemption and disabling alerts cancel obsolete queued pushes while preserving
their in-app history. The worker checks cancellation again before sending.
Turning only penalties off leaves location alerts active, cancels pending reviews,
and makes the current excursion alerts-only even after reenabling. A later
excursion can qualify again. Approved charges remain unchanged. All pending
reviews are listed ahead of recent incidents, including reviews older than the
100-item recent-history window.
