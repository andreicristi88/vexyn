---
title: How to convert a CSV to QBO for QuickBooks (and when it won't import)
description: A QBO file lets you import bank transactions into QuickBooks when your bank only gives you a CSV. Here is how to build one for free without uploading, plus an honest look at why QuickBooks Online sometimes rejects it and what to do then.
pubDate: 2026-09-01
tags: ['qbo', 'quickbooks', 'guide']
related: ['/csv-to-qbo', '/csv-to-ofx']
---

Your bank does not connect directly to QuickBooks, so you export a CSV — but QuickBooks does not import CSV bank feeds the way you want. What it does import is a QBO file (also called Web Connect). This guide shows how to turn a bank CSV into a QBO file for free, in your browser, and — just as important — is honest about the cases where QuickBooks refuses the file and what your options are then.

## Before you start — what a QBO file actually is

A QBO file is an OFX file with two extra tags that identify your bank to Intuit. That is the whole difference. So the same care that goes into any bank-CSV conversion applies here: the dates and amounts have to be parsed correctly, or the import is wrong.

The one thing unique to QBO is the **Intuit Bank ID (INTU.BID)**. QuickBooks uses it to recognise which financial institution the file came from. This is where imports succeed or fail, and it behaves differently across QuickBooks versions:

- **QuickBooks Desktop** generally imports QBO files built this way, often with a generic Bank ID.
- **QuickBooks Online** is stricter. It sometimes validates the Bank ID against a list of known institutions and rejects a file whose ID it does not recognise.

We will build the file first, then deal with the QuickBooks Online case head-on.

## Step 1 — Export your bank transactions as CSV

Download the transactions from your bank as CSV for the date range you need. Open it once in a plain text editor so you know which column is the date, which is the amount (or whether debits and credits are split into two columns), and what the description column is called.

## Step 2 — Convert with the columns and formats set explicitly

Open [Vexyn's CSV to QBO converter](/csv-to-qbo). It runs entirely in your browser — nothing is uploaded — and it maps your columns rather than guessing.

1. Drop the CSV in. It auto-detects the delimiter and takes a first guess at the date, amount, and description columns.
2. Correct the **Date** and **Amount** mappings if needed.
3. Set the **date format** and **decimal separator**. This prevents the classic wrong-date and wrong-amount errors.
4. Enter your account number and, if you have it, your bank's **INTU.BID** (more on that below). Leave it blank to try without one.
5. Check the preview — every parsed date and signed amount is shown, and unreadable rows are listed. Confirm it looks right.
6. Download the .qbo.

## Step 3 — Import into QuickBooks

In QuickBooks Desktop: **File → Utilities → Import → Web Connect Files**, and select your .qbo. In QuickBooks Online: use the file-upload option under the banking / transactions area.

Then verify against the original statement: a few dates match, the signs are right (money out negative), and the transaction count is what you expected.

## When QuickBooks Online rejects the file (read this)

If QuickBooks Online refuses the QBO — an "unsupported file" or a Bank ID error — it is almost always the INTU.BID. You have three honest options:

1. **Enter your bank's real INTU.BID.** Each bank has one, and public OFX bank lists document many of them. Put it in the converter's INTU.BID field and rebuild. This is the most likely fix.
2. **Use QuickBooks Desktop instead.** Desktop is far more forgiving of manually-built QBO files. If you have access to it, import there.
3. **Use the OFX file with different software, or QuickBooks Online's own CSV import.** QuickBooks Online has a built-in CSV import for bank transactions that maps columns in its own interface — for Online users, that path sometimes works better than a hand-built QBO. See the [CSV to OFX guide](/blog/convert-bank-csv-to-ofx) if you are open to other apps.

We are spelling this out because a QBO that silently fails to import is worse than one you know the limits of up front.

## Common mistakes to avoid

- **Uploading your statement to an online QBO converter.** Keep it local — the conversion runs in the browser.
- **Assuming a generic Bank ID always works.** It often works in Desktop and often fails in Online. If Online rejects the file, the Bank ID is the first thing to fix.
- **Trusting a conversion you did not preview.** Wrong dates in QuickBooks are painful to unwind. Confirm the parsed dates and amounts before importing.
- **Re-importing the same file.** QBO uses a transaction ID to dedupe; a good converter generates a stable one so a re-import does not duplicate. Still, import each file once to be safe.

## Frequently asked questions

### What is the difference between QBO and OFX?

A QBO file is an OFX file plus two Intuit tags (including the INTU.BID). QuickBooks reads QBO; most other finance software reads plain OFX. If you do not use QuickBooks, convert to [OFX](/blog/convert-bank-csv-to-ofx) instead.

### Why does QuickBooks Online reject my QBO file?

Usually the Intuit Bank ID. QuickBooks Online validates it more strictly than Desktop and rejects files whose Bank ID it does not recognise. Entering your bank's actual INTU.BID, or importing into Desktop, are the two reliable fixes.

### Where do I find my bank's INTU.BID?

Public OFX bank directories list the Bank IDs (also called FID/BID) for many institutions. Search for your bank's name alongside "OFX" or "INTU.BID". Enter the value in the converter's INTU.BID field.

### Is my bank data uploaded anywhere?

No, not with a browser-based converter. The CSV is read and the QBO is built on your device — open your browser's Network panel and you will see nothing sent.

### Can I import a CSV into QuickBooks directly instead?

QuickBooks Online has a built-in CSV bank-import that maps columns in its own UI, which can be simpler for Online users than a hand-built QBO. QuickBooks Desktop's transaction import is more limited, which is where a QBO file helps.

## Related guides

- [Convert a bank CSV to OFX](/blog/convert-bank-csv-to-ofx) — for Quicken, GnuCash, and non-QuickBooks apps.
- [How to open a CSV in Excel without breaking your numbers](/blog/open-csv-in-excel-without-breaking-numbers) — the same date and number traps in a spreadsheet.

## Sources cited in this guide

- [Intuit QuickBooks: import bank transactions using Web Connect (.qbo)](https://quickbooks.intuit.com/learn-support/en-us/help-article/import-transactions/import-web-connect-qbo-files/L2fWN1Dhy_US_en_US)
- [OFX (Open Financial Exchange) specification](https://www.ofx.net/)

## Glossary

**QBO** — QuickBooks Web Connect file. An OFX file with two Intuit-specific tags, used to import bank transactions into QuickBooks.

**INTU.BID** — Intuit Bank ID. The tag in a QBO file that identifies your financial institution to QuickBooks. The most common reason QuickBooks Online rejects a manually-built QBO.

**Web Connect** — Intuit's name for importing transactions into QuickBooks from a downloaded .qbo file, as opposed to a live bank connection.

**OFX** — Open Financial Exchange. The underlying format QBO is built on, imported by most non-QuickBooks finance software.
