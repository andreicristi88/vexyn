---
title: How to reconcile your books against a bank statement
description: Bank reconciliation means proving your ledger and your bank statement agree, and explaining every difference. Here is how to reconcile the two CSVs automatically — with uncleared and unrecorded items surfaced — in your browser, without uploading them.
pubDate: 2026-09-02
category: 'Business & Stripe'
tags: ['bank reconciliation', 'accounting', 'guide']
related: ['/bank-reconciliation', '/transaction-matcher', '/invoice-reconciliation']
---

Bank reconciliation is the monthly ritual of proving that what your books say and what the bank says are the same thing — and, where they differ, explaining exactly why. Most of the time the gap is innocent: a cheque you wrote that hasn't cleared, a bank fee you haven't recorded yet. But you cannot close the month until every difference is accounted for. This guide reconciles your ledger against the bank statement automatically, tells you the exact amount you're off by, and lists the items that explain it — in your browser.

## Before you start — two files

Export two CSVs: **your ledger** (what your books say — from your accounting software or a spreadsheet) and the **bank statement** for the same period. Each needs a date and an amount column; a description helps you recognise the unmatched items. Both stay on your device.

## Reconcile the two sides

Open [Bank Reconciliation](/bank-reconciliation). Two upload slots sit side by side.

1. Load **Your ledger** on the left and the **Bank statement** on the right. Each auto-detects date, amount, and description columns.
2. Confirm each mapping — a **Date**, an amount (one signed column, or **Debit / credit** if the bank splits them), and a description. Set each file's date format and decimal separator; the two often differ.
3. Set the match tolerance: **amount within** exact or a small margin, and **date within** a few days (bank posting dates lag your ledger, so 1–3 days is sensible).
4. Read the verdict: **Reconciled ✓** when both sides fully match, or **Off by X** with the difference spelled out as bank total minus ledger total.

## Read the difference

When it doesn't reconcile, three cards explain why:

- **In ledger, not bank** — transactions you've recorded that haven't appeared on the statement. Typically *uncleared* items: a cheque or payment still in transit.
- **On bank, not ledger** — transactions on the statement you haven't recorded. Typically bank fees, interest, or direct debits *to record* in your books.
- **Matched** — the transactions both sides agree on.

The verdict tells you how many unmatched items explain the gap; clear or record them and the reconciliation goes to zero. Each bucket exports to Generic CSV, QuickBooks, Xero, QIF, or JSON, so the "to record" list can go straight into your accounting software.

## The logic: two clean buckets, one difference

A good reconciliation doesn't just say "you're off by $80" — it partitions the gap into things you'll clear (in ledger, not bank) and things you'll record (on bank, not ledger). When both buckets are empty, the difference is zero by definition and the month is reconciled. That is why the tool leads with the two lists rather than a single number: the lists are the actionable part, and each one has a clear next step.

## Common mistakes to avoid

- **Same-day matching only.** Bank posting dates lag. Allow a date window of a day or three, or legitimate matches show as unmatched.
- **Forcing a zero difference.** Don't fudge the ledger to make it balance. Every difference should be explained by an item in one of the two buckets.
- **Mismatched date formats.** Your ledger and the bank may format dates differently. Set each slot independently.
- **Ignoring "on bank, not ledger".** Those are usually real fees and interest you haven't booked. Record them — that is half the job.
- **Uploading your books or statement.** Both files are processed in your browser and never leave it.

## Frequently asked questions

### How do I reconcile my books to my bank statement?

Match your ledger against the bank statement, then explain every difference with the items on one side but not the other. [Vexyn's Bank Reconciliation](/bank-reconciliation) does the matching in your browser and splits the gap into uncleared items and unrecorded items.

### What does "in ledger, not bank" mean?

Transactions you've recorded that haven't hit the statement yet — usually uncleared cheques or payments in transit. They explain part of the difference and resolve when they clear.

### What about "on bank, not ledger"?

Transactions on the statement you haven't recorded — typically bank fees, interest, or direct debits. Record them in your books to close the gap.

### Why won't my accounts reconcile to zero?

Because at least one transaction is on one side but not the other. The two unmatched buckets list exactly which ones; clearing or recording them brings the difference to zero.

### Is my financial data uploaded anywhere?

No. Both files are read and compared entirely in your browser. Confirm it in the Network panel.

## Related guides

- [How to match two lists of transactions](/blog/match-two-transaction-lists) — the general matching engine behind this.
- [How to reconcile invoices against payments received](/blog/reconcile-invoices-against-payments) — the receivables version.

## Glossary

**Bank reconciliation** — Proving your ledger and bank statement agree, and explaining each difference. Reconciled means the unexplained difference is zero.

**Uncleared item** — A transaction recorded in your ledger that hasn't yet appeared on the bank statement, such as a cheque in transit.

**Unrecorded item** — A transaction on the bank statement not yet in your ledger, such as a bank fee or interest.

**Match tolerance** — How far apart a ledger entry and a bank line can be in amount and date and still count as the same transaction.
