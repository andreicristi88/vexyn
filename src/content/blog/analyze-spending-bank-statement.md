---
title: How to analyze your spending from a bank statement
description: A bank statement lists every transaction but never tells you where your money actually goes. Here is how to turn a CSV export into a clear spending breakdown by category and merchant — in your browser, without uploading it.
pubDate: 2026-09-01
category: 'Understanding your money'
tags: ['spending', 'budgeting', 'guide']
related: ['/spending-analyzer', '/bank-statement-analyzer', '/transaction-categorizer']
---

Your bank statement knows exactly where your money goes. It just refuses to tell you in a useful way — it hands you a chronological list of transactions and leaves the adding-up to you. This guide turns that list into the two views that actually answer the question "where does it all go?": spending by category, and spending by merchant. Everything happens in your browser, from a CSV you already have.

## Before you start — get a statement worth analyzing

Pull a CSV export from your bank covering a period that represents normal life — one to three months is usually enough. A single week is too short to see patterns; a year mixes in one-offs like a holiday that distort the averages. Aim for a stretch that looks like a typical month or two.

If you bank across several accounts or cards, you can analyze each separately, or [merge them into one file](/blog/merge-multiple-bank-csv-files) first for a complete picture. Spending split across three cards is exactly the kind of thing that hides an expensive habit.

## See the shape of it: spending by category

Open the [Spending Analyzer](/spending-analyzer). Drop the CSV in, map the date, amount and description columns, and set the date and number format to match your file.

The analyzer sorts each transaction into an everyday category — groceries, transport, dining, subscriptions, and so on — and charts the result. The point is not precision to the penny; it is the shape. Most people find one or two categories are far larger than they assumed, and that is the insight worth having.

A word on how the categories are decided: it is keyword matching on the description text, not a bank's official classification. It is a fast, transparent first pass, and anything it cannot recognise lands in "Uncategorized" rather than being guessed. Treat the big categories as reliable and sanity-check anything surprising against the underlying transactions.

## See who you pay: spending by merchant

Categories tell you the type of spending; merchants tell you the specific drains. Open the [Merchant Analyzer](/merchant-analyzer) and load the same file to rank every payee by how much you paid them.

This is where the small-but-frequent charges reveal themselves. A daily coffee is a rounding error per transaction and a real number per year. The merchant view adds those up and puts the biggest first, which is often a more actionable list than the category chart.

## Get everything at once, or export it

If you would rather see the whole picture on one screen — totals, a monthly in-versus-out chart, top spending, subscriptions and possible double charges together — the [Bank Statement Analyzer](/bank-statement-analyzer) combines them and links out to each detailed tool.

And if you want to work with the data yourself, the [Transaction Categorizer](/transaction-categorizer) adds a Category column to your CSV and hands it back, so you can pivot and sum it in a spreadsheet exactly how you like. Your original columns are kept untouched; only the category is appended.

## Common mistakes to avoid

- **Analyzing an unusual month.** A month with a holiday or a big one-off purchase gives averages that describe nothing. Pick a representative period, or exclude the outlier consciously.
- **Trusting automatic categories to the penny.** Keyword categorization is a first pass, not accounting. Verify the big categories before you draw conclusions.
- **Looking only at categories.** The merchant view catches frequent small spends that a broad category hides.
- **Opening the CSV in Excel first.** Excel can mangle dates and long numbers on open — [analyze the CSV as a CSV](/blog/open-csv-in-excel-without-breaking-numbers), or export a fresh copy.
- **Uploading the statement somewhere.** There is no reason to send your spending history to a server for a job your browser can do.

## Frequently asked questions

### How can I see where my money goes each month?

Export your bank statement as CSV and run it through a spending analyzer that groups transactions by category and by merchant. [Vexyn's Spending Analyzer](/spending-analyzer) does both in your browser and charts the result, so the largest categories are obvious at a glance.

### Do I have to upload my bank statement?

No. Vexyn's analyzers run entirely in your browser and send nothing — you can confirm it in the Network panel of your browser's developer tools. Keep financial data local.

### How accurate is the automatic categorization?

It is a transparent keyword rule set, so it is a best-effort starting point rather than an authoritative classification. The big, obvious categories are reliable; unusual or cryptic descriptions may land in "Uncategorized" or the wrong bucket, so spot-check before relying on the exact figures.

### Can I fix or change the categories?

The [Transaction Categorizer](/transaction-categorizer) gives you the file back with a Category column added, which you can edit freely in a spreadsheet. The visual analyzer itself assigns categories automatically and does not save manual overrides.

### What if my spending is spread across several accounts?

Analyze each file, or [merge them first](/blog/merge-multiple-bank-csv-files) into one CSV for a combined view. Spending split across cards is the most common way a large total stays invisible.

### Does it handle other currencies and date formats?

Yes. Set the currency symbol, and choose day-first dates and a comma decimal if that matches your bank. Amounts and dates are parsed exactly as you specify, never guessed.

## Related guides

- [How to find unused subscriptions in your bank statement](/blog/find-unused-subscriptions-bank-statement)
- [How to merge multiple bank CSV files into one](/blog/merge-multiple-bank-csv-files)

## Glossary

**Category** — A bucket that groups similar spending (groceries, transport, dining). Here it is assigned by matching keywords in the transaction description, as a fast first pass rather than an official classification.

**Merchant** — The payee behind a transaction. Bank descriptions are messy, so a merchant view cleans and groups the raw text to add up everything you paid to the same place.

**Uncategorized** — Transactions whose description matched no category rule. The amount still counts toward your total; it simply is not filed under a named category.

**Signed amount** — One number whose sign shows direction: negative for money out, positive for money in. The alternative to separate debit and credit columns.
