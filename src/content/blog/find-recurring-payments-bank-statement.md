---
title: "How to find every recurring payment in a statement"
description: Subscriptions are only part of the picture — rent, loan repayments, utilities and insurance recur too. Here is how to detect every repeating payment and its cadence from a bank CSV, in your browser, without uploading it.
pubDate: 2026-09-02
category: 'Understanding your money'
tags: ['recurring', 'bank', 'guide']
related: ['/recurring-payment-finder', '/subscription-finder', '/cash-flow-analyzer']
---

Your fixed costs are the ones that decide how much room you actually have each month, and most of them are invisible in a chronological statement because they are scattered across dozens of unrelated lines. Subscriptions are only the small end of it — rent, a loan repayment, insurance, utilities, a standing transfer to savings all recur too, on their own cadences. This guide finds every repeating payment and tells you how often it happens and what it costs you per month, from a CSV you already have.

## Before you start — export enough history

A recurring payment is only detectable once it has repeated, so a single month shows almost nothing. Export **at least three months**, ideally more. A monthly charge needs to appear two or three times before the pattern is clear; a quarterly or yearly one needs a correspondingly longer window. If you have a full year, use it — the yearly renewals (domains, insurance, memberships) only surface with that much history.

If your spending spans several accounts or cards, [merge them into one file](/blog/merge-multiple-bank-csv-files) first. A recurring charge that alternates between two cards can otherwise look like two unrelated one-offs.

## Detect the repeating payments

Open the [Recurring Payment Finder](/recurring-payment-finder). It runs in your browser and never uploads your statement.

1. Drop the CSV in. It guesses the date, amount, and description columns and the date and number formats.
2. Correct any mapping that looks wrong — the **Description / Merchant** column matters most here, because payments are grouped by payee.
3. Set the **Date format** and **Decimal separator** to match your file.
4. Use the **Payments out / Payments in** toggle. "Out" finds your recurring costs; "in" finds recurring income — a salary, a regular transfer, a repeating refund.
5. Read the list. Each item shows the payee, a cadence badge (weekly, every two weeks, monthly, quarterly, yearly), how many times it has occurred, the date range, and an approximate **monthly cost**. The header totals the monthly cost of everything found.

## Trust the confident ones, verify the rest

A payment is flagged as recurring when the same payee appears at a stable amount and a regular interval. Items marked **unconfirmed** matched only twice — enough to notice, not enough to be sure it is a genuine schedule rather than a coincidence. Treat the confirmed items as reliable and give the unconfirmed ones a glance against your statement before acting on them.

The monthly cost is normalized so different cadences are comparable: a yearly £120 insurance premium shows as ≈ £10/month, a weekly £5 charge as ≈ £21.67/month. That normalization is the point — it lets you add a yearly renewal and a weekly habit into a single "fixed costs per month" figure.

## Recurring payments vs subscriptions

This tool finds *all* repeating payments; the [Subscription Finder](/subscription-finder) is tuned specifically for the small discretionary subscriptions worth cancelling. They overlap, and that is fine — use the Recurring Payment Finder to understand your total committed outgoings (including rent and loans you are not going to cancel), and the Subscription Finder when the goal is specifically to hunt down forgotten streaming and app charges.

## Common mistakes to avoid

- **Too short a window.** One or two months can't reveal a monthly pattern, let alone a yearly one. Export three-plus months.
- **Ignoring the direction toggle.** Recurring *income* is on the "Payments in" side; you will miss a regular transfer or salary if you only look at "out".
- **Treating "unconfirmed" as confirmed.** Two matches can be a coincidence. Verify before you count on it.
- **Analyzing one card in isolation.** A charge that hops between cards looks like noise until you merge the accounts.
- **Uploading your statement.** There is no reason to send a full transaction history to a server for this.

## Frequently asked questions

### How do I find all my recurring payments, not just subscriptions?

Export at least three months of transactions as CSV and run them through a recurring-payment detector that groups by payee and interval. [Vexyn's Recurring Payment Finder](/recurring-payment-finder) surfaces rent, loans, insurance, utilities and subscriptions alike, with each one's cadence and monthly cost, in your browser.

### What is the difference between this and a subscription finder?

The recurring-payment finder detects every repeating charge — including large fixed costs like rent you won't cancel. The [Subscription Finder](/subscription-finder) is tuned for the small discretionary subscriptions that are worth reviewing and cancelling.

### How much history do I need?

Three months minimum for monthly patterns; a full year to catch quarterly and yearly renewals. The longer the export, the more reliable the cadence detection.

### Why is one payment marked "unconfirmed"?

It matched only twice, which is enough to flag but not enough to be certain it is a genuine schedule. Check those against your statement before relying on them.

### Is my bank data uploaded anywhere?

No. The finder reads your CSV in the browser and sends nothing. Confirm it in your browser's Network panel.

## Related guides

- [How to find unused subscriptions in your bank statement](/blog/find-unused-subscriptions-bank-statement) — the discretionary end of recurring spending.
- [How to track your monthly cash flow from a bank statement](/blog/track-monthly-cash-flow-bank-statement) — see those fixed costs against your income.

## Glossary

**Recurring payment** — A charge from the same payee that repeats at a regular interval: rent, a subscription, a loan repayment, insurance.

**Cadence** — How often a payment repeats — weekly, every two weeks, monthly, quarterly, or yearly.

**Monthly cost (normalized)** — Every cadence expressed as a per-month figure (yearly ÷ 12, weekly × 52 ÷ 12) so different recurring payments can be added together.

**Unconfirmed** — A pattern that matched only twice, flagged but not certain — worth a manual check before you rely on it.
