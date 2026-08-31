---
title: How to merge multiple bank CSV files into one
description: Combining monthly bank exports into a single file breaks the moment one month adds a column or reorders them. Here is how to merge CSVs by column name so a year of statements becomes one clean file — without uploading anything.
pubDate: 2026-09-01
category: 'Cleaning & organizing'
tags: ['csv', 'bank', 'guide']
related: ['/csv-merger', '/csv-deduplicator']
---

You have twelve monthly bank exports and you want one file for the whole year — for your accountant, for a spending review, for import into another tool. The obvious approach is to stack them on top of each other. It works right up until the month where your bank quietly added a column, or listed them in a different order, and now half your rows are shifted into the wrong fields.

This guide shows how to merge CSV files correctly — by matching columns on their names, not their positions — so mismatched exports still combine cleanly.

## Before you start — why stacking breaks

Combining CSVs by simply appending their rows assumes every file has the same columns in the same order. Bank exports rarely cooperate. Over a year a bank might rename "Description" to "Details", add a "Balance" column, or change the column order after a website update. Append blindly and the values land under the wrong headers — a merge that looks done but is silently wrong.

The fix is to merge by **column name**: line up each file's "Date" with every other file's "Date", regardless of where it sits, and fill blanks where a file is missing a column. That way a year of slightly different exports still produces one coherent table.

## Gather your CSV files

Collect the exports you want to combine. They can come from the same account across different months, or even different accounts, as long as the columns are broadly similar. Open one or two in a text editor to confirm they are genuinely CSVs and roughly the same shape.

## Merge by column name

Open [Vexyn's CSV Merger](/csv-merger). It runs in your browser and matches columns by name — your file is never uploaded.

1. Drop all the files in at once, or add them one at a time. Each appears in a list with its column and row count.
2. The tool builds the union of all columns: every column that appears in any file becomes a column in the result, in the order it was first seen.
3. Rows are appended in the order you added the files. A file missing a column simply gets blanks for it — no data is dropped or shifted.
4. Review the merged preview, then download the single combined CSV.

## Clean up afterwards, if needed

A merged file often benefits from two quick follow-ups:

- **Remove duplicates.** If date ranges overlapped between exports, the same transaction can appear twice. Run the result through the [CSV Deduplicator](/csv-deduplicator) — dedupe on a transaction ID column if you have one, or on the whole row.
- **Standardize the layout.** If the source files used different date formats or split debit/credit differently, the [Bank CSV Formatter](/bank-csv-formatter) can reshape the merged file into one consistent layout.

## Common mistakes to avoid

- **Stacking files with a text editor or copy-paste.** This is exactly the position-based merge that breaks when columns differ. Merge by name instead.
- **Forgetting overlapping date ranges.** If two exports both cover the last day of a month, that day's transactions appear twice. Dedupe after merging.
- **Merging files that are genuinely different.** Combining a checking-account export with a totally different credit-card layout produces a wide, sparse file. Merge like with like, or standardize each first.
- **Uploading statements to an online merger.** Keep it local — combining files is pure text work your browser handles.

## Frequently asked questions

### What if the files have different column names for the same thing?

Column matching is by name, so "Description" and "Details" are treated as different columns and both appear in the result. To truly unify them, rename the header in one file first, or run each file through the [Bank CSV Formatter](/bank-csv-formatter) to a standard layout before merging.

### Will merging change my values?

No. Every value is carried across exactly, including leading zeros. Only the columns are aligned; the data itself is untouched.

### How many files can I merge?

As many as your browser's memory allows — a year or more of normal monthly exports is no problem.

### Is my data uploaded?

No. The merge happens in your browser. Open the Network panel and you will see your file is never sent out.

## Related guides

- [How to find and remove duplicate transactions in a CSV](/blog/remove-duplicate-transactions-csv)
- [How to clean a messy bank CSV export](/blog/clean-messy-bank-csv)

## Glossary

**Union of columns** — The full set of columns across all merged files. If one file has a column the others lack, it still appears in the result, with blanks for the files that did not have it.

**Merge by name** — Aligning columns on their header text rather than their position, so files with different column orders or extra columns still combine correctly.
