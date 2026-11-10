# Admin mobile responsiveness audit

Scope: shared admin navigation, Dashboard, Bookings, User Moderation, Vehicles, and Consignments. Screenshots use the real React components with isolated GET-only fixture data; no live records are changed.

## Changes

- Reduced phone hero and summary-card heights to bring operational information into view sooner.
- Made long headers and user names wrap, kept notification/account controls visible, and fitted all user tabs on narrow screens.
- Increased common action, navigation, and close targets; used 16px phone search inputs.
- Kept action menus inside the viewport, including near its bottom edge.
- Fixed Dashboard animation inheritance that left analytics cards transparent after loading.

## Browser coverage

Five pages across seven phone profiles in portrait and landscape (70 layouts): iPhone SE 375×667, iPhone 16 393×852, iPhone 16 Pro Max 440×956, Pixel 9 412×924, Pixel 9 Pro 427×952, Pixel 10 412×924, and Galaxy A55 360×800. Dimensions follow [Chrome DevTools preset definitions](https://raw.githubusercontent.com/ChromeDevTools/devtools-frontend/main/front_end/models/emulation/EmulatedDevices.ts).

The browser script checks horizontal overflow, runtime errors, header action placement, and visible scrolled sections. It also checks empty/error/loading states, account drawer, bottom-edge action menu, user details at short heights, Add Vehicle, booking filters, and the inspection calendar.

See [before/after comparison](comparison.html), [raw metrics](after/report.json), and the PNG screenshots in `before/` and `after/`. Reproduce with `ADMIN_MOBILE_PHASE=after node tools/verify-admin-mobile.mjs` from the repository root. Run browser fixtures sequentially because Vite watches their temporary entry files.

These are Chrome viewport checks with fixture data, not physical-device Safari testing or a full audit of every admin module. Live authentication, uploads, and record mutations are outside this visual test.

## Additional validation

Targeted ESLint and the production client build pass. The build still reports a large JavaScript bundle warning. Existing browser checks for inspection appointments (admin/operator, rescheduling, recovery, and pagination) and ID verification expiry choices also pass.
