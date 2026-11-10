# Partner mobile audit

Scope: shared partner navigation, Dashboard, Bookings, Vehicles, Consignments, Earnings, Tracking, Profile, Settings, and Notifications.

## Changes

- Shortened the phone Dashboard hero and placed key figures in two columns.
- Reduced booking summaries to one compact row on phones, bringing booking records into view sooner.
- Reduced earnings card padding and allowed monetary figures to wrap.
- Enlarged phone pill tabs, filters, and search-clear controls; phone search text uses 16px.
- Applied compact page spacing to the partner layout.

## Verification

The browser harness uses real React components, isolated GET-only API fixtures, and a local socket stub. It does not update live records or send withdrawal/application requests.

Nine routes × seven viewport profiles × two orientations = 126 layouts. Profiles: iPhone SE, iPhone 16, iPhone 16 Pro Max, Pixel 9, Pixel 9 Pro, Pixel 10, and Samsung Galaxy A55. The dimensions match the preceding admin audit.

The checks cover runtime errors, page and main horizontal overflow, header action bounds, and scrolled-section visibility. Empty, error, and loading fixtures add 27 state checks. Interaction checks cover the account drawer, booking details, new application, withdrawal, password form, and profile editing, including short portrait and landscape viewports.

See the [before/after comparison](comparison.html) and [raw metrics](after/report.json). Run `PARTNER_MOBILE_PHASE=after node tools/verify-partner-mobile.mjs` from the repository root. Browser fixture scripts must run sequentially because Vite watches their temporary entry files.

This is Chrome viewport emulation, not physical iOS/Safari testing. Tracking uses sample vehicles without live GPS; map-provider availability and real financial/application submissions are outside this visual audit.

Validation: all 126 viewport layouts, 27 state checks, and the listed interactions pass. Targeted ESLint and the production client build pass. The build continues to report a large JavaScript bundle warning.
