---
title: How to reconcile Stripe payouts to your bank
description: Reconciling Stripe means proving that charges, minus fees and refunds, add up to the payouts that hit your bank. Here is how to do it from Stripe's itemized balance report — grouped by category and by payout — in your browser, without uploading it.
pubDate: 2026-09-02
category: 'Business & Stripe'
tags: ['stripe', 'reconciliation', 'guide']
related: ['/stripe-reconciliation', '/stripe-payout-analyzer', '/bank-reconciliation']
---

Reconciling Stripe is the exercise of proving that everything that happened in your account — charges, refunds, fees, adjustments — nets out to the payouts that actually reached your bank. It is the step auditors and careful bookkeepers care about, and it is fiddly by hand because Stripe's activity and its payouts live in different reports at different grains. This guide does it from Stripe's itemized balance report, grouping every line by reporting category and by payout, so the arithmetic checks itself.

## Before you start — get the itemized balance report

This tool needs the *itemized* balance report, not the payments or payouts export. In Stripe: **Reporting → Reports → Balance summary → Itemized** (the "balance change from activity" report). Export it as CSV. It contains a reporting-category, a net amount, and a balance-transaction / payout id for every line — which is exactly what reconciliation needs. Everything runs in your browser; the file is never uploaded.

## Reconcile the report

Open [Stripe Reconciliation](/stripe-reconciliation) and drop the itemized report in.

1. It checks the file looks like an itemized balance report (a reporting-category column, a net column, and a balance-transaction id). If not, it warns you and still groups what it can.
2. The headline panel states the identity: **earned X · paid out Y · balance changed by Z**. The balance change is the sum of every net line, and it should equal the balance change on the report's own summary — that equality is the reconciliation.
3. **By reporting category** breaks the net down into charges, refunds, fees, adjustments, and so on, each with a count, gross, fee, and net, totalled in the footer.
4. **By payout** shows what each payout settled — how many transactions rolled into it and their net — so you can tie a specific bank deposit to the activity behind it.

Net sums are exact arithmetic on the file; the groupings follow Stripe's own `reporting_category` and payout id, so they match how Stripe itself classifies each line.

## The check that matters

The first time you run this, cross-check the headline balance change against the summary figure on Stripe's own report. If they match, the file is complete and your grouping is sound; from then on the by-payout table is what you carry into your books — each payout's net should equal the corresponding deposit on your bank statement. You can **Export CSV** of the by-category breakdown to attach to your records.

Once the Stripe side balances, tie the payouts to the bank itself with [bank reconciliation](/blog/reconcile-books-to-bank-statement): the payout nets here become the "money in" you match against your statement.

## Common mistakes to avoid

- **Using the wrong report.** The payments or payouts export won't reconcile — they lack the per-line reporting category and payout id. Use the *itemized balance report*.
- **Forgetting fees and refunds are separate lines.** Reconciliation only works because every fee and refund is its own net line. That is why gross ≠ net and why the category breakdown matters.
- **Skipping the summary cross-check.** The whole point is that your computed balance change equals Stripe's stated one. Verify it the first time.
- **Reconciling payouts to individual invoices.** A payout settles a *batch*. Match it to the grouped net, not to single sales.
- **Uploading the report.** It runs entirely in your browser; your financial data stays local.

## Frequently asked questions

### How do I reconcile Stripe with my bank account?

Export Stripe's itemized balance report and group every line by reporting category and by payout, then confirm the total net equals the balance change Stripe reports and that each payout's net matches the deposit on your bank statement. [Vexyn's Stripe Reconciliation](/stripe-reconciliation) does the grouping and arithmetic in your browser.

### Which Stripe report do I need?

The itemized balance report — Reporting → Reports → Balance summary → Itemized. It has a reporting category, a net, and a payout id per line, which the payments and payouts exports don't.

### Why don't my payouts equal my sales?

Because a payout is a batch of charges minus fees and refunds, each of which is a separate line in the balance report. Reconciliation adds those lines back up to prove the payout is correct.

### How do I check the reconciliation is right?

Compare the tool's headline balance change to the summary figure on Stripe's own report. If they match, the file reconciles.

### Is my Stripe data uploaded anywhere?

No. The report is read and grouped entirely in your browser. Confirm it in the Network panel — nothing is sent out.

## Related guides

- [How to see what Stripe actually paid you](/blog/analyze-stripe-payouts) — the payouts themselves.
- [How to reconcile your books against a bank statement](/blog/reconcile-books-to-bank-statement) — tie the payouts to your bank.

## Glossary

**Reconciliation** — Proving that recorded activity (charges, fees, refunds) nets to the money actually moved (payouts). It balances when the two agree.

**Itemized balance report** — Stripe's per-line report of every balance change, with a reporting category and payout id. The source reconciliation needs.

**Reporting category** — Stripe's classification of a balance line: charge, refund, fee, adjustment, and so on. Reconciliation groups by it.

**Balance change** — The net sum of all activity in the period. It should equal the total of the payouts plus the change in your Stripe balance.
