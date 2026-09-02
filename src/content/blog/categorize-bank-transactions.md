---
title: "How to categorize bank transactions automatically"
description: A bank export lists transactions but never sorts them. Here is how to add a Category column to your CSV automatically — keeping every original column untouched — so you can pivot and sum your spending in a spreadsheet, all in your browser.
pubDate: 2026-09-02
category: 'Understanding your money'
tags: ['categories', 'spending', 'guide']
related: ['/transaction-categorizer', '/spending-analyzer', '/bank-statement-analyzer']
---

A bank statement hands you a description and an amount and stops there. If you want to know how much went on groceries versus transport versus subscriptions, someone has to sort every line into a bucket — and doing that by hand for a few hundred transactions is exactly the kind of tedious job worth automating. This guide adds a Category column to your CSV automatically, keeps your original data intact, and hands the file back so you can pivot and total it however you like.

## Before you start — categorizer or analyzer?

There are two ways to use categories, and they answer different needs:

- **Add a column and take the file away.** If you want to work in a spreadsheet — pivot tables, your own formulas, manual corrections — use the [Transaction Categorizer](/transaction-categorizer). It appends a Category column and gives you the CSV back.
- **See the chart without touching a spreadsheet.** If you just want the breakdown on screen, the [Spending Analyzer](/spending-analyzer) categorizes and charts in one step. See [how to analyze your spending](/blog/analyze-spending-bank-statement) for that path.

This guide covers the first: getting a categorized CSV you own.

## Add the Category column

Open the [Transaction Categorizer](/transaction-categorizer). It runs in your browser and never uploads the file.

1. Drop your transactions CSV in. It auto-selects the description column — the text it reads to decide each category.
2. If it picked the wrong column, change **Category from** to the right one (the payee or description field, not the amount).
3. The preview shows your original columns with a new **Category** column on the end, and a row of chips counts how many transactions landed in each category.
4. **Download categorized CSV** (or copy it to the clipboard). Your original columns and values are returned exactly as they were — only the Category column is appended.

## How the categories are decided — and their limits

Categorization here is **keyword matching** on the description text, not a bank's official classification and not machine learning. A description containing "uber" or "shell" maps to transport, "tesco" or "aldi" to groceries, and so on. This has two consequences worth understanding:

- It is **transparent and fast** — you can predict what it will do, and it runs instantly on your device.
- It is **best-effort, not authoritative**. Cryptic or unusual descriptions land in **Uncategorized** rather than being guessed at, and an ambiguous merchant may land in the wrong bucket.

Because the output is a plain CSV, the fix for any mistake is trivial: open it in a spreadsheet and edit the Category cell. The tool does not overwrite your work or store manual overrides — it gives you a well-started file to correct, not a locked result.

## What to do with the categorized file

Once you have the CSV with a Category column, a spreadsheet does the rest: a pivot table by category gives you totals; a pivot by category and month shows how each bucket moves over time. This is the reason to take the file rather than just view a chart — you can slice it any way you want, correct the categories, and keep it alongside your records.

## Common mistakes to avoid

- **Wrong description column.** If the category chips look random, the tool is probably reading the amount or date column. Set **Category from** to the payee/description field.
- **Trusting every category to the penny.** Keyword matching is a first pass. Spot-check the big buckets and correct outliers in the spreadsheet before drawing conclusions.
- **Ignoring "Uncategorized".** Those amounts still count toward your total; they simply matched no rule. A few manual edits usually clears the meaningful ones.
- **Opening the CSV in Excel first and re-saving.** Excel can mangle dates and long numbers on open — categorize the CSV as a CSV, then open the result. See the [Excel guide](/blog/open-csv-in-excel-without-breaking-numbers).
- **Uploading the statement somewhere.** The categorization runs in your browser; keep the data local.

## Frequently asked questions

### How do I automatically categorize bank transactions in a CSV?

Run the file through a categorizer that reads the description column and appends a Category column. [Vexyn's Transaction Categorizer](/transaction-categorizer) does this in your browser by keyword matching, keeps your original columns untouched, and gives the CSV back for you to pivot or edit.

### Does it change my original data?

No. It appends a single Category column and returns every other column and value exactly as it was. Nothing is overwritten.

### How accurate is the automatic categorization?

It is transparent keyword matching, so the obvious merchants are reliable and unusual descriptions land in "Uncategorized" rather than being guessed. Treat it as a well-started draft and correct edge cases in a spreadsheet.

### Can I edit the categories afterwards?

Yes — that is the intended workflow. The output is a plain CSV, so open it in any spreadsheet and edit the Category cells freely.

### Is my bank data uploaded?

No. The tool reads and rewrites the file in your browser and sends nothing. You can verify this in the Network panel of your developer tools.

## Related guides

- [How to analyze your spending from a bank statement](/blog/analyze-spending-bank-statement) — the on-screen chart version.
- [How to read a bank statement](/blog/how-to-read-a-bank-statement) — what each column means before you categorize.

## Glossary

**Category** — A bucket grouping similar spending (groceries, transport, dining). Here it is assigned by matching keywords in the transaction description.

**Uncategorized** — A transaction whose description matched no category rule. Its amount still counts toward totals; it simply is not filed under a named category.

**Keyword matching** — Deciding a category by looking for known words in the description text. Fast and transparent, but a first pass rather than an official classification.

**Pivot table** — A spreadsheet feature that groups and totals rows by a field — here, summing amounts per category once the Category column exists.
