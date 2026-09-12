---
title: "How to convert an OFX, QFX or QBO file to CSV"
description: Your bank or finance app gave you an OFX file and you need a spreadsheet. Here is what is inside an OFX, why the two format generations read differently, and how to get every transaction into rows and columns without changing a single amount.
pubDate: 2026-09-12
category: 'Accounting imports'
tags: ['ofx', 'qbo', 'csv', 'guide']
related: ['/ofx-to-csv', '/csv-to-ofx', '/csv-to-excel']
---

OFX is the format finance software imports, and it does that job well. It is a terrible format for a person. Open one in a text editor and you get a wall of tags with the amounts and payees scattered through it. The moment you want to sort by merchant, total a category, or hand three months to an accountant, you need a spreadsheet.

This guide covers what an OFX file actually contains, the difference between the two generations of the format, what a QFX or QBO adds, and how to convert any of them to CSV in your browser with the amounts untouched.

## Before you start — what is in an OFX file

An OFX file is a statement. Under the header it names an account, gives an opening and closing balance, and lists transactions. Each transaction carries:

- a posted date, written `YYYYMMDD` and sometimes followed by a time and a timezone offset
- a signed amount, negative for money out
- a type such as `DEBIT`, `CREDIT`, `CHECK` or `INT`
- a payee in the `NAME` field, capped at 32 characters by the format, with a longer `MEMO` for the rest
- a `FITID`, the bank's unique id for the transaction, which importers use to avoid double-counting

There are two generations. **OFX 1.x** is SGML: leaf tags are not closed, so a line reads `<TRNAMT>-42.00` and simply stops. Most banks still send this. **OFX 2.x** is XML, with every tag closed. Both hold the same fields in the same places.

A **QFX** file is OFX with an Intuit tag for Quicken. A **QBO** is OFX with two Intuit tags for QuickBooks. If you have either, this guide applies unchanged.

One more thing worth knowing: a single file can hold several statements. A bank that lets you download "all accounts" produces one OFX with a current account, a savings account and a credit card inside it, each with its own transaction list.

## Get the file

Most banks offer OFX under Download, Export or Statements, sometimes labelled "Quicken" or "Money" format. Personal-finance apps export it too. If your bank labels the download QFX or QBO, take it; the converter reads those as well.

If you are handed a file with a `.qbo` extension that QuickBooks refused, converting it to CSV is a good way to see what it actually contains before fighting the import again.

## Convert it in the browser

Open [Vexyn's OFX to CSV converter](/ofx-to-csv) and drop the file in. It reads in your browser, so the statement never leaves your machine, and it handles both format generations through one reader: a leaf is a tag followed by text, whether that text runs to the next tag or to its own closing tag.

The result is one row per transaction with nine columns: date, type, amount, payee, memo, check number, FITID, account and currency. The account and currency columns matter when the file holds more than one statement. Without them, a merged spreadsheet quietly attributes one account's money to another.

Two choices the converter makes on purpose:

- **Amounts are written exactly as the file had them.** The OFX specification asks for a dot decimal, and some European banks send a comma anyway. Rewriting that would be a silent edit to the one number that must not be edited, so it is passed through and flagged on screen instead.
- **Only the day is taken from a timestamp, and it is taken literally.** An OFX date can carry a time and an offset like `[-5:EST]`. Applying the offset would shift transactions across month boundaries on the statements where that hurts most. The day the bank posted is the day it means.

Untick "Hide empty columns" if you want every column even when the file never used it. Then download the CSV, or copy it straight into a sheet.

## Check the result against the statement

Before you rely on the spreadsheet, compare three things with the original:

- **The count.** The converter states how many transactions it read. If the bank's statement says 114 and you got 110, something in the file was not a `STMTTRN` entry, and the on-screen note says what.
- **The signs.** Money out is negative. If a whole column has the wrong sign, the bank wrote its amounts the other way round and you should say so to whoever receives the file.
- **A few dates near a month boundary.** These are where a timezone shift would show. They should match the statement exactly.

If the file contained an investment statement, the converter says so and does not read it. Bank and credit-card transactions are what it handles.

## Common mistakes to avoid

- **Opening the OFX in Excel directly.** Excel will not parse it. You get one column of tags, or an error.
- **Trusting a converter that "fixes" the numbers.** If a tool rounds, reformats or re-signs amounts without telling you, you cannot tell its edits from the bank's data. Prefer one that passes amounts through and names anything unusual.
- **Losing the account column on a multi-account file.** Two accounts merged into one sheet without an account column look like one account with twice the activity.
- **Applying a timezone to the posted date.** A transaction posted on the 31st at 23:00 in one zone is the 1st in another, and now it is in the wrong month.
- **Uploading the file to a web converter.** An OFX lists every merchant you have paid. The conversion is plain text processing and runs fine locally.

## Frequently asked questions

### Does it read QFX and QBO files?

Yes. Both are OFX with an extra tag or two for Intuit software. They open identically.

### Will an OFX 2.x XML file work?

Yes. The reader treats a closing tag as an empty aggregate and skips it, so XML and SGML come through the same path.

### The amounts have a comma decimal. Is that a problem?

Not for the conversion, which passes them through unchanged and tells you. It may be a problem for whatever you import the CSV into next, so decide the decimal separator there.

### My file has a credit card in it. Is that supported?

Yes. Credit-card statements use a different wrapper inside OFX (`CCSTMTRS`) but the transactions are the same shape, and they read through the same path with the card's own account id on each row.

### Can I go the other way, CSV to OFX?

Yes, with the [CSV to OFX converter](/csv-to-ofx). That direction has more to decide, because a CSV does not say which column is the date or which way its dates are written. The guide for it is [How to convert a bank CSV to OFX](/blog/convert-bank-csv-to-ofx).

### Is the file really not uploaded?

No. Open your browser's Network panel while converting: no request carries the file out. The reader is JavaScript running on your device.

## Related guides

- [How to convert a bank CSV to OFX](/blog/convert-bank-csv-to-ofx) — the reverse direction, where the column mapping and date format matter.
- [How to open a CSV in Excel without breaking your numbers](/blog/open-csv-in-excel-without-breaking-numbers) — for the step after this one.
- [CSV vs OFX vs QBO: which format](/blog/csv-vs-ofx-vs-qbo-which-format) — when you get to choose.

## Sources cited in this guide

- [OFX (Open Financial Exchange) specification](https://www.ofx.net/)
- [GnuCash: importing transactions from files](https://www.gnucash.org/docs/v5/C/gnucash-help/trans-import.html)

## Glossary

**OFX** — Open Financial Exchange, the format most finance software imports. A statement with an account, balances and a transaction list, in either an SGML (1.x) or XML (2.x) form.

**QFX / QBO** — OFX with one or two extra tags for Quicken and QuickBooks respectively. Same fields, same transactions; the tags identify the bank to Intuit's software.

**SGML** — The markup OFX 1.x uses. Unlike XML, leaf tags are not closed: `<TRNAMT>-42.00` ends at the line break. Parsers that expect XML fail on it.

**FITID** — The bank's unique id for a transaction. Finance software uses it to recognise a transaction it has already imported, so importing the same file twice does not double the entries.

**STMTTRN** — The element that holds one transaction in an OFX file. Everything between its opening and closing tag belongs to that one transaction.

**Posted date** — The day the bank booked the transaction. In OFX it may carry a time and timezone offset, but the day is what the statement means and what a spreadsheet should show.
