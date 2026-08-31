---
title: How to clean a messy bank CSV export
description: Bank CSV exports arrive with stray whitespace, blank rows, junk headers, and inconsistent formats. Here is how to turn a messy export into a clean, standard file — ready for a spreadsheet, an accountant, or another tool — without uploading it.
pubDate: 2026-09-01
category: 'Cleaning & organizing'
tags: ['csv', 'bank', 'guide']
related: ['/csv-cleaner', '/bank-csv-formatter']
---

Bank CSV exports are rarely clean. There is whitespace padding every value, blank rows scattered through the file, a couple of junk header lines the bank adds at the top, duplicate column names, and a date or number format that fights whatever you want to do next. Before you hand the file to your accountant, import it, or analyze it, it pays to tidy it up. This guide covers two levels of cleaning: quick structural fixes, and reshaping the whole thing into a standard layout.

## Before you start — two kinds of clean

"Clean this CSV" can mean two different jobs:

- **Structural tidy-up:** trim whitespace, drop blank rows, remove duplicate rows, fix messy headers. The values and columns stay as they are — just tidier.
- **Reformatting to a standard:** map the bank's columns to one consistent layout (a proper date column, a single signed amount, tidy headers), so every bank's export ends up the same shape.

Do the structural tidy-up when the file is nearly right. Do the reformat when you want a predictable layout to feed into a spreadsheet template or another tool.

## Step 1 — Structural tidy-up

Open [Vexyn's CSV Cleaner](/csv-cleaner). It runs in your browser and uploads nothing.

1. Drop the CSV in. It auto-detects the delimiter (comma, semicolon, tab) and shows the row and column counts.
2. Turn on the fixes you need:
   - **Trim whitespace** — removes the stray spaces around values that break lookups and joins.
   - **Remove empty rows** — clears the blank padding exports love to add.
   - **Remove duplicate rows** — drops exact repeats.
   - **Clean headers** — trims header names and makes duplicates unique, so a second "Amount" column does not silently merge with the first.
3. The preview updates live and tells you what changed. Download the tidy CSV.

Crucially, every value stays as text — an account number like `00123` keeps its leading zeros, and long numbers are never turned into scientific notation.

## Step 2 — Reformat to a standard layout (optional)

If you want more than a tidy-up — one consistent shape regardless of which bank the file came from — use the [Bank CSV Formatter](/bank-csv-formatter).

1. Drop the CSV in and map the columns: which is the Date, which is the Amount (or a Debit and a Credit column that should be combined into one signed amount), and optionally Balance and Category.
2. Set the date format and decimal separator so dates come out as clean ISO (`2026-01-31`) and amounts as a single signed decimal.
3. Download the standardized file. Every bank's export now has the same tidy columns.

This is the step that makes downstream work predictable: a spreadsheet template, an import, or another tool always receives the same layout.

## Step 3 — Handle the junk header rows

Some banks add a line or two of account metadata above the real header — an account name, a date range. If your file has these, they can throw off the column detection. The simplest fix is to open the file in a plain text editor and delete those top lines so the real header is the first row, then run the cleaner. Most exports do not need this, but it is worth knowing when the columns look wrong.

## Common mistakes to avoid

- **Opening the file in Excel to clean it.** Excel will reinterpret your numbers and dates on open — see the [Excel guide](/blog/open-csv-in-excel-without-breaking-numbers). Clean the CSV as a CSV first, then open it.
- **Removing empty rows that are meaningful.** Rare, but some exports use a blank row as a separator between accounts. Check before bulk-removing if your file has structure like that.
- **Merging first, cleaning never.** If you combined several exports, clean and dedupe the merged result — the mess compounds across files.
- **Uploading the statement to an online cleaner.** Keep it local.

## Frequently asked questions

### Will cleaning change my numbers?

No. The cleaner keeps every value as text, so leading zeros and long numbers survive exactly. It only removes whitespace, blank rows, duplicates, and fixes header names.

### How do I combine separate debit and credit columns?

Use the [Bank CSV Formatter](/bank-csv-formatter) and choose "separate debit and credit" — it combines them into one signed amount, credits positive and debits negative.

### My bank puts junk lines above the header. What do I do?

Delete those top lines in a plain text editor so the real header is the first row, then clean the file. This helps the tool detect the columns correctly.

### Is my data uploaded?

No. Both tools run in your browser and send nothing. Confirm it in the Network panel.

## Related guides

- [How to merge multiple bank CSV files into one](/blog/merge-multiple-bank-csv-files)
- [How to find and remove duplicate transactions in a CSV](/blog/remove-duplicate-transactions-csv)

## Glossary

**Delimiter** — The character separating fields in a CSV: a comma, semicolon, or tab. Cleaners detect it automatically; European exports often use semicolons.

**Standard layout** — One consistent set of columns (Date, Description, Amount, and so on) that every export is mapped to, so downstream tools always receive the same shape.

**Signed amount** — A single number where the sign gives direction: negative for money out, positive for money in. The tidy alternative to separate debit and credit columns.
