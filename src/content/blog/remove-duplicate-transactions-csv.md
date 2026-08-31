---
title: How to find and remove duplicate transactions in a CSV
description: Duplicate transactions creep in from overlapping exports and double charges. Here is how to remove them from a CSV — by whole row or by a key like Transaction ID — without altering the rows you keep or uploading your data.
pubDate: 2026-09-01
category: 'Cleaning & organizing'
tags: ['csv', 'bank', 'guide']
related: ['/csv-deduplicator', '/csv-merger']
---

Duplicate rows in a transaction file cause real problems: doubled totals, a reconciliation that never balances, a spending report that overstates a category. They creep in from overlapping date ranges when you merge exports, from an export that ran twice, or from a genuine double charge you want to spot. This guide shows how to find and remove them safely — without changing the transactions you keep.

## Before you start — what counts as a duplicate?

There are two different questions hiding in "remove duplicates", and they need different answers:

- **Is the whole row identical?** Two rows where every field matches — the classic sign an export was appended twice.
- **Is the same transaction repeated?** Two rows with the same Transaction ID or reference, even if a note, a running balance, or a timestamp differs. The identity is the ID, not the whole row.

Deciding which one applies to your file is the important part. Remove by whole row when you have exact repeats; remove by a key column when the same transaction shows up with small differences.

## Step 1 — Open the file and decide the identity

Open [Vexyn's CSV Deduplicator](/csv-deduplicator). It runs in your browser and never uploads the file.

1. Drop the CSV in.
2. By default it treats a row as a duplicate only when the whole row matches.
3. If your transactions have a unique column — a Transaction ID, a reference number — click that column header to match on it instead. Now rows are duplicates when that value repeats, regardless of the other fields.
4. You can select more than one column to form a compound key (for example, Date plus Amount plus Description) when there is no single ID.

## Step 2 — Choose which copy to keep

When duplicates are found, you decide which one survives:

- **Keep first** (the default) — keep the earliest occurrence, drop later repeats.
- **Keep last** — keep the most recent, useful when a later export corrected an earlier one.

There is also an option to ignore case and surrounding spaces, so "ACME " and "acme" count as the same value. Turn it on for messy exports where the same entry appears with slightly different formatting.

The tool reports how many rows it removed and across how many duplicate groups, so you can sanity-check the result before downloading.

## Step 3 — Verify and download

Before downloading, glance at the numbers. If you expected a handful of overlapping days to produce a few duplicates and the tool removed hundreds, your key is probably too loose — for example, matching on Amount alone will treat every €10 coffee as the same transaction. Tighten the key (add Date and Description) and try again.

The rows you keep are byte-for-byte unchanged, including leading zeros and formatting. Download the cleaned CSV.

## Common mistakes to avoid

- **Deduping on Amount alone.** Many real, distinct transactions share an amount. Use a Transaction ID, or a compound key of Date plus Amount plus Description.
- **Removing "duplicates" that are actually two real charges.** If you were genuinely billed twice, those are two transactions in your bank's record — deduping the CSV hides the problem instead of surfacing it. Deduplicate to clean up export artifacts, not to erase real double charges you should dispute.
- **Deduping before merging, then merging again.** Merge all your files first, then dedupe once at the end — otherwise cross-file duplicates survive.
- **Uploading the file to an online tool.** Keep transaction data local.

## Frequently asked questions

### How do I remove duplicates by Transaction ID?

Load the file and click the Transaction ID column header so matching is done on that column. Rows with the same ID are then treated as duplicates even if other fields differ.

### Does it change the rows I keep?

No. It only removes duplicate rows; the survivors are unchanged, including formatting and leading zeros.

### What if there is no unique ID column?

Build a compound key: select the columns that together identify a transaction, typically Date, Amount, and Description. Rows matching on all of them are treated as duplicates.

### Is my data uploaded?

No. Deduplication runs in your browser. The Network panel shows nothing sent.

## Related guides

- [How to merge multiple bank CSV files into one](/blog/merge-multiple-bank-csv-files)
- [How to clean a messy bank CSV export](/blog/clean-messy-bank-csv)

## Glossary

**Key column** — A column (or set of columns) that defines a transaction's identity for deduplication, such as a Transaction ID. Rows sharing the key are duplicates even if other fields differ.

**Compound key** — Several columns combined to identify a transaction when no single unique column exists, for example Date plus Amount plus Description.

**Duplicate group** — A set of rows that share the same identity. Deduplication keeps one from each group and removes the rest.
