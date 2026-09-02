---
title: How to standardize any bank CSV into one consistent layout
description: Every bank exports transactions in its own column layout, which makes templates and imports fragile. Here is how to map any bank CSV to one standard shape — a clean date, a single signed amount, tidy headers — in your browser, without uploading it.
pubDate: 2026-09-02
category: 'Cleaning & organizing'
tags: ['csv', 'bank', 'guide']
related: ['/bank-csv-formatter', '/csv-cleaner', '/csv-merger']
---

Every bank invents its own CSV layout. One puts the date first, another last; one gives you a single signed amount, another splits money out and money in into separate Debit and Credit columns; the date is `31/01/2026` here and `2026-01-31` there. The moment you build a spreadsheet template, an import routine, or a monthly report, that inconsistency becomes friction — the template only fits one bank. This guide maps any bank's export to one standard shape, so everything downstream receives the same columns every time.

## Before you start — what "standard layout" means here

The goal is a predictable set of columns regardless of source: a **Date** in clean ISO form (`2026-01-31`), a single **signed Amount** (negative for money out, positive for money in), a **Description**, and optionally **Balance** and **Category**. Once every export lands in that shape, your template, your accountant, and your other tools stop caring which bank the file came from.

This is different from a simple tidy-up. If you only need to trim whitespace and drop blank rows without changing the columns, that is the [CSV Cleaner](/csv-cleaner)'s job. Use the formatter when you want to change the *shape*.

## Map your columns to the standard

Open [Vexyn's Bank CSV Formatter](/bank-csv-formatter). It runs in your browser and uploads nothing.

1. Drop the bank CSV in. It reads the headers and takes a first guess at each field.
2. Set **Date** — the column holding the transaction date (required).
3. Set the **Amount columns** mode:
   - **One signed column** if the bank already gives a single amount with a sign. Map it to **Amount**. If your bank shows spending as a *positive* number, tick **Money out is positive (flip signs)** so debits come out negative.
   - **Separate debit & credit** if money out and money in are in two columns. Map both **Debit (out)** and **Credit (in)**; the tool combines them into one signed amount — debits negative, credits positive.
4. Optionally map **Description**, **Balance**, and **Category**.
5. Set the **Date format** (year-first, month-first, or day-first) and the **Decimal separator** (dot or comma) to match your file. This is what turns `31/01/2026` and `1.234,56` into clean `2026-01-31` and `1234.56`.
6. Check the preview — the amount column is coloured by sign so wrong signs are obvious — and **Download formatted CSV**.

If the tool reports that some values could not be normalized, it is almost always the date format or the decimal separator set wrong for that file — fix those two and the count drops to zero.

## Why one column layout is worth the trouble

The payoff shows up downstream. A budgeting spreadsheet with formulas that reference "column C, the amount" breaks the day a different bank puts the amount in column E — unless every file is formatted to the same layout first. The same is true for an import routine or another Vexyn tool: they all become predictable once the input shape is fixed. Standardizing is the unglamorous step that makes everything after it reliable.

## Combining several banks into one file

If you want a single view across accounts, format each bank's export to the standard layout first, then [merge them into one CSV](/blog/merge-multiple-bank-csv-files). Because every file now has identical columns, the merge aligns cleanly by name instead of stacking mismatched headers. Formatting-then-merging is the reliable order; merging raw exports first tends to produce a file with three different "amount" columns.

## Common mistakes to avoid

- **Wrong date format.** `01/02/2026` is 1 February or 2 January depending on the setting. Pick the one that matches your bank, and sanity-check a date you recognise in the preview.
- **Wrong decimal separator.** A European file using `1.234,56` read as dot-decimal turns into nonsense. Set comma-decimal for those.
- **Forgetting to flip signs.** Some banks list spending as a positive number. If your money-out rows come out positive, tick the flip-signs option.
- **Merging before formatting.** Standardize each file first, then merge — otherwise the columns don't line up.
- **Uploading the statement.** The whole conversion runs in your browser; there is no reason to send it out.

## Frequently asked questions

### How do I make every bank's CSV have the same columns?

Map each export to a standard layout with a formatter: choose which column is the date, which is the amount (or combine separate debit and credit columns), and set the date and number format. [Vexyn's Bank CSV Formatter](/bank-csv-formatter) does this in your browser and outputs one consistent shape.

### How do I combine separate Debit and Credit columns into one amount?

Choose "Separate debit & credit" and map both columns. They are combined into a single signed amount — debits negative, credits positive — which is the tidy form most tools and spreadsheets expect.

### My dates come out wrong. What do I fix?

The date format setting. `31/01/2026` is day-first, `01/31/2026` is month-first, `2026-01-31` is year-first. Match it to your file and the dates normalize to clean ISO.

### Is my bank data uploaded?

No. The formatter reads and rewrites the file entirely in your browser. Open the Network panel and you will see your file is never sent anywhere.

### What is the difference between this and the CSV Cleaner?

The cleaner tidies a file without changing its columns (whitespace, blank rows, duplicates, header names). The formatter changes the *shape* — mapping any bank's columns to one standard layout. Use the cleaner for a tidy-up, the formatter for consistency across banks.

## Related guides

- [How to clean a messy bank CSV export](/blog/clean-messy-bank-csv) — the structural tidy-up that pairs with this.
- [How to merge multiple bank CSV files into one](/blog/merge-multiple-bank-csv-files) — do this after standardizing each file.

## Glossary

**Standard layout** — One fixed set of columns (Date, Description, Amount, and so on) that every export is mapped to, so downstream tools always receive the same shape.

**Signed amount** — A single number whose sign gives direction: negative for money out, positive for money in. The tidy alternative to separate debit and credit columns.

**ISO date** — The `YYYY-MM-DD` form (`2026-01-31`). Unambiguous and sortable, which is why the formatter normalizes every date to it.

**Decimal separator** — The character marking the fractional part of a number: a dot (`1,234.56`) in most English locales, a comma (`1.234,56`) in much of Europe.
