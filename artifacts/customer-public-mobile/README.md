# Customer and public mobile audit

Scope: 15 public routes (Home, Vehicles, Availability, Vehicle Details, Driver Profile, Explore, About, Contact, FAQ, Terms, Privacy, Login, Customer Signup, Partner Signup, Forgot Password) and 11 customer routes (Home, Bookings, Booking Details, Rating, Favorites, Profile, Settings, Checkout, Payment Result, Support, Notifications).

## Changes

- Compacted the customer Bookings header. Empty archive counters and the empty next-ride panel remain available in the wider layout; active trips appear sooner on phones.
- Added fixed-header clearance to checkout, driver profiles, and rating.
- Hid the floating support bubble during checkout/payment results so it cannot cover payment actions.
- Reduced the support panel minimum height for short screens.
- Made signup cards scroll with the page in short mobile/tablet viewports, with a compact step indicator and readable inputs.
- Contained Contact page slide animations so they cannot widen the page.
- Enlarged menu close and date-preset controls. The hero date picker uses a scrollable dialog on short landscape screens.
- Handled rejected review requests on Vehicle Details and displayed an unavailable message instead of leaving unhandled promises.

## Browser checks

26 routes × seven phone profiles × two orientations = 364 viewport checks. Profiles match the preceding admin/partner audits: iPhone SE, iPhone 16, iPhone 16 Pro Max, Pixel 9, Pixel 9 Pro, Pixel 10, and Galaxy A55.

The harness checks runtime errors and page overflow, captures representative viewport screenshots and scrolled pages, and checks loading/error/empty states on nine data screens. Interaction checks cover public/customer menus, the hero date picker, short signup forms, profile editing, new conversations, and booking cancellation dialogs without submitting changes.

See [before/after comparison](comparison.html), [raw metrics](after/report.json), and [tested routes](../../tools/fixtures/customer-public-routes.json).

Reproduce with `CUSTOMER_PUBLIC_PHASE=after node tools/verify-customer-public-mobile.mjs`. Run browser fixture scripts sequentially because Vite watches their temporary entry files.

## Limits

The test uses real components with isolated local API responses and a socket stub. Payment reconciliation is simulated locally; no live accounts, bookings, support messages, or payments are changed. This checks Chrome viewport behavior, not physical iOS/Safari, real on-screen keyboards, third-party payment redirects, or every signup step's server validation. Receipt/statement documents and exceptional routes such as email verification are outside this pass.

Additional checks: targeted ESLint, production build, and 14 existing calendar/registration tests pass. The build still warns about the large JavaScript bundle.
