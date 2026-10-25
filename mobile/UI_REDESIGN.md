# Financial UI redesign

Implemented in the existing Kotlin / Compose application, preserving pairing, Room, offline queues, conflict handling, reminders and update verification.

## Visual system

`ui/BudgetTheme.kt` defines ivory and forest light surfaces, independently tuned dark surfaces, Material 3 typography and rounded shapes, spacing, chart category colors and 220 ms motion. Profile saves System / Light / Dark in local preferences. `ui/FinancialComponents.kt` supplies shared vector icons, balance and summary cards, transaction rows, budget progress, empty states and interactive charts. French application labels and French-Canadian CAD formatting are used.

## Navigation and periods

Home, Transactions, Budget, Insights and Profile share a thumb-accessible bottom navigation. An add-entry action remains available on financial pages. Operational settings, household and recurring controls live in Profile; offline, sync and errors remain visible when actionable.

Horizontal swipes and accessible arrow buttons change the selected month. The whole financial page slides in the appropriate direction. Dashboard frames preserve their own month data during transitions. Room-driven insights and budget plans carry their month, preventing a previous month's data from appearing under a new heading. Month changes retain the existing ViewModel refresh mechanism. New entries default to a valid date in the selected month.

## Financial meaning

Dashboard accepted totals and balances retain the server as their source. Planned money left keeps its original meaning (income less bills, category estimates and savings target); it is not relabeled as a category budget remainder. Savings is an account balance, not monthly earnings.

Charts use accepted cached ledger entries, including category adjustments as spending to match server semantics. Savings transfers and opening balance adjustments are excluded from income/spending charts. Queued operations are displayed separately and do not inflate accepted balances. Current-month statistics stop at the household's current date. Week is the trailing seven days ending at that date (or selected month end); three months and year are rolling calendar ranges ending in the selected month.

Monthly income/spending comparisons use cached previous-month activity and explicitly describe that limitation. Available balance and savings comparisons require appropriate previous snapshot data. The current month is activity to date, not a forecast or a normalized comparison.

## Interactions

- Transactions: text search, income/expense/category chips, chronological sorting, retained correction/deletion/history and queue controls.
- Budget: category spending against estimates, animated progress, textual on-track / near-limit / over-budget states, remaining or exceeded amount, retained estimates, suggestions and savings-target edits.
- Entry editor: amount prominently placed with decimal keyboard, wrapping category/type chips, secondary adjustment types, keyboard/system inset handling, existing validation.
- Line chart: touch a day to highlight its amount and date; previous/next-day controls also provide screen-reader access to exact values.
- Donut: touch a segment or its labeled category button to select it; more than six categories groups the tail into Other. Category labels, values and percentages convey the data independently of color.
- Lazy transaction and dashboard lists use stable ledger identifiers. Monetary aggregation runs in application mapping / ViewModel flows, not drawing code; floating point is used only for chart geometry and percentages.

## Validation

See the adjacent emulator record and build reports for verification. Physical phone acceptance, TalkBack navigation, maximum font scaling and tablet / landscape layout still require device review. The redesign is not published to the home update server or Google Play.


## French daily-use refinement — 2026-10-10

User priorities: improve all everyday flows, use French, and work comfortably on a Samsung phone (exact model unspecified).

- Manrope is bundled for offline use, with its OFL license in `design/fonts/Manrope-OFL.txt`; no runtime font downloads.
- Native static UI copy is centralized in Android string resources. French-Canadian formatting is used for CAD and calendar dates; Material date selection also receives the French configuration. Stored category/merchant names and API wire values are preserved.
- Home uses one compact overview, plain-language explanations of accepted balance versus forecast, and recent transactions before analysis. Unpopulated charts no longer consume the home screen.
- The transaction form has a pinned save action, a calendar instead of mandatory ISO-date typing, field-level validation, hidden adjustment options, saved form state, and confirmation when abandoning a changed draft. Dot and comma decimal input retain exact integer cents; mixed separators and more than two decimals are rejected.
- Transactions are grouped by date and open a detail sheet. Type/category filters are independent, avoiding category-name collisions with filter labels. Destructive actions require confirmation. Filters can be reset after no results.
- Budgets are a single scrollable page with visible validation, decimal keyboards and cancellable edits. Regular-operation chips and household action groups wrap rather than overflow.
- The offline banner is compact with expandable details. Profile has descriptive action cards, appearance chips, a human-readable sync date and the installed version.
- Overview and transaction layouts adapt to narrow widths and enlarged text. Existing Room, pending-operation, server totals, signed updates and pairing behavior remain the source of truth.

Final validation: 154 tests pass, release compilation and lint succeed. Manual emulator checks covered light/dark themes, 360 dp width at 150% font scale, decimal comma with keyboard, and draft retention after rotation. The editor omits the redundant offline server error because local saving remains available; connected save errors remain visible. Samsung hardware verification and QR publication are outstanding because the model is unspecified and home server is unreachable.

## Add/edit drawers — 2026-10-10

Both transaction actions open the existing editor as an expanded Material bottom sheet over the current page. The same form state, validation, calendar and pinned save action are reused. Cancel, Back, tapping outside and swiping down share the same discard guard; busy saving blocks dismissal. The underlying tabs and transaction filters remain mounted. A restored correction waits for its cached record in a loading sheet instead of opening a new transaction.

Publication update: the signed drawer release 0.1.6 / code 7 is now available through the installation QR. HTTPS downloads, APK manifest/certificate, signed metadata/hash and QR destination were verified on 2026-10-10.
