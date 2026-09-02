---
title: "How to convert a bank CSV to OFX"
description: When your bank only gives you a CSV but your finance app wants OFX, you need a converter that gets the dates and amounts right. Here is how OFX works, the two things that break conversions, and how to do it locally without uploading your statement.
pubDate: 2026-09-01
category: 'Accounting imports'
tags: ['ofx', 'bank', 'guide']
related: ['/csv-to-ofx', '/bank-csv-formatter']
---

Your bank gives you a CSV. Your personal-finance software — Quicken, GnuCash, MoneyMoney, Banktivity — wants OFX. So you go looking for a converter, and most of them ask you to upload your bank statement to their server first. For a file full of your transactions, that is exactly the wrong trade-off for a job your own browser can do.

This guide explains what OFX is, why bank-CSV conversion is trickier than it looks, and how to convert a CSV to OFX locally with the dates and amounts intact.

## Before you start — what OFX is and why the CSV needs converting

OFX (Open Financial Exchange) is the standard format finance software uses to import transactions. It is structured: every transaction carries a posted date, a signed amount, a description, and a unique ID, and the file names the account they belong to. A CSV has none of that structure guaranteed — it is just columns of text, and every bank lays them out differently.

Converting means mapping your bank's columns onto OFX's fields and, critically, parsing two kinds of value correctly:

- **Dates.** `01/02/2026` is January 2 in the United States and February 1 in most of Europe. Guess wrong and every transaction lands on the wrong day.
- **Amounts.** `1,234.56` and `1.234,56` are the same number written two ways. Some banks split money-in and money-out into separate columns; some mark debits with `DR` or wrap negatives in parentheses.

A converter that gets these two things right produces a clean import. One that guesses silently produces a mess you only notice weeks later. So the goal is a converter that lets you **see and confirm** the parsed dates and amounts before you commit.

## Get your transactions as a CSV

Download the transactions from your bank as CSV — usually under "Export", "Download", or "Statements". Pick the date range you need. If your bank offers OFX or QIF directly, use that instead; this guide is for when CSV is all you get.

Open the file once in a plain text editor to see what you are working with: which column is the date, which is the amount (or whether there are separate debit and credit columns), and what the description column is called. You do not need to change anything — just know the layout.

## Convert with the columns mapped explicitly

Open [Vexyn's CSV to OFX converter](/csv-to-ofx). It runs entirely in your browser — the statement is never uploaded — and it asks you to map your columns instead of guessing.

1. Drop the CSV in. It auto-detects the delimiter and takes a first guess at which column is the date, amount, and description.
2. Check the mapping. Correct the **Date** and **Amount** columns if the guess is off. If your bank uses separate debit and credit columns, the sibling [Bank CSV Formatter](/bank-csv-formatter) can combine them into one signed column first.
3. Set the **date format** (year-first, month-first, or day-first) and the **decimal separator** (dot or comma). This is the step that prevents the January-2-versus-February-1 disaster.
4. Enter your account details — an account number is enough; bank ID and account type are optional but help some importers.
5. Look at the preview. It shows every parsed date and the signed amount, and lists any rows it could not read. Confirm the dates and the plus/minus signs look right.
6. Download the .ofx.

## Import into your finance software and verify

Import the .ofx the way your app expects (usually File → Import). Then check three things against the original statement:

- **A few dates**, especially early in the file, match the statement.
- **The signs** are right: money out is negative, money in is positive.
- **The count** of imported transactions matches what you expected. If the converter skipped rows it could not parse, it told you — go back and fix the date format or decimal separator for those.

If the numbers line up, you are done. If a whole block of dates is off by a day or a month, your date-format setting was wrong; reconvert with the correct one.

## Common mistakes to avoid

- **Uploading the statement to an online converter.** Most CSV-to-OFX sites upload your file. For a bank statement, keep it local — the whole job runs fine in the browser.
- **Trusting a silent conversion.** If a tool does not show you the parsed dates and amounts, you have no way to catch a wrong date format until the data is already in your books. Always confirm the preview.
- **Ignoring the sign convention.** Some banks write money-out as a positive number in a single column. If your imported debits show up as income, flip the sign and reconvert.
- **Re-importing and creating duplicates.** OFX uses a transaction ID (FITID) to dedupe. A good converter generates a stable ID from each transaction, so importing the same file twice does not double your entries. If yours does not, import each file only once.

## Frequently asked questions

### What software imports OFX files?

Quicken, GnuCash, MoneyMoney, Banktivity, and many others read OFX. It is the most widely supported import format for personal-finance software, which is why it is usually the safest target when your bank only offers CSV.

### How do I avoid the wrong dates?

Set the date format explicitly rather than letting a tool guess, and confirm the parsed dates in a preview before importing. `01/02` is genuinely ambiguous, so the only safe approach is to tell the converter which order your bank uses and then check.

### My bank has separate debit and credit columns. Does that work?

Yes, but they need to be combined into one signed amount first — credits positive, debits negative. The [Bank CSV Formatter](/bank-csv-formatter) does this, then you feed the result to the OFX converter.

### Is OFX or QBO the right choice?

OFX is broader — Quicken, GnuCash, and others accept it. QBO is OFX plus two Intuit tags, specifically for QuickBooks. If you use QuickBooks, see the [CSV to QBO guide](/blog/convert-csv-to-qbo-for-quickbooks); for everything else, OFX.

### Is my bank data really not uploaded?

With a browser-based converter like Vexyn's, no — open your browser's Network panel while you use it and you will see no requests carry your data out. The conversion is plain JavaScript running on your device.

## Related guides

- [CSV to QBO for QuickBooks](/blog/convert-csv-to-qbo-for-quickbooks) — the QuickBooks-specific version.
- [How to open a CSV in Excel without breaking your numbers](/blog/open-csv-in-excel-without-breaking-numbers) — the same date and number traps, in a spreadsheet.

## Sources cited in this guide

- [OFX (Open Financial Exchange) specification](https://www.ofx.net/)
- [GnuCash: importing transactions from files](https://www.gnucash.org/docs/v5/C/gnucash-help/trans-import.html)

## Glossary

**OFX** — Open Financial Exchange. A structured format for exchanging financial transactions, imported by most personal-finance software. Each transaction carries a date, signed amount, description, and unique ID.

**FITID** — Financial Institution Transaction ID. A unique identifier per transaction in an OFX file. Software uses it to avoid importing the same transaction twice.

**Decimal separator** — The character that marks the fractional part of a number: a dot in `1,234.56` (US/UK) or a comma in `1.234,56` (much of Europe). Getting it wrong turns `4.50` into `450`.

**Signed amount** — A single number where the sign carries direction: negative for money out, positive for money in. OFX expects amounts this way, which is why banks that split debit and credit into two columns need them combined first.
