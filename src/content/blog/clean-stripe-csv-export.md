---
title: "How to turn a Stripe CSV export into a clean sheet"
description: A raw Stripe payments export is dozens of columns wide and reports gross amounts, not what you kept. Here is how to turn it into a clean sheet with the net you actually received — gross minus fees minus refunds — in your browser, without uploading it.
pubDate: 2026-09-02
category: 'Business & Stripe'
tags: ['stripe', 'accounting', 'guide']
related: ['/stripe-csv-cleaner', '/stripe-payout-analyzer', '/saas-metrics']
---

A Stripe payments export is technically complete and practically unreadable: dozens of columns, cryptic ids, and — the part that trips everyone up — an "Amount" that is the gross charge, not the money you actually kept. Between Stripe's fee and any refunds, gross and net can differ by a lot, and it is net that belongs in your books. This guide turns that raw export into a clean, readable sheet with the net computed for every payment, and hands you the format your accounting software imports.

## Before you start — export from Stripe

In the Stripe dashboard, go to **Payments → Export**. Either the default columns or the all-columns version works; the cleaner reads what it needs by name. Save the CSV, and note that everything after this happens in your browser — the file is never uploaded.

## Clean the export

Open the [Stripe CSV Cleaner](/stripe-csv-cleaner) and drop the file in.

1. It recognises a Stripe payments export and reads **Amount**, **Fee**, and **Amount Refunded** by their column names. If the file doesn't look like a Stripe export, it says so and still tries by name — check the totals in that case.
2. The four summary cards show **Gross**, **Stripe fees**, **Refunds**, and **Net** for everything in view. Net is the one that matters: `gross − fee − refunded`.
3. Tick **Only successful payments** to drop failed and incomplete attempts, so the totals reflect real money.
4. The table lists each payment with its own gross, fee, refunded, and net, plus the customer and status.

The decimal separator is detected from the file, so amounts read correctly whether Stripe gave you `1,234.56` or `1.234,56`.

## Take the clean file out

Two export paths, depending on what you need next:

- **Clean CSV** — a tidy, human-readable sheet: Date, Description, Customer Email, Amount, Fee, Refunded, Net, Currency, Status, id. This is the one to keep as a record or hand to an accountant.
- **Export net amounts to** a specific format — Generic CSV, QuickBooks CSV, Xero CSV, QIF, or JSON. This writes one transaction per payment using the **net** amount, so what lands in your accounting software is the money you actually received, not the gross.

Choosing the net figure for the accounting export is deliberate: importing gross would overstate your income and leave the fees unaccounted for.

## Common mistakes to avoid

- **Booking gross as revenue.** The headline "Amount" is before Stripe's cut and before refunds. Use net for your books — the whole point of cleaning the file.
- **Counting failed payments.** A raw export includes failed and incomplete attempts. Tick "Only successful payments" so totals reflect real money.
- **Ignoring refunds.** A refunded charge still shows a gross amount. Net subtracts the refund; gross doesn't.
- **Wrong decimal separator on odd files.** The tool detects it, but if totals look off by orders of magnitude, that is the thing to check.
- **Uploading the export to an online cleaner.** It runs in your browser — your customer data never needs to leave it.

## Frequently asked questions

### How do I see what I actually earned from a Stripe export?

Clean the payments export so it computes net — gross minus Stripe's fee minus refunds — for each payment. [Vexyn's Stripe CSV Cleaner](/stripe-csv-cleaner) does this in your browser and totals gross, fees, refunds and net for you.

### Why is Stripe's "Amount" not what I received?

Because it is the gross charge. Stripe deducts a processing fee, and any refund reduces it further. Net (`gross − fee − refunded`) is what reaches your balance and belongs in your accounts.

### Which export format should I pick for my accountant?

The Clean CSV for a readable record. For importing into software, pick the matching format — QuickBooks CSV, Xero CSV, QIF — which writes the net amount per payment.

### Does it handle refunds and failed payments correctly?

Yes. Net subtracts refunds, and the "Only successful payments" toggle drops failed and incomplete attempts from the totals.

### Is my Stripe data uploaded anywhere?

No. The file is read and processed entirely in your browser. Open the Network panel and you will see nothing is sent out.

## Related guides

- [How to see what Stripe actually paid you](/blog/analyze-stripe-payouts) — the payout side of the same account.
- [How to reconcile Stripe payouts to your bank](/blog/reconcile-stripe-payouts) — tie the net back to what hit your account.

## Glossary

**Gross** — The full charge amount before Stripe's fee or any refund. Stripe's export calls this "Amount".

**Net** — What you actually kept: gross minus the Stripe fee minus refunds. The figure that belongs in your books.

**Stripe fee** — Stripe's per-transaction processing charge, deducted from every successful payment.

**Refunded** — The amount given back to the customer on a charge. It reduces net but not the reported gross.
