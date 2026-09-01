---
title: How to see which merchants you spend the most money with
description: Your biggest spending drains are often a handful of merchants you never add up. Here is how to rank every payee in your bank statement by total spent, from a CSV export, in your browser — without uploading your data.
pubDate: 2026-09-01
category: 'Understanding your money'
tags: ['merchants', 'spending', 'guide']
related: ['/merchant-analyzer', '/spending-analyzer']
---

Category totals tell you that you spend a lot on "dining". They do not tell you that most of it is one delivery app and a single coffee shop near work. To change spending you usually need the specific culprits, not the broad bucket — and that means adding up your transactions by who you actually paid. This guide shows how to rank every merchant in your bank statement by total spent, so the handful of places quietly taking most of your money become obvious.

## Before you start — why merchant totals beat category totals

Categories group by type; merchants group by name. Both are useful, but the merchant view is often the one that changes behaviour, because it names something you can act on. "Reduce dining" is a resolution; "you spent £480 at one delivery app in two months" is a decision. The two frequent patterns worth catching are the big one-off (a single large payment to one place) and the small-but-relentless (a modest charge to the same merchant dozens of times).

Export a CSV from your bank covering a representative period — a month or two of normal life. Include the description or payee column, because that text is what the merchant grouping is built from.

## Load the statement and rank the payees

Open the [Merchant Analyzer](/merchant-analyzer). It runs in your browser and uploads nothing.

Drop the CSV in and map the date, amount and description columns, matching the date and number format to your file. The analyzer cleans each description into a best-effort merchant name, groups matching ones, and ranks them by total — with a bar for each so the relative size is visible at a glance, and a count of how many times you paid each.

You can flip between "Who you pay" and "Who pays you" to see the same ranking on the income side, which is a quick way to check that your salary, refunds and transfers in are what you expect.

## Understand how merchants are grouped

Bank descriptions are messy. The same shop can appear as `POS 1234 TESCO STORES 5678 LONDON` one day and `TESCO STORES` the next. The analyzer strips the noise — card masks, reference numbers, dates, payment-processor prefixes — and groups what is clearly the same merchant. It stays conservative on purpose, so it rarely lumps two different merchants together, at the cost of occasionally listing one merchant twice when the bank wrote it two very different ways.

That trade-off is the honest one for this job: a merchant total you can trust is worth more than an aggressive grouping that quietly merges your gym with a different business that shares a word in its name. Treat the ranking as a strong guide, and if a name looks split, read the two entries together.

## Act on the top of the list

The top few merchants are where changing one habit moves real money. Go down the ranking and ask, for each of the leaders, whether the total surprises you. The count matters as much as the amount: a large total from one big purchase is a one-off; a large total from forty small charges is a habit, and habits are what you can actually change.

If you want the type-level view as well — how much of your spending is groceries versus transport versus subscriptions — pair this with the [Spending Analyzer](/spending-analyzer), which categorizes the same file and charts it.

## Common mistakes to avoid

- **Looking only at categories.** A broad category hides the specific merchant driving it. The name is what you act on.
- **Reading the total without the count.** One big payment and forty small ones can reach the same total but mean completely different things.
- **Assuming perfect grouping.** Conservative cleanup occasionally lists one merchant under two labels. Scan for near-duplicate names and read them together.
- **Analyzing an unrepresentative month.** A month with a holiday or a one-off purchase distorts the ranking. Pick a normal stretch.
- **Uploading the statement.** The grouping runs entirely in your browser; keep the file local.

## Frequently asked questions

### How do I find out who I spend the most money with?

Export your bank statement as CSV and group the transactions by merchant. [Vexyn's Merchant Analyzer](/merchant-analyzer) cleans the descriptions, ranks every payee by total spent, and shows how many times you paid each — in your browser, with nothing uploaded.

### How does it decide two transactions are the same merchant?

It cleans each description into a merchant label by stripping reference numbers, card masks, dates and processor prefixes, then groups matching labels. It is deliberately conservative, so it rarely merges different merchants, though it can occasionally split one merchant written two very different ways.

### Is my bank statement uploaded anywhere?

No. It runs in your browser and sends nothing, which you can confirm in the Network panel of your developer tools. Keep financial data off random servers.

### Can I see who pays me, not just who I pay?

Yes. Toggle to "Who pays you" to rank the income side — salary, refunds, transfers in — using the same grouping.

### Why does one merchant show a very high count?

The count is how many transactions grouped under that name. A frequent small purchase — a daily coffee, a commute fare — racks up a high count and often a surprising total. That is exactly the pattern the merchant view is meant to surface.

### Does it work with European formats and any currency?

Yes. Choose day-first dates and a comma decimal if that matches your bank, and set the currency symbol. Values are parsed exactly as specified.

## Related guides

- [How to analyze your spending from a bank statement](/blog/analyze-spending-bank-statement)
- [How to track your monthly cash flow from a bank statement](/blog/track-monthly-cash-flow-bank-statement)

## Glossary

**Merchant** — The payee behind a transaction. Because bank descriptions vary, a merchant view cleans and groups the raw text so all payments to the same place add up together.

**Merchant label** — The cleaned-up name a tool derives from a raw description, after removing reference numbers, card masks and processor prefixes.

**Count** — How many transactions grouped under one merchant. Read alongside the total: a high count means a frequent habit rather than a single large purchase.

**Payment processor** — A company that bills on behalf of the real merchant (Paddle, Stripe, PayPal), whose name can appear on the statement in place of the shop you actually paid.
