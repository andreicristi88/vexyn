---
title: How to match two lists of transactions and find the gaps
description: When two records of the same transactions should agree but don't, you need to know which entries appear in one list and not the other. Here is how to match two transaction CSVs and surface exactly what's missing on each side — in your browser, without uploading them.
pubDate: 2026-09-02
category: 'Business & Stripe'
tags: ['matching', 'reconciliation', 'guide']
related: ['/transaction-matcher', '/bank-reconciliation', '/invoice-reconciliation']
---

Any time two systems record the same money, they should agree — and checking that they do is a job that appears everywhere: your records against a processor's, a spreadsheet against an export, this month's file against last month's. When they don't agree, the useful output isn't "they differ", it's *which specific rows* are in one list and not the other. This guide matches two transaction lists and hands you exactly those gaps, in your browser. It's the general-purpose tool underneath the more specific [bank](/blog/reconcile-books-to-bank-statement) and [invoice](/blog/reconcile-invoices-against-payments) reconciliations.

## Before you start — two comparable files

You need two CSVs recording the same kind of transactions — call them List A and List B. Each needs a date and an amount column; a description helps you read the results. They don't have to share a layout: you'll map each file's columns separately. Both stay on your device.

## Match the two lists

Open [Transaction Matcher](/transaction-matcher). Two upload slots sit side by side.

1. Load your first file into **List A** and the second into **List B**. Each slot auto-detects its date, amount, and description columns.
2. Confirm each mapping — a **Date**, an amount (**One amount** signed, or **Debit / credit** if split), and a **Description**. Set each file's date format and decimal separator independently.
3. Set the match rule: **amount within** exact to a margin, and **date within** same-day to seven days. The right setting depends on how much the two systems can legitimately drift.
4. Three cards summarise the result: **Matched**, **Only in List A**, and **Only in List B**, each with a count and the two "only" lists totalled by amount.

Matching is deterministic first-fit: each entry pairs with at most one on the other side, and the same inputs always produce the same result.

## Read and export the gaps

Click a card to switch the table:

- **Only in List A** — entries in the first file with no counterpart in the second.
- **Only in List B** — entries in the second file that the first is missing.
- **Matched** — the entries both lists agree on.

Whichever view you're on exports to Generic CSV, QuickBooks CSV, Xero CSV, QIF, or JSON, so the discrepancies go straight into whatever handles them next.

## Tuning the tolerance

The amount and date tolerances are what make matching realistic. Two records of the same transaction often differ slightly — a rounding, a fee, a posting-date lag of a day or two. If entries you know are the same show as unmatched, loosen the tolerances; if unrelated entries start pairing up, tighten them. The goal is the setting where genuine matches pair and genuine discrepancies remain — that residue is the answer you came for.

## Common mistakes to avoid

- **Over-tight matching.** Exact amount and same day will strand legitimate matches that drifted by a cent or a day. Loosen to reality.
- **Over-loose matching.** Too wide a window pairs unrelated transactions and hides real gaps. Tighten until only true matches pair.
- **Assuming the files share a layout.** They needn't — map each one's columns and formats separately.
- **Reading only one side.** "Only in A" and "only in B" are different problems (missing here vs extra there). Check both.
- **Uploading the files.** Both are compared in your browser and never sent anywhere.

## Frequently asked questions

### How do I compare two CSVs of transactions to find what's different?

Match them by date and amount, then look at the entries present in one file but not the other. [Vexyn's Transaction Matcher](/transaction-matcher) does this in your browser and lists what's only in each file, with totals.

### The same transaction shows as unmatched in both lists. Why?

The tolerances are probably too tight. If the two systems record a slightly different amount or a posting date a day apart, allow a small amount margin and a date window so they pair.

### Can I match files with different column layouts?

Yes. Each file's columns and date/number formats are mapped independently, so a bank export and a hand-kept spreadsheet compare fine.

### What's the difference between this and bank reconciliation?

Transaction matching is the general engine — any two lists. [Bank reconciliation](/blog/reconcile-books-to-bank-statement) applies it specifically to a ledger vs a bank statement, with an "off by" verdict and accounting-oriented buckets.

### Is my data uploaded anywhere?

No. Both files are matched entirely in your browser. You can verify nothing is sent in the Network panel.

## Related guides

- [How to reconcile your books against a bank statement](/blog/reconcile-books-to-bank-statement) — matching applied to ledger vs bank.
- [How to reconcile invoices against payments received](/blog/reconcile-invoices-against-payments) — matching applied to receivables.

## Glossary

**Matching** — Pairing entries in two lists that represent the same transaction, by date and amount within a tolerance.

**First-fit** — A deterministic strategy where each entry pairs with the first eligible counterpart, so results are stable and repeatable.

**Tolerance** — How far two entries can differ in amount and date and still be treated as the same transaction.

**Discrepancy** — An entry present in one list but not the other — the output the whole exercise is after.
