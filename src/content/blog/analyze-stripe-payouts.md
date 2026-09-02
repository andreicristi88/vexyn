---
title: How to see what Stripe actually paid you
description: Stripe's payout schedule bundles many charges into each deposit, so the number that lands in your bank rarely matches a single sale. Here is how to analyze a payouts export — totals, averages, and a breakdown by status — in your browser, without uploading it.
pubDate: 2026-09-02
category: 'Business & Stripe'
tags: ['stripe', 'payouts', 'guide']
related: ['/stripe-payout-analyzer', '/stripe-reconciliation', '/stripe-csv-cleaner']
---

Stripe doesn't wire you money one sale at a time. It batches a rolling window of charges — minus fees and refunds — into a single payout on a schedule, so the deposit that shows up in your bank almost never matches any individual invoice. That is normal, and also why "how much did Stripe actually pay me this quarter?" is a surprisingly awkward question to answer from the dashboard. This guide takes a payouts export and gives you the totals, the average, and a breakdown by status, in your browser.

## Before you start — export your payouts

In Stripe, go to **Balance → Payouts → Export** and save the CSV. This is the list of deposits Stripe sent to your bank, distinct from the payments export (individual charges). Everything below runs locally — the file is never uploaded.

## Analyze the payouts

Open the [Stripe Payout Analyzer](/stripe-payout-analyzer) and drop the file in.

1. It recognises a payouts export (it needs an id, an amount, and an arrival-date column). If the file doesn't match, it warns you and still reads what it can.
2. The summary cards show **Total paid out**, the **number of payouts**, the **average payout**, and the **currency**.
3. If your payouts have more than one status, a row of chips breaks them down — for example `paid: 24 · $48,300` alongside any `in_transit`, `failed`, `canceled`, or `returned`. Failed and returned payouts are coloured so they stand out; those are the ones to investigate.
4. The table lists each payout by arrival date, creation date, amount, status, and type.

The decimal separator is detected automatically, so the totals are right regardless of your locale's number format.

## Take the numbers out

- **Clean CSV** — a tidy payout sheet: Arrival date, Created, Amount, Currency, Status, Type, Description, id. Keep it as a record or hand it to your accountant.
- **Export to** Generic CSV, QuickBooks CSV, Xero CSV, QIF, or JSON — one row per payout, dated by arrival, for importing the deposits into your accounting software.

Recording payouts by **arrival date** matters: that is when the money is actually available in your bank, which is what your bank statement will show and what you will reconcile against.

## Payouts answer a different question than payments

Keep the two Stripe exports straight. The **payments** export tells you what you *earned* (and, cleaned, what you kept as net — see [cleaning a Stripe export](/blog/clean-stripe-csv-export)). The **payouts** export tells you what Stripe *sent to your bank*. They will not tie out line-for-line, because a payout bundles many payments minus fees. To connect the two — which charges made up which payout — you need the itemized balance report and [Stripe reconciliation](/blog/reconcile-stripe-payouts).

## Common mistakes to avoid

- **Expecting payouts to match invoices.** A payout is a batch, net of fees and refunds. It will not equal any single sale — by design.
- **Confusing payouts with payments.** Payments are charges you received; payouts are deposits Stripe sent. Different exports, different questions.
- **Ignoring failed or returned payouts.** A returned payout means money bounced back — often a bank-detail problem worth fixing. The status breakdown flags these.
- **Recording by creation date instead of arrival.** Arrival date is when the cash is actually in your account; use it for reconciliation.
- **Uploading the export.** It runs in your browser; there is no need to send it anywhere.

## Frequently asked questions

### Why doesn't my Stripe payout match my sales?

Because a payout bundles many charges over a rolling window and deducts fees and refunds before sending. The deposit is a net batch, not a single sale. A payout analyzer totals them so you can see the whole picture.

### How do I total how much Stripe paid me over a period?

Export your payouts and run them through an analyzer. [Vexyn's Stripe Payout Analyzer](/stripe-payout-analyzer) sums the total paid out, the count, and the average, and breaks it down by status — in your browser.

### What is the difference between payments and payouts?

Payments are the individual charges customers made; payouts are the batched deposits Stripe sends to your bank after fees. Use the payments export for revenue, the payouts export for what actually hit your account.

### How do I know which charges are in a payout?

That needs the itemized balance report, not the payouts list. See [reconciling Stripe payouts](/blog/reconcile-stripe-payouts), which groups charges, fees and refunds by payout.

### Is my Stripe data uploaded?

No. The analyzer reads the file in your browser and sends nothing. You can confirm this in the Network panel.

## Related guides

- [How to reconcile Stripe payouts to your bank](/blog/reconcile-stripe-payouts) — connect payouts to the charges behind them.
- [How to clean a Stripe CSV export into a readable sheet](/blog/clean-stripe-csv-export) — the payments side, with net computed.

## Glossary

**Payout** — A batched deposit Stripe sends to your bank, covering a rolling window of charges minus fees and refunds.

**Arrival date** — The date a payout's funds become available in your bank account. The right date to record and reconcile against.

**Status** — The state of a payout: `paid`, `in_transit`, `failed`, `canceled`, or `returned`. Failed and returned payouts need attention.

**Payment vs payout** — A payment is a single charge you received; a payout is the batched transfer of many payments (net of fees) to your bank.
