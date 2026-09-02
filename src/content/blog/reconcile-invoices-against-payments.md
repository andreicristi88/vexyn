---
title: "How to reconcile invoices against payments"
description: Which invoices are still unpaid, and which incoming payments don't match an invoice? Here is how to reconcile a list of invoices issued against payments received — in your browser, without uploading either file.
pubDate: 2026-09-02
category: 'Business & Stripe'
tags: ['invoices', 'reconciliation', 'accounts receivable', 'guide']
related: ['/invoice-reconciliation', '/transaction-matcher', '/bank-reconciliation']
---

Accounts receivable comes down to two questions: which invoices am I still owed money on, and which payments came in that I can't tie to an invoice? Answering them by eye across two spreadsheets — one of invoices issued, one of payments received — is slow and error-prone, especially when customers pay late, pay in a lump, or pay a slightly rounded amount. This guide reconciles the two lists automatically and shows you exactly what is outstanding and what is unmatched, in your browser.

## Before you start — two files

You need two CSVs: **invoices issued** (what you billed) and **payments received** (what came in — from your bank, Stripe, or a payments processor). Each needs at least a date and an amount column; a reference, invoice number, or customer name helps you read the results. Both files stay on your device.

## Reconcile the two lists

Open [Invoice Reconciliation](/invoice-reconciliation). There are two upload slots side by side.

1. Load **Invoices issued** on the left and **Payments received** on the right. Each slot auto-detects its date, amount, and reference columns.
2. Check the mapping in each: a **Date**, an amount (one signed column, or **Debit / credit** if split), and a **Reference** column. Set each file's date format and decimal separator if the guess is off — the two files can differ.
3. Set the match tolerance: **amount within** exact to a small margin, and **paid within** a window of days (7 to 90). Payments arrive after invoices, so a generous "paid within" — 30 or 60 days — is usually right.
4. Read the verdict panel: total outstanding across N unpaid invoices, or "All invoices paid ✓" when every invoice has a match.

Matching is deterministic — the same files and settings always give the same result — so you can rerun it and trust it.

## Read the three buckets

Three cards let you switch the table between:

- **Unpaid invoices** — invoices with no matching payment. This is your outstanding receivables list, with the total owed. These are the ones to chase.
- **Unmatched payments** — money received that no invoice explains. Could be a prepayment, a partial payment, a duplicate, or an invoice you never recorded — each worth a look.
- **Paid** — invoices with a matching payment. The reconciled set.

Any bucket exports to the format your accounting software imports — Generic CSV, QuickBooks CSV, Xero CSV, QIF, or JSON — so the unpaid list can go straight into a dunning workflow and the unmatched payments into a review queue.

## Why matches can be missed (and how tolerance fixes it)

Real payments rarely match invoices to the penny on the same day. A customer rounds, a processor takes a fee, or the payment clears a week later. If invoices you know were paid show as unpaid, loosen the settings: allow the amount to differ by a cent or a fixed margin, and widen the "paid within" window. Tighten them again if unrelated items start matching. The right tolerance is the one that clears your known-paid invoices without over-matching.

## Common mistakes to avoid

- **Tolerance too tight.** Exact-amount, same-day matching misses late and rounded payments. Widen the window to how your customers actually pay.
- **Fees hiding the match.** If payments arrive net of a processor fee, the amount won't match the invoice exactly — allow a small margin, or reconcile against the gross.
- **Mismatched date formats.** The two files may use different date formats; set each slot's format independently.
- **Treating unmatched payments as errors.** Many are prepayments or partials, not mistakes. Review before adjusting.
- **Uploading your books.** Both files are read in your browser and never sent anywhere.

## Frequently asked questions

### How do I find which invoices are still unpaid?

Reconcile your invoices-issued list against payments-received: any invoice without a matching payment is outstanding. [Vexyn's Invoice Reconciliation](/invoice-reconciliation) does this in your browser and totals what you are owed.

### What are "unmatched payments"?

Payments received that no invoice explains — often prepayments, partial payments, duplicates, or an unrecorded invoice. The tool lists them so you can investigate each.

### Why are invoices I know were paid showing as unpaid?

Usually the match tolerance is too tight. Payments arrive late and sometimes rounded or net of a fee. Allow a small amount margin and a wider "paid within" window.

### Can I export the outstanding list?

Yes. Each bucket — unpaid, unmatched, paid — exports to Generic CSV, QuickBooks, Xero, QIF, or JSON for your accounting or follow-up workflow.

### Is my financial data uploaded?

No. Both files are processed entirely in your browser. You can confirm nothing is sent in the Network panel.

## Related guides

- [How to match two lists of transactions](/blog/match-two-transaction-lists) — the general-purpose version of this comparison.
- [How to reconcile your books against a bank statement](/blog/reconcile-books-to-bank-statement) — reconcile ledger to bank.

## Glossary

**Accounts receivable** — Money owed to you by customers for invoices issued but not yet paid.

**Outstanding invoice** — An invoice with no matching payment received. The sum of these is what you are still owed.

**Unmatched payment** — An incoming payment that no invoice accounts for — a prepayment, partial, duplicate, or unrecorded invoice.

**Match tolerance** — How far apart an invoice and a payment can be in amount and date and still be treated as the same transaction.
