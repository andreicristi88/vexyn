---
title: "How to convert an MT940 bank statement to CSV"
description: MT940 is what a European bank sends when a business asks for its statement for the accounting software. Here is how the format is built, why the details field differs by bank, and how to turn it into a spreadsheet with payee, purpose and references split out.
pubDate: 2026-09-12
category: 'Accounting imports'
tags: ['mt940', 'swift', 'bank', 'guide']
related: ['/mt940-to-csv', '/camt053-to-csv', '/csv-to-excel']
---

Ask a European business bank for a statement "for the accounting software" and you will often get a file ending in `.sta` or `.940`. Open it and it looks like this:

```
:61:2609020902D42,00NTRFNONREF//1234567890
:86:020?00SEPA-LASTSCHRIFT?20EREF+ABC123?32ALBERT HEIJN
```

That is one transaction. It is readable once you know the layout, and unreadable in bulk. This guide explains how an MT940 statement is put together, why the details line differs from bank to bank, and how to convert one to CSV in your browser with the payee, purpose and references in their own columns.

## Before you start — how an MT940 is put together

MT940 is the SWIFT customer statement message. A file is a sequence of tagged fields, each starting with `:NN:` at the beginning of a line and possibly continuing on the lines below. The fields that carry money:

- `:25:` the account
- `:60F:` the opening balance, and the only place the currency is stated
- `:61:` one transaction: value date, entry date, debit or credit, amount, a type code, references
- `:86:` the details for the `:61:` just above it
- `:62F:` the closing balance

The `:61:` line has a fixed grammar. `2609020902D42,00NTRF` reads as value date 2 September 2026, entry date 09-02, **D**ebit, 42,00, type **TRF** (transfer). A reversal is marked `RC` or `RD` instead of `C` or `D`, and it flips the direction.

Two things about MT940 that trip people up:

**Amounts use a comma decimal.** Not sometimes — always, by definition of the format. `1234,56` is one thousand two hundred thirty-four and fifty-six. A converter that turns this into `1234.56` is reading the specification, not guessing at a locale.

**The `:86:` field is whatever the bank decided.** The standard leaves its contents to the bank, and three shapes are common. German banks pack it into numbered subfields (`?00` transaction text, `?20` to `?29` purpose, `?32` and `?33` the payee). Dutch banks such as ABN AMRO, ING and Rabobank write `/TAG/value/` pairs: `/NAME/J DE VRIES/REMI/Terugbetaling/EREF/…`. Others write a sentence. A converter has to recognise all three or it hands you one long text column.

## Get the statement from your bank

In business online banking, look under Statements, Downloads or Export for a format labelled MT940, SWIFT, `.sta` or "for accounting". Choose the date range. Some banks produce one message per day, others one per statement period; the converter joins the pages of a multi-page statement either way.

If the bank offers both MT940 and CAMT.053, either works. CAMT is the newer XML form and carries the counterparty's IBAN more reliably; the [CAMT.053 guide](/blog/convert-camt053-to-csv) covers it.

## Convert it in the browser

Open [Vexyn's MT940 to CSV converter](/mt940-to-csv) and drop the file in. It reads in your browser; the statement is not uploaded. A file wrapped in SWIFT envelope blocks (`{1:…}{2:…}{4:…}`) is unwrapped first.

Each transaction becomes one row with:

- **Date** and **Entry date** from `:61:`, with the entry date left blank when the bank omits it
- **Amount**, signed, dot decimal, and **Currency** from the opening balance
- **Payee** and **Purpose**, split out of `:86:` where the bank's form allows it
- **Type**, the bank's `?00` text such as `SEPA-LASTSCHRIFT`, and **Code**, the three letters from `:61:`
- **Reference** and **Bank reference**, the two halves of the reference field
- **End-to-end ref**, the SEPA `EREF+` when present
- **Details**, the whole `:86:` text as the bank wrote it
- **Account**

The Details column is there because no split is complete. When a bank writes something the converter cannot name, nothing is lost: the full text sits in that column, next to whatever was split out of it.

Columns no row uses are hidden by default. Untick "Hide empty columns" to see them all.

## Check the result against the balances

An MT940 states its own opening and closing balance, and that gives you a check the file itself provides. The converter shows both. Add up the Amount column, add it to the opening balance, and you should land on the closing balance. If you do not, the difference tells you what was skipped, and the on-screen notes say why.

Then look at three rows by hand:

- **A row with a reversal**, if there is one. `RC` and `RD` flip the sign; a reversed credit is money going out.
- **A row from a German-style `:86:`.** The payee should be the name, not a numbered subfield.
- **A row from a Dutch-style `:86:`.** `/NAME/` should be in the Payee column and `/REMI/` in Purpose.

One detail worth knowing about payees in the German form: `?32` and `?33` are one name cut at 27 characters, sometimes in the middle of a word, so they are joined with nothing between them. That is what the reference parser in GnuCash does too, and it is correct for a hard cut. If a bank wrote a space at the end of `?32`, the space is kept and the join is still right.

## Common mistakes to avoid

- **Treating the comma as a thousands separator.** `1.234,56` in a European file is `1234.56`. Read the other way round it is a hundred times too small or large.
- **Stripping trailing spaces.** An MT940 field wraps as a hard cut at 65 characters. When the 65th character is a space, stripping it welds the two words on either side of the break. "J DE " + "VRIES" becomes "J DEVRIES".
- **Assuming the `:86:` has one shape.** A converter written for German subfields hands back an empty payee on a Dutch file. Check a row from your bank before trusting the whole sheet.
- **Missing the currency.** It is stated once, in `:60F:`. A file without an opening balance has no currency, and the converter says so instead of guessing one.
- **Losing pages of a long statement.** Multi-page statements link with `:62M:` and `:60M:`. If your sheet stops at the first page, the pages were not joined.

## Frequently asked questions

### Which banks send MT940?

Most European business banks on request, and many by default for business accounts. It is common in Germany, the Netherlands, Belgium, Austria, Switzerland and the Nordics, and offered by larger banks elsewhere.

### What is the difference between MT940 and CAMT.053?

Both are bank statements. MT940 is the older SWIFT text format; CAMT.053 is the ISO 20022 XML replacement, which carries more structure, in particular the counterparty's IBAN. Banks are moving to CAMT but many still produce MT940 on request. The [CAMT.053 to CSV converter](/camt053-to-csv) reads the other one.

### My payee column is empty for most rows. Why?

Your bank writes `:86:` as free text without the German subfields or the Dutch tags, so there is nothing to name as the payee. The full text is in the Details and Purpose columns. That is the bank's choice of format, not a conversion error.

### Are the amounts changed?

Only the comma becomes a dot, which is the format's own definition, and debits are signed negative. Nothing else about the figure is touched.

### Does it read MT942?

MT942 is the intraday version with the same `:61:` and `:86:` layout, so a plain MT942 reads. It has no closing balance, so the balance check above does not apply.

### Is the file uploaded?

No. Open the browser's Network panel while converting and you will see no request carry the file. The reader is JavaScript on your device.

## Related guides

- [How to convert a CAMT.053 statement to CSV](/blog/convert-camt053-to-csv) — the XML successor, if your bank offers it.
- [How to convert an OFX, QFX or QBO file to CSV](/blog/convert-ofx-to-csv) — for statements from personal-finance software.
- [How to open a CSV in Excel without breaking your numbers](/blog/open-csv-in-excel-without-breaking-numbers) — the next step.

## Sources cited in this guide

- [SWIFT, publisher of the MT message standards](https://www.swift.com/) — the MT940 field layout is defined in the SWIFT User Handbook, available to SWIFT users.
- [GnuCash: importing transactions from files](https://www.gnucash.org/docs/v5/C/gnucash-help/trans-import.html) — GnuCash reads MT940 through the same aqbanking importer this converter was checked against.

## Glossary

**MT940** — The SWIFT "customer statement message". A text format in which each field starts with a numbered tag such as `:61:`, used by banks to deliver account statements to business customers.

**:61: line** — The transaction line. It holds the value date, an optional entry date, the debit/credit mark, the amount with a comma decimal, a three-letter type code, and up to two references separated by `//`.

**:86: field** — The details for the transaction above it. Its contents are bank-specific: numbered subfields in Germany, `/TAG/` pairs in the Netherlands, free text elsewhere.

**Value date and entry date** — The value date is when the money counts for interest; the entry date is when the bank booked it. They are usually the same day and occasionally differ by one.

**SEPA references** — Tags such as `EREF+` (end-to-end reference), `MREF+` (mandate) and `SVWZ+` (the actual purpose) that SEPA transactions carry inside the purpose text. A good converter pulls them into their own columns.

**Reversal** — A transaction marked `RC` or `RD` in `:61:`, undoing an earlier one. It flips direction: a reversed credit is money leaving the account.
