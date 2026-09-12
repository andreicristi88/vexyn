---
title: "How to convert a CAMT.053 statement to CSV"
description: CAMT.053 is the ISO 20022 bank statement, XML with the useful fields buried five levels down. Here is what an entry contains, who the counterparty is on each row, what happens to batch bookings, and how to flatten the file into a spreadsheet in your browser.
pubDate: 2026-09-12
category: 'Accounting imports'
tags: ['camt', 'iso20022', 'bank', 'guide']
related: ['/camt053-to-csv', '/mt940-to-csv', '/csv-to-excel']
---

CAMT.053 is what most European banks now produce when a business asks for a statement for its accounting software. It is XML, it is thorough, and it puts the fields a bookkeeper actually needs five or six levels deep. The counterparty is under `RltdPties`, the purpose under `RmtInf`, the references under `Refs`, and the bank's own description off to the side in `AddtlNtryInf`.

This guide explains what one entry in a CAMT.053 contains, how to tell who the counterparty is, what a batch booking looks like and why it matters, and how to flatten the whole file into a spreadsheet in your browser.

## Before you start — what one entry contains

A CAMT.053 file is a `Document` holding a `BkToCstmrStmt` (bank-to-customer statement), which holds one or more `Stmt` elements, one per account. Each statement names its account and currency, states opening and closing balances, and lists entries. One `Ntry` is one booking:

- `Amt` with a `Ccy` attribute, and `CdtDbtInd` saying `DBIT` or `CRDT`
- `BookgDt` and `ValDt`, the booking and value dates
- `AcctSvcrRef`, the bank's own reference for the booking
- `BkTxCd`, a coded description of the kind of transaction, such as `PMNT/IDDT/ESDD` for a SEPA direct debit
- `NtryDtls`, holding one or more `TxDtls` with the counterparty, the remittance information and the SEPA references

The amount on an entry is unsigned. Direction comes from `CdtDbtInd`, and a `RvslInd` of `true` means the booking reverses an earlier one, which flips the direction again.

**Who is the counterparty.** `RltdPties` names both a debtor and a creditor. For money going out, the other side is the creditor; for money coming in, it is the debtor. A converter that always shows the creditor labels your own account as the counterparty on every incoming payment.

**Batch bookings.** One entry can hold several `TxDtls`, each with its own `TxAmt`: a salary run, a bulk supplier payment, a collection of direct debits. The entry's amount is the total. The bookkeeper has to match the individual transactions, not the total, so a converter should expand these to one row each.

Two related formats share the entry layout. **camt.052** is the intraday account report and **camt.054** is the debit/credit notification. Both read the same way.

## Get the statement from your bank

In business online banking, look for a download labelled CAMT.053, ISO 20022, XML statement, or "for accounting". Pick the period. If the bank also offers MT940, either will do; CAMT carries the counterparty's IBAN more reliably, which helps when you go on to match payments to invoices.

The file may come zipped, and it may come with every tag prefixed, as in `<ns2:Ntry>`. Both are normal.

## Convert it in the browser

Open [Vexyn's CAMT.053 to CSV converter](/camt053-to-csv) and drop the XML in. It reads in your browser with a small XML reader of its own, and it strips namespace prefixes, so a file full of `ns2:` reads the same as one without.

Every transaction becomes a row with fourteen columns: date, value date, signed amount, currency, counterparty, counterparty IBAN, purpose, bank reference, end-to-end reference, mandate, transaction code, status, the bank's description, and account. Columns no row uses are hidden until you untick "Hide empty columns".

What the converter decides for you, and why:

- **The counterparty is the creditor for `DBIT` and the debtor for `CRDT`.** That is the other side of the money in both cases.
- **A reversal flips the sign.** A reversed debit shows as money coming back.
- **A batch entry becomes one row per `TxDtls`, each with its own amount**, and the converter says how many entries it expanded. An entry with a single transaction stays one row.
- **Amounts are taken as written and only signed.** ISO 20022 amounts are already plain decimals, so there is nothing to reformat.
- **`NOTPROVIDED` in a reference is an empty cell.** It is the SEPA placeholder for "no reference", and a placeholder in a reference column is worse than a blank.

Download the CSV, or copy it into a sheet.

## Check the result against the balances

Like MT940, a CAMT.053 states its own opening and closing balance (`OPBD` and `CLBD`), and the converter shows both. The signed amounts should sum to the difference. When a batch was expanded, the individual rows sum to the entry's total, so the check still holds.

Then look at:

- **One incoming and one outgoing row.** The counterparty should be the other party each time, never your own account name.
- **A batch, if the file has one.** The rows share a bank reference and date but carry their own amounts and end-to-end references.
- **A reversal, if there is one.** The sign should be the opposite of the original booking.

If the file contains investment activity or something outside the bank-statement layout, the converter says what it did not read rather than handing back a partial table.

## Common mistakes to avoid

- **Reading the entry amount as signed.** It is not. Direction is in `CdtDbtInd`, and a `RvslInd` of `true` inverts it. Missing either produces a sheet with the wrong signs.
- **Always taking the creditor as the counterparty.** Half the rows will name your own company. The counterparty depends on direction.
- **Keeping a batch as one row.** The total is not what the bookkeeper matches. A salary run of thirty people is thirty transactions.
- **Parsing with a tool that cannot handle namespace prefixes.** Some readers, including the one in older desktop finance software, fail to find the `Document` element when every tag carries `ns2:`. The prefix is cosmetic.
- **Uploading the file.** A CAMT.053 lists every counterparty, their IBANs and what each payment was for. The conversion runs fine locally.

## Frequently asked questions

### Is CAMT.053 the same as MT940?

They are two formats for the same thing, a bank statement. MT940 is the older SWIFT text form; CAMT.053 is the ISO 20022 XML form that banks are moving to. CAMT carries more structure, in particular the counterparty's IBAN. The [MT940 to CSV converter](/mt940-to-csv) reads the other one.

### Does it read camt.052 and camt.054?

Yes. They share the entry layout and read through the same path. A camt.052 has no closing balance, so that check does not apply.

### My file has ns2: in front of every tag. Will it read?

Yes. The prefixes are stripped before reading, and the file reads identically with or without them.

### How do I know which rows came from a batch?

They share the entry's date and bank reference, and the converter tells you how many entries it expanded. Each row keeps its own amount, counterparty and end-to-end reference.

### The counterparty column shows my own company on some rows. Why?

The file may name the parties the other way round from the usual convention, which some banks do for internal transfers. Check `CdtDbtInd` and `RltdPties` on one such entry in the raw XML; the Details you need are all there.

### Is the file uploaded?

No. Open the browser's Network panel while converting and you will see no request carry the file. The reader is JavaScript on your device.

## Related guides

- [How to convert an MT940 bank statement to CSV](/blog/convert-mt940-to-csv) — the older text format, if that is what your bank sends.
- [How to convert an OFX, QFX or QBO file to CSV](/blog/convert-ofx-to-csv) — for statements from personal-finance software.
- [How to reconcile invoices against payments](/blog/reconcile-invoices-against-payments) — the usual next job once the statement is a spreadsheet.

## Sources cited in this guide

- [ISO 20022 message definitions](https://www.iso20022.org/iso-20022-message-definitions) — the camt.053 (BankToCustomerStatement), camt.052 and camt.054 messages are defined in the Payments catalogue.
- [GnuCash: importing transactions from files](https://www.gnucash.org/docs/v5/C/gnucash-help/trans-import.html) — GnuCash reads camt through the aqbanking importer this converter was checked against.

## Glossary

**CAMT.053** — The ISO 20022 bank-to-customer statement message: an XML file with an account, balances and a list of entries, the successor to MT940 at most European banks.

**Ntry** — One booking in the statement. It carries the amount, direction, dates and the bank's reference, and holds one or more transaction details.

**TxDtls** — The details of one transaction inside an entry: counterparty, remittance information, SEPA references. A batch entry holds several.

**CdtDbtInd** — The direction indicator, `DBIT` for money out and `CRDT` for money in. The amount itself is unsigned.

**RvslInd** — The reversal indicator. When `true`, the booking undoes an earlier one and its direction is the opposite of what `CdtDbtInd` alone would suggest.

**End-to-end reference** — The reference the payer put on a SEPA payment, carried unchanged to the receiver. `NOTPROVIDED` means there was none.

**Namespace prefix** — The `ns2:` in `<ns2:Ntry>`. An XML convention that identifies the schema; it does not change what the element is.
