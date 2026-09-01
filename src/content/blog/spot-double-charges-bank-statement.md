---
title: How to spot double charges on your bank statement
description: Double charges hide easily in a long statement. Here is how to find transactions billed twice — same merchant, same amount, days apart — from a CSV export, so you can dispute the real ones, without uploading your data.
pubDate: 2026-09-01
category: 'Understanding your money'
tags: ['bank', 'disputes', 'guide']
related: ['/duplicate-transaction-finder', '/csv-deduplicator']
---

A double charge is easy to create and hard to notice. A payment terminal times out and you tap again; a website shows an error and you resubmit; a subscription bills two cards you forgot were both on file. The bank's statement records both charges without comment, and in a list of two hundred transactions the second one blends right in. This guide shows how to surface likely double charges from your own statement so you can check them and, where they are real, get your money back.

## Before you start — what a double charge looks like in data

From the raw data, a double charge has a recognisable fingerprint: the same merchant, the same exact amount, a short time apart. That is different from two separate legitimate purchases that happen to match, which is why this is a search for suspects rather than a verdict. The data alone cannot always tell a genuine duplicate from a coincidence, and that is fine — your job is to review a short list, not to trust an automatic deletion.

Export a CSV of the period you want to check. A month or two is plenty; double charges are usually caught close to when they happen, before the statement scrolls out of memory.

## Load the statement and scan for repeats

Open the [Duplicate Transaction Finder](/duplicate-transaction-finder). It runs in your browser and uploads nothing.

Drop the CSV in and map the date, amount and description columns, matching the date and decimal format to your file. Then choose a time window — how close together two identical charges must be to count as suspicious. One day catches same-day and next-day double posts; a wider window of a few days catches slower duplicates but flags more coincidences. Three days is a sensible default.

The finder groups transactions that share a merchant and an exact amount within that window, and ranks the most suspicious first: more copies, tighter together, larger amounts. It also totals how much money is tied up in the extra copies, which tells you quickly whether this is worth chasing.

## Review each suspect before you act

Nothing is removed for you, and that is deliberate. Go through the flagged groups and separate the real duplicates from the false ones:

- **Likely real** — a one-off purchase (an electronics order, a hotel, a flight) that appears twice within a day or two. You did not buy two.
- **Likely fine** — small, frequent purchases that legitimately repeat, like a daily commute fare or a coffee at the same price. Two of those in three days is normal life.

The amount is the strongest clue. A repeated £3.20 is probably a genuine repeat purchase; a repeated £340.00 to the same merchant two days apart is worth a hard look.

## Dispute the real ones

For a confirmed duplicate, contact the merchant first. Most will refund a genuine double charge without argument, and that is faster than a bank dispute. If the merchant will not help, or you cannot reach them, raise a dispute or chargeback with your bank and reference the two specific transactions — the date and amount of each. Keep the statement handy as evidence.

One thing worth separating: a duplicate *charge* is not the same as a duplicate *row* in an exported file. If your problem is that a CSV has the same transaction listed twice because of overlapping exports, that is a data cleanup job for the [CSV Deduplicator](/csv-deduplicator), not a charge to dispute with your bank.

## Common mistakes to avoid

- **Treating every match as a double charge.** Identical small purchases repeat legitimately all the time. Judge each group; do not assume.
- **Setting the window too wide.** A 14-day window flags coincidences you will waste time reviewing. Start narrow and widen only if you are hunting a specific slow duplicate.
- **Disputing before checking the merchant.** A quick message to the seller usually resolves a genuine double charge faster than a formal bank dispute.
- **Confusing duplicate rows with double charges.** A CSV that lists one transaction twice is a file problem, not a billing one. Deduplicate the file instead.
- **Uploading the statement to an online checker.** Keep it local; there is no need to send it anywhere.

## Frequently asked questions

### How do I find if I was charged twice?

Export your bank statement as CSV and run it through a duplicate finder that groups same-merchant, same-amount transactions within a few days of each other. [Vexyn's Duplicate Transaction Finder](/duplicate-transaction-finder) does this in your browser and ranks the most suspicious first.

### How is this different from removing duplicate rows in a CSV?

Removing duplicate rows deletes exact copies in a file — a data cleanup. Finding double charges looks for two separate real transactions that indicate you were billed twice, even when the rows differ. Use the [CSV Deduplicator](/csv-deduplicator) for the first and this tool for the second.

### Will it flag my normal repeat purchases?

It can. Two identical low-value purchases a day apart look exactly like a double charge from the data. That is why nothing is auto-removed — you review the short list and decide. Narrowing the day window reduces the noise.

### Is it safe to check my statement this way?

Yes, if the tool runs locally. Vexyn's finder processes the CSV in your browser and sends nothing, which you can confirm in the Network panel. Do not upload a statement to a server just to check for duplicates.

### What should I do when I find a real double charge?

Contact the merchant first — most refund genuine duplicates quickly. If that fails, raise a dispute or chargeback with your bank, citing the date and amount of both transactions.

## Related guides

- [How to find and remove duplicate transactions in a CSV](/blog/remove-duplicate-transactions-csv)
- [How to analyze your spending from a bank statement](/blog/analyze-spending-bank-statement)

## Glossary

**Double charge** — Being billed twice for a single purchase. In statement data it appears as two transactions with the same merchant and amount, a short time apart.

**Time window** — How close together two identical charges must be to be treated as a suspected duplicate. A narrow window (one day) is stricter; a wider one catches more but flags coincidences.

**Chargeback** — A refund forced through your card network when a merchant will not resolve a disputed charge directly. Used as a last resort, with the specific transactions as evidence.

**Duplicate row** — The same transaction listed more than once in an exported file, usually from overlapping export ranges. A file-cleanup issue, distinct from an actual double charge.
