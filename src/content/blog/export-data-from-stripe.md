---
title: "How to export your Stripe data, report by report"
description: Stripe keeps payments, payouts, the balance and subscriptions in different reports, and each exports from a different place. Here is where every export lives, what its columns mean, the traps in the dates and currencies, and which file answers which question.
pubDate: 2026-09-16
category: 'Business & Stripe'
tags: ['stripe', 'export', 'business', 'guide']
related: ['/stripe-csv-cleaner', '/stripe-payout-analyzer', '/stripe-reconciliation', '/saas-metrics']
---

"Export from Stripe" is five different jobs, because Stripe keeps five different things: the payments you took, the payouts it sent to your bank, the balance those two move through, your subscriptions, and your customers. Each has its own export, in its own corner of the Dashboard, with its own columns. Pick the wrong one and you spend an hour matching numbers that were never meant to match.

This guide walks through each export: where it is, what the file contains, what the columns actually mean, and which report to reach for depending on what you are trying to answer. The column details come from real exports, not from documentation alone.

## Before you start — which report answers which question

- **"How much did we sell, and to whom?"** — the **payments** export. One row per charge, with amount, Stripe's fee, refunds and the customer.
- **"What did Stripe actually send to our bank?"** — the **payouts** export. One row per transfer to your bank account.
- **"Why does the payout not equal the sales?"** — the **balance** report. Every movement on the Stripe balance — charges, fees, refunds, disputes, adjustments — grouped by the payout that carried it. This is the one that reconciles.
- **"What is our recurring revenue?"** — the **subscriptions** export. One row per subscription with plan, interval, amount and status.
- **"Who are our customers?"** — the **customers** export.

Two things apply to all of them. First, **the Dashboard has a test mode toggle, and every export respects it**: in test mode you export test data, in live mode live data. If a file comes out suspiciously small, check which mode you were in. Second, **every timestamp is UTC**, and the column headers say so — `Created date (UTC)`. A payment at 23:57 UTC on the 1st is the 2nd in Bucharest, Berlin or Helsinki. Monthly totals built without shifting the timezone will be off by however many payments land in that window.

## Export payments

**Payments → Export**, top right. The dialog asks for a date range and a column set.

The **default** column set is 23 columns. The ones that matter:

- `id` — the charge id, `ch_…`. The key for matching anything else to this row.
- `Created date (UTC)` — when the charge was created.
- `Amount` and `Currency` — what the customer paid, in major units with two decimals (`100.00`), currency in lowercase (`ron`, `eur`, `usd`).
- `Amount Refunded` and `Refunded date (UTC)` — refunds are not separate rows. A fully refunded charge stays one row with `Amount Refunded` equal to `Amount`.
- `Fee` — Stripe's fee on this charge. It stays with the charge even if the charge is later refunded, because Stripe keeps it.
- `Status` — `Paid`, `Refunded`, `Failed` and so on.
- `Converted Amount` and `Converted Currency` — when the customer paid in a currency other than your settlement currency, this is what landed on your balance.
- `Customer Email`, `Customer ID`, `Description`, `Invoice ID`.

The **all columns** set is 85. Most of the extra ones are card details (`Card Issue Country`, `Card Tokenization Method`), dispute fields (`Disputed Amount`, `Dispute Reason`, `Dispute Status`), `Application Fee`, `Invoice Number` and shipping addresses. Take it when you need disputes or invoice numbers; otherwise the default is easier to read.

What the file does not give you is a net figure per charge. That is `Amount − Fee − Amount Refunded`, which is what [Vexyn's Stripe CSV Cleaner](/stripe-csv-cleaner) computes when you drop the export in, along with the totals. It runs in your browser; the export is not uploaded.

## Export payouts

**Balances → Payouts → Export.** One row per payout, with `id` (`po_…`), `Amount`, `Currency`, `Arrival Date (UTC)`, `Created (UTC)`, `Status` (`paid`, `pending`, `in_transit`, `failed`), and the destination type.

Two things to know. The amount is what reached your bank, after Stripe's fees have already been taken from the balance — so it will not equal any sum you can make from the payments export directly. And on an account that has not yet paid out, the export is empty; that is not an error, there is nothing to list yet.

The [Stripe Payout Analyzer](/stripe-payout-analyzer) reads this file into totals by status and month.

## Export the balance report

**Reporting → Balance → Itemized.** This is the report that reconciles payouts to sales, and the one most people never find.

Every row is one movement on your Stripe balance: a charge, its fee, a refund, a dispute, an adjustment, the payout itself. The columns that matter are `reporting_category` (what kind of movement), `gross`, `fee`, `net`, and `automatic_payout_id` — the payout that carried this movement to your bank. Sum the `net` of every row sharing a payout id and you get that payout's amount. That is the identity a bank reconciliation rests on.

The report is generated, not exported live, so it can lag: on a fresh account it may say it is not available for the first twelve hours. Pick the date range to match your payouts, not your payments — a payout on the 3rd carries charges from before it.

The [Stripe Reconciliation](/stripe-reconciliation) tool groups this file by payout and by category and checks the sums against each other.

## Export subscriptions and customers

**Subscriptions → Export** gives 15 columns: `id` (`sub_…`), the customer's id, email and name, `Plan`, `Quantity`, `Currency`, `Interval` (`month`, `year`, `week`), `Amount`, `Status` (`active`, `trialing`, `canceled`, `past_due`), and the created, start and current-period dates. `Amount` is per interval, not per month — a yearly plan shows its yearly price.

That is what MRR is computed from: monthly amounts as they are, yearly divided by twelve, multiplied by quantity, trials excluded. The [SaaS Metrics](/saas-metrics) tool does that arithmetic and shows its working.

**Customers → Export** gives one row per customer with contact details and the date they were created. It is the file to join to the others by `Customer ID` when a report needs names instead of ids.

## Common mistakes to avoid

- **Exporting in test mode.** The toggle is easy to leave on after building an integration. A live-looking file with three rows is usually a test-mode file.
- **Building monthly totals on UTC timestamps.** Every date column is UTC. Shift to your timezone before grouping by month, or the last payments of each month move to the next one.
- **Expecting payouts to equal sales.** The payout is net of fees and refunds and covers a different date window. Only the balance report ties the two together.
- **Reading `Amount` as net.** It is gross. Net is `Amount − Fee − Amount Refunded`, and refunds sit on the original row, not on their own.
- **Treating `Amount` in the subscriptions export as monthly.** It is per interval. Yearly plans are twelve times too large if you sum them as monthly.
- **Uploading the export to an online converter.** A payments export lists every customer's email and what they paid. The cleaning and the totals run fine in your browser.

## Frequently asked questions

### Why is my payouts export empty?

Because no payout has happened yet. Stripe pays out on a schedule after a first-payout delay on a new account, and until the first transfer there is nothing to list. Test-mode accounts often never pay out at all.

### Which export do I give my accountant?

For revenue, the payments export, cleaned to one net figure per charge. For the bank side, the balance report grouped by payout, because that is what matches the deposits on the bank statement. Both, if they are reconciling.

### Are the amounts in cents?

No. The Dashboard exports write amounts in major units with two decimals — `100.00`, not `10000`. The API returns cents; the CSV does not.

### The currency column is lowercase. Is that a problem?

No. `ron`, `eur` and `usd` are how Stripe writes currency codes in exports. Match case-insensitively if you are joining to another file.

### Can I get the payments export without card and dispute columns?

Yes. Choose the default column set in the export dialog. The 23 default columns cover amounts, fees, refunds, status and customer; the 85-column set adds the rest.

### Does the export include disputes?

Only in the all-columns set of the payments export, as `Disputed Amount`, `Dispute Date`, `Dispute Reason` and `Dispute Status` on the disputed charge's row. The balance report shows disputes as their own movements.

## Related guides

- [How to clean a Stripe CSV export](/blog/clean-stripe-csv-export) — the next step for the payments file.
- [How to analyze Stripe payouts](/blog/analyze-stripe-payouts) — reading the payouts export.
- [How to reconcile Stripe payouts to your bank](/blog/reconcile-stripe-payouts) — where the balance report earns its place.
- [How to calculate MRR, churn and SaaS metrics](/blog/calculate-mrr-churn-saas-metrics) — from the subscriptions export.

## Sources cited in this guide

- [Stripe Docs: Reports](https://docs.stripe.com/reports) and [Balance report](https://docs.stripe.com/reports/balance)
- [Stripe Docs: Payouts](https://docs.stripe.com/payouts)
- [Stripe Docs: Select a report](https://docs.stripe.com/reports/select-a-report)

## Glossary

**Charge** — One payment taken from a customer. The unit of the payments export, with an id starting `ch_`.

**Payout** — One transfer from your Stripe balance to your bank account, with an id starting `po_`. It carries many charges, net of fees and refunds, on Stripe's payout schedule.

**Balance** — The account inside Stripe that charges are paid into and payouts are paid out of. The balance report lists every movement on it.

**reporting_category** — The balance report's column naming the kind of movement: `charge`, `refund`, `fee`, `dispute`, `payout`, `adjustment` and others. Grouping by it gives the totals per kind that a reconciliation checks.

**Settlement currency** — The currency your balance is held in. A payment in another currency is converted on arrival, and the payments export shows both the original (`Amount`) and the converted figure (`Converted Amount`).

**Test mode** — A separate copy of your Stripe account with fake cards and no real money, toggled from the Dashboard. Exports come from whichever mode is switched on.
