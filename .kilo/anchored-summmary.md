<template>
## Objective
- Harden the valid-ID renewal workflow against quota abuse and IDOR while adding admin-configurable renewal limits and expiration notifications, and replace "Operator" UI text with "Partner" throughout the client.

## Important Details
- Constraints/preferences: UI text replacement "Operator" → "Partner" in client only, no functionality changes; no test/lint scripts configured in package.json
- Important facts: Backend at server/, client at client/; various backend and frontend changes made; settings model `notifyOnExpired` default mismatch and `maxAttempts` additions completed; route bug fixed

## Work State
### Completed
- Valid-ID renewal workflow hardening: route bug fix, Settings model `notifyOnExpired` default fix, `maxAttempts` added to model and validator, client-side validation fix, `uploadRenewedValidId` missing `validIdExpirationDate` fixed, `checkValidIdExpirationNotifications` missing `notifyOnExpired` check added, `settingsService.js` missing `maxAttempts` default added
- Operator→Partner UI text replacement: 20+ files edited including navigation, sidebars, modals, forms, tables, cards, FAQ, ToS, Privacy pages

### Active
- Runtime verification of backend changes; regression test coverage still outstanding

### Blocked
- (none)

## Next Move
1. Run relevant backend tests and validate behavior; fix any failures and add regression coverage
2. Verify all Operator→Partner text replacements are complete across the client

## Relevant Files
- server/: valid-ID renewal workflow hardening files
- client/src/config/navigation.js
- client/src/components/layout/OperatorSidebar.jsx, UserMenu.jsx
- client/src/components/common/StatusChip.jsx
- client/src/components/tables/TransactionTable.jsx, BookingTable.jsx
- client/src/pages/admin/Payouts/Payouts.jsx
- client/src/pages/admin/Consignments/Consignments.jsx
- client/src/pages/public/RegisterOperator.jsx, Login.jsx, FAQ.jsx, TermsOfService.jsx, Privacy.jsx
- client/src/components/operator/OperatorAccountForm.jsx, CreateOperatorDialog.jsx
- client/src/components/consignments/OperatorCard.jsx
- client/src/components/pendingVehicles/PendingVehicleCard.jsx
- client/src/pages/operator/Earnings/Earnings.jsx
- client/src/pages/admin/UserModeration/UserModeration.jsx
- client/src/constants/consignmentConstants.js