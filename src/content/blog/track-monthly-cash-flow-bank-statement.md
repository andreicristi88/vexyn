---
title: How to track your monthly cash flow from a bank statement
description: Cash flow is the gap between what comes in and what goes out each month. Here is how to see it clearly from a bank CSV export — month by month, with a chart — in your browser, without uploading your statement.
pubDate: 2026-09-01
category: 'Understanding your money'
tags: ['cash flow', 'budgeting', 'guide']
related: ['/cash-flow-analyzer', '/bank-statement-analyzer']
---

You can earn well and still feel broke, and cash flow is usually why. Cash flow is the plain gap between money in and money out over a period, and it is the number that decides whether a month felt tight or comfortable — regardless of salary. A bank statement contains every piece of it and shows none of it. This guide turns a CSV export into a month-by-month view of what came in, what went out, and what was left, all in your browser.

## Before you start — what cash flow actually is

Cash flow is not your balance, and it is not your income. It is the difference between total money in and total money out across a stretch of time. Positive means you kept some; negative means you spent more than arrived and drew down savings or debt to cover it. Watching it month by month is what turns a vague sense of "this month was hard" into a figure you can act on.

Export a CSV from your bank covering several months — the more months, the clearer the pattern of good and bad ones. A single month gives you one data point, which is a number, not a trend.

## Load the statement and map the columns

Open the [Cash Flow Analyzer](/cash-flow-analyzer). It runs in your browser and uploads nothing.

Drop the CSV in and map the date and amount columns. If your bank uses one signed amount column, pick it; if it uses separate debit and credit columns, switch to that mode and map both. Set the date format and decimal separator to match your file so nothing is read the wrong way round. A description column is optional here — cash flow only needs the date and the amount.

One detail matters: some banks write spending as a positive number rather than a negative. If your totals come out backwards, tick the option that says spending shows as a positive number, and the direction flips.

## Read the month-by-month picture

The analyzer sums money in and money out for each calendar month and shows them side by side, in a chart and a table, with the net for each month. Three things are worth looking for:

- **The trend.** Are the months drifting positive or negative over time? One bad month is noise; three in a row is a pattern.
- **The outliers.** A single deeply negative month usually has a one-off behind it — a tax bill, a holiday, an annual renewal. Knowing which is reassuring, or a warning.
- **The thin months.** A month that is barely positive is one unexpected expense away from negative. Those are the months worth building a buffer against.

The totals are plain sums of the rows you mapped, so there is nothing subtle to get wrong — money in is the sum of the positives, money out the sum of the negatives.

## Turn the numbers into a decision

A cash flow view is only useful if it changes something. If most months are positive, the question is whether the surplus is being saved deliberately or just sitting in checking waiting to be spent. If months are often negative, the chart tells you *when*, which points at *why* — a quarter with three negatives clustered around the same dates usually shares a cause.

For the fuller picture — where the outgoing money actually went, and what recurs every month — pair this with the [Bank Statement Analyzer](/bank-statement-analyzer), which puts cash flow, top spending, subscriptions and duplicate charges on one screen.

## Common mistakes to avoid

- **Reading one month in isolation.** Cash flow is a trend. A single month, good or bad, tells you little without the months around it.
- **Mistaking a negative month for a crisis.** A one-off annual charge or a tax payment produces a scary month that is entirely normal. Find the cause before worrying.
- **Ignoring the sign convention.** If your bank writes debits as positives, the totals invert. Set the option so money out is counted as money out.
- **Confusing cash flow with balance.** A healthy balance can hide months of negative flow that are quietly eroding it. They are different measurements.
- **Uploading the statement.** The whole calculation runs locally; there is no reason to send it anywhere.

## Frequently asked questions

### How do I calculate my monthly cash flow?

Export your bank statement as CSV and total money in against money out for each month. [Vexyn's Cash Flow Analyzer](/cash-flow-analyzer) does it automatically in your browser, grouping by calendar month and showing the net for each.

### What is a good cash flow?

Consistently positive, by a margin that lets you save and absorb surprises. The exact figure depends on your life, but the direction over several months matters more than any single month's number.

### Is my bank statement uploaded?

No. The analyzer runs in your browser and sends nothing — you can confirm it in the Network panel of your developer tools. Financial data should stay on your device.

### My income and spending look swapped. Why?

Some banks record spending as positive numbers. Tick the option that says spending shows as a positive number and the in/out direction corrects itself.

### Does it work with any bank and currency?

Yes. You map the columns yourself and choose the date format, decimal separator and currency symbol, so it is not tied to any one bank's export layout.

### What is the difference between cash flow and my balance?

Your balance is how much you have right now; cash flow is how much moved in and out over a period. A large balance can still sit on top of negative monthly flow that is slowly draining it.

## Related guides

- [How to analyze your spending from a bank statement](/blog/analyze-spending-bank-statement)
- [How to find unused subscriptions in your bank statement](/blog/find-unused-subscriptions-bank-statement)

## Glossary

**Cash flow** — The difference between total money in and total money out over a period. Positive means you kept some; negative means you spent more than came in.

**Net** — For a given month, money in minus money out. The single figure that says whether the month added to or drew down your funds.

**Signed amount** — One number whose sign shows direction: negative for money out, positive for money in. The alternative to separate debit and credit columns.

**Balance** — How much money is in an account at a moment in time. Related to cash flow but not the same: balance is a level, cash flow is a movement.
