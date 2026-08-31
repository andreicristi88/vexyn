---
title: CSV vs OFX vs QBO — which bank file format do you actually need?
description: Your bank offers CSV, your accounting software wants something else, and the names all blur together. Here is what CSV, OFX, and QBO each are, which software reads which, and how to get from the one you have to the one you need.
pubDate: 2026-09-01
category: 'Accounting imports'
tags: ['ofx', 'qbo', 'guide']
related: ['/csv-to-ofx', '/csv-to-qbo', '/bank-csv-formatter']
---

You want to get your bank transactions into a finance app, and you are staring at a choice of file formats — or worse, your bank only gives you one and your software wants another. CSV, OFX, QBO, sometimes QIF: they all hold transactions, so why does it matter which one you use? This guide explains what each format is, which software reads it, and how to convert between them.

## The short answer

- **CSV** is what your bank gives you. It is universal but unstructured — every bank lays it out differently, and no finance app can rely on its shape.
- **OFX** is what most finance software wants to import. It is structured and widely supported: Quicken, GnuCash, MoneyMoney, and many more.
- **QBO** is OFX with two extra tags, made specifically for QuickBooks.

So the usual job is: you have a CSV, and you need OFX (for most apps) or QBO (for QuickBooks). Everything below is detail on that.

## CSV — universal, but every bank is different

A CSV (Comma-Separated Values) file is plain text: rows of values separated by commas, semicolons, or tabs. Almost every bank can export one, and almost every program can open one. That universality is also its weakness — a CSV carries no agreed structure. One bank writes the date first, another the amount first; one uses a single signed amount, another splits money-in and money-out into separate columns; column names vary endlessly.

Because of that, most accounting software cannot import a raw bank CSV reliably. It does not know which column is the date or how the amounts are signed. That is exactly why the other two formats exist.

Best when: you are working in a spreadsheet, or your software has a guided CSV importer that lets you map columns yourself (QuickBooks Online has one).

## OFX — the standard import format

OFX (Open Financial Exchange) is a structured format built for exchanging financial transactions. Every transaction has a defined place for its posted date, its signed amount, its description, and a unique ID, and the file names the account. Because the structure is fixed, software can import it without guessing.

OFX is the most widely supported import format across personal-finance apps — Quicken, GnuCash, MoneyMoney, Banktivity, and others all read it. If your bank only gives you CSV and you are not on QuickBooks, OFX is almost always the format to convert to.

Best when: you use any finance app other than QuickBooks, or you want the most broadly compatible file.

## QBO — OFX, dressed for QuickBooks

A QBO file (also called Web Connect) is an OFX file with two extra Intuit tags, the most important being the Intuit Bank ID (INTU.BID) that tells QuickBooks which bank the file came from. Functionally it is OFX; the tags are what make QuickBooks accept it as a bank import.

The catch is those tags. QuickBooks Desktop generally accepts QBO files built from a CSV. QuickBooks Online is stricter and sometimes rejects a QBO whose Bank ID it does not recognise. So QBO is the right target for QuickBooks, with the caveat that Online may need your bank's real INTU.BID or may do better with its own built-in CSV importer.

Best when: you use QuickBooks Desktop, or QuickBooks Online and you have your bank's INTU.BID.

## How to get from what you have to what you need

In nearly every case you start with a CSV. Here is the path:

- **CSV → OFX** for Quicken, GnuCash, MoneyMoney, and most other apps. Use the [CSV to OFX converter](/csv-to-ofx).
- **CSV → QBO** for QuickBooks. Use the [CSV to QBO converter](/csv-to-qbo), and see the [QBO guide](/blog/convert-csv-to-qbo-for-quickbooks) for the QuickBooks Online caveats.
- **Messy CSV first?** If your bank's export has separate debit/credit columns or an odd layout, tidy it with the [Bank CSV Formatter](/bank-csv-formatter) before converting.

Whichever you pick, the two things that must be right are the **date format** (day-first versus month-first) and the **amount parsing** (US versus European decimals, and the sign convention). A converter that lets you set those explicitly and preview the result is the difference between a clean import and a silent mess.

## A note on QIF

You may also see QIF (Quicken Interchange Format), an older Quicken format. It still works in some software but is largely superseded by OFX, which is more precise about dates and amounts. If your app accepts both, prefer OFX.

## Frequently asked questions

### If OFX and QBO are almost the same, why not always use QBO?

Because the Intuit tags in a QBO file are meaningful only to QuickBooks, and QuickBooks Online can reject them if the Bank ID is unfamiliar. For any non-QuickBooks app, plain OFX is cleaner and more likely to import without fuss.

### My software imports CSV directly. Do I still need OFX or QBO?

If it has a good guided CSV importer that lets you map columns and set the date and amount formats, you may not. Where CSV import falls short — or is not offered — OFX and QBO give the software a structure it can trust.

### Which is safest for sensitive data?

The format does not affect privacy; the converter does. A browser-based converter processes the file on your device and uploads nothing, which matters more than the format when the file is a bank statement.

## Related guides

- [Convert a bank CSV to OFX](/blog/convert-bank-csv-to-ofx)
- [Convert a CSV to QBO for QuickBooks](/blog/convert-csv-to-qbo-for-quickbooks)

## Glossary

**CSV** — Comma-Separated Values. Plain-text rows of fields. Universal but unstructured; every bank formats it differently.

**OFX** — Open Financial Exchange. A structured transaction format imported by most finance software. Fixed places for date, amount, description, and a unique ID.

**QBO** — QuickBooks Web Connect file. OFX plus Intuit tags (including INTU.BID), made for importing into QuickBooks.

**QIF** — Quicken Interchange Format. An older, less precise format largely replaced by OFX.
