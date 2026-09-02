---
title: "How to calculate MRR, ARR and SaaS metrics"
description: MRR normalizes every subscription — monthly, yearly, quantity and all — to one monthly figure, and everything else builds on it. Here is how to compute MRR, ARR, ARPU and lost MRR from any subscriptions export, in your browser, without uploading it.
pubDate: 2026-09-02
category: 'Business & Stripe'
tags: ['saas', 'mrr', 'metrics', 'guide']
related: ['/saas-metrics', '/revenue-analyzer', '/stripe-csv-cleaner']
---

Monthly Recurring Revenue is the number every other SaaS metric leans on, and it's more subtle than it looks: a yearly plan isn't twelve months of MRR, a quantity of five seats multiplies it, and trials shouldn't count at all. Get the normalization right and MRR, ARR, ARPU and the rest follow; get it wrong and every derived figure is off. This guide computes them from any subscriptions export — Stripe, Chargebee, Paddle, or a plain spreadsheet — in your browser.

## Before you start — any subscriptions export

You need a CSV with one row per subscription and, at minimum, an **amount** column. Anything else — billing interval, status, quantity, plan/product — sharpens the result but isn't required. Export from Stripe (Subscriptions → Export), your billing tool, or keep it in a spreadsheet. The file never leaves your device.

## Compute the metrics

Open [SaaS Metrics](/saas-metrics) and drop the file in.

1. Map the columns. **Amount** is required. The others refine the calculation:
   - **Billing interval** — month / year / week / day. Without it, amounts are assumed already monthly.
   - **Status** — so trialing and canceled subscriptions are handled correctly. Without it, every row counts as active.
   - **Quantity** — seats or units, multiplied into each subscription's MRR. Without it, one each.
   - **Plan / product** — a readable name to break MRR down by. The tool prefers a product/tier name over an id-like plan column.
2. Set the **Decimal separator** to match the file.
3. Read the metric cards: **MRR**, **ARR**, **active subscriptions**, **ARPU**, plus **trialing**, **canceled/ended**, and **lost MRR**.
4. **MRR by plan** ranks each plan's contribution; **Export CSV** takes it into a spreadsheet.

## What each number means

- **MRR** — every paying subscription normalized to a monthly figure (yearly ÷ 12, weekly × 52 ÷ 12, and so on) times quantity, summed. Trials are counted separately and excluded from MRR.
- **ARR** — annual run rate, simply MRR × 12.
- **ARPU** — average revenue per active user: MRR ÷ active subscriptions.
- **Lost MRR** — the monthly value of the canceled/ended subscriptions in this file. Read the caveat below.

The normalization is the whole game: mixing a yearly plan's full price in with monthly ones would massively overstate MRR, which is exactly the mistake this avoids.

## A caveat on churn

Be precise about what "lost MRR" here is: it's the monthly value of subscriptions that show a canceled or ended status *in this one file* — a snapshot, not a rate. True churn is a rate measured **between two points in time**: the MRR you lost this month divided by the MRR you started the month with. A single export can't give you that, because it has no "start of period" to compare against. To get a real churn rate, run this on exports from two dates and compare the MRR, or use your billing tool's cohort reporting. Treat the lost-MRR figure as "how much monthly revenue sits in canceled subscriptions in this file", nothing more.

## Common mistakes to avoid

- **Not mapping the billing interval.** If yearly plans are read as monthly, MRR balloons. Map the interval so yearly is divided by twelve.
- **Counting trials as revenue.** Trials aren't paying yet. Map the status column so they're excluded from MRR.
- **Reading lost MRR as churn.** It's a snapshot of canceled subscriptions, not a between-periods rate. Compare two exports for real churn.
- **Grouping by plan id instead of name.** Map the readable product/tier column so "MRR by plan" is legible.
- **Uploading the export.** All of it runs in your browser; your customer and revenue data stays local.

## Frequently asked questions

### How do I calculate MRR from a Stripe (or other) subscriptions export?

Normalize every subscription to a monthly amount — yearly ÷ 12, times quantity — and sum the paying ones. [Vexyn's SaaS Metrics](/saas-metrics) does this in your browser from any subscriptions CSV and also gives ARR, ARPU and MRR by plan.

### What's the difference between MRR and ARR?

ARR is just MRR × 12 — the annual run rate implied by your current monthly recurring revenue. MRR is the monthly figure everything derives from.

### Can I get my churn rate from one export?

Not a true rate. Churn is measured between two points in time. One file gives a snapshot of canceled subscriptions ("lost MRR"); for a rate, compare exports from two dates.

### Do trials count toward MRR?

No — if you map the status column, trials are counted separately and excluded from MRR, since they aren't paying yet.

### Is my subscriptions data uploaded?

No. The file is read and all metrics computed in your browser. Confirm it in the Network panel — nothing is sent out.

## Related guides

- [How to break down your revenue by month, product and customer](/blog/analyze-revenue-by-month-product-customer) — one-off and total revenue, not just recurring.
- [How to clean a Stripe CSV export into a readable sheet](/blog/clean-stripe-csv-export) — clean the payments side of the same account.

## Glossary

**MRR** — Monthly Recurring Revenue. Every paying subscription normalized to a monthly amount and summed. The base metric for SaaS.

**ARR** — Annual Recurring Revenue, the annual run rate: MRR × 12.

**ARPU** — Average Revenue Per User: MRR divided by the number of active subscriptions.

**Churn** — The rate at which recurring revenue (or customers) is lost between two points in time. A rate, not a single-file snapshot.
