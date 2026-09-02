---
title: "How to break down revenue by month and product"
description: A flat sales export doesn't tell you which month, product or customer drives your revenue. Here is how to turn any sales CSV into a monthly trend and a ranked breakdown — in your browser, without uploading it.
pubDate: 2026-09-02
category: 'Business & Stripe'
tags: ['revenue', 'analytics', 'guide']
related: ['/revenue-analyzer', '/saas-metrics', '/stripe-csv-cleaner']
---

A sales export is a flat list of transactions, and a flat list hides the two things you actually want to know: is revenue growing month over month, and where does it concentrate — which product, which customer? Answering that usually means a pivot table and some fiddling with date parsing. This guide does it directly from any sales or revenue CSV: a monthly trend and a ranked breakdown by whatever dimension you choose, in your browser.

## Before you start — any sales CSV works

You need a CSV with a **date** and an **amount** per sale, and ideally a column to group by — product, customer, plan, SKU, or category. It can come from Stripe, your store, an invoicing tool, or a spreadsheet. The file stays on your device.

## Break the revenue down

Open the [Revenue Analyzer](/revenue-analyzer) and drop the file in.

1. Map the columns: **Date** and **Amount** are required; **Group by** is the dimension you want to rank (product, customer, plan…). The tool takes a first guess at all three.
2. Set the **Date format**, **Decimal separator**, and **Currency symbol** to match your file.
3. The summary cards show **Total revenue**, the number of **records**, the number of **months**, and the number of distinct groups.
4. Toggle between **By [group]** and **By month**:
   - *By group* ranks each product/customer/plan by revenue, largest first, with a bar and a transaction count — so the concentration is obvious.
   - *By month* shows the revenue trend over time, in chronological order.
5. **Download summary CSV** to take either breakdown into a spreadsheet or a report.

If some rows are skipped, it's an unreadable date or amount — almost always the date format or decimal separator set wrong for the file.

## What the two views tell you

The two views answer different questions, and both matter. **By month** is your trend line: it tells you whether the business is growing, flat, or slipping, and it surfaces seasonality. **By group** is your concentration: it tells you how dependent you are on a single product or customer — a top customer that is 40% of revenue is a risk as much as an achievement. Reading them together is the point: a healthy month-over-month trend built on one giant customer is a different story than the same trend spread across hundreds.

## Common mistakes to avoid

- **Wrong date or decimal format.** These cause rows to be skipped or bucketed into the wrong month. If the totals look low, that's the first thing to check.
- **Grouping by an id instead of a name.** Grouping by a customer *id* gives you unreadable rows; group by the customer *name* or product name where the file has one.
- **Reading only the total.** A single revenue number hides the trend and the concentration — the two views are where the insight is.
- **Mixing refunds and charges silently.** If your export includes negative refund rows, they net into the totals — which is usually what you want, but know that it's happening.
- **Uploading the export.** It runs in your browser; your sales data never needs to leave it.

## Frequently asked questions

### How do I see my revenue by month from a sales export?

Map the date and amount columns and switch to the "by month" view. [Vexyn's Revenue Analyzer](/revenue-analyzer) buckets every sale into its month and shows the trend, in your browser, without uploading the file.

### How do I find my top customers or products by revenue?

Set the "Group by" column to customer or product and read the "by group" view — it ranks them largest first with totals and counts.

### Why were some rows skipped?

They had an unreadable date or amount, usually because the date format or decimal separator doesn't match the file. Adjust those and the skipped count drops.

### Can I export the breakdown?

Yes. "Download summary CSV" exports whichever view you're on — by month or by group — for a spreadsheet or report.

### Is my sales data uploaded?

No. The analyzer reads the CSV in your browser and sends nothing. You can confirm this in the Network panel.

## Related guides

- [How to calculate MRR, churn and growth from a subscriptions export](/blog/calculate-mrr-churn-saas-metrics) — recurring-revenue metrics.
- [How to clean a Stripe CSV export into a readable sheet](/blog/clean-stripe-csv-export) — get clean net amounts to analyze.

## Glossary

**Revenue by period** — Sales totalled per month (or other interval), showing the trend over time.

**Grouping dimension** — The column you break revenue down by: product, customer, plan, SKU, or category.

**Concentration** — How much of your revenue depends on a single product or customer. High concentration is a risk even when totals are healthy.

**Skipped row** — A record with an unreadable date or amount, excluded from the totals — usually a format-setting mismatch.
