---
title: "How to convert a bank statement PDF to CSV"
description: Your bank gives you a PDF and every tool wants a CSV. Here is how to rebuild the transaction table out of a statement PDF — keeping debit and credit columns apart — in your browser, without uploading the one document that describes your whole financial life.
pubDate: 2026-09-04
category: 'Cleaning & organizing'
tags: ['pdf', 'bank', 'guide']
related: ['/bank-statement-pdf-to-csv', '/bank-statement-analyzer', '/csv-to-qbo']
---

Banks hand out PDFs. Spreadsheets, accounting software and every analysis tool want a CSV. That gap is why "convert bank statement PDF to Excel" is one of the most searched jobs in personal finance — and why so many services offer to do it for you, in exchange for uploading the single document that lists every merchant you have paid, every salary you have received, and what you had left afterwards. This guide does the conversion without that trade, and explains what to check before you trust the result.

## Before you start — is your PDF text or a picture?

There are two kinds of PDF, and only one can be converted reliably:

- **Text-based** — the file your bank generated and you downloaded. The text is real text; you can select it in a PDF reader and copy it. This is what almost every online-banking statement is.
- **Scanned** — a photo or a scan of a printed page. It contains an image; there is no text to extract, only pixels that look like text. Converting one needs OCR, which is a different, much less accurate job.

The quick test takes five seconds: open the PDF and try to select a line of text with your mouse. If it highlights, you are fine. If nothing selects, it is a scan.

## Convert the statement

Open [Vexyn's Bank Statement PDF to CSV](/bank-statement-pdf-to-csv). It runs in your browser and never uploads the file.

1. Drop the PDF in. It reads every page and rebuilds the transaction table.
2. Read the summary line: pages, transactions found, wrapped lines joined, and lines skipped. Skipped lines are page furniture — the bank's header, the column titles, "Page 2 of 5" — and a handful of them is normal.
3. **Name the money columns.** The tool finds how many columns of numbers there are and proposes a default (one column is an Amount; three are usually Debit, Credit, Balance). Correct it if your statement is laid out differently. This step is yours on purpose — a converter that guesses which column is the running balance is exactly how a statement gets quietly corrupted.
4. Check the preview against the PDF, then **Download CSV**.

## How it rebuilds a table that was never a table

Worth understanding, because it explains both why it works and where it can fail. A PDF does not store rows and columns; it stores text at coordinates that *look* like rows and columns once printed. So the tool:

- groups text into lines by vertical position;
- treats a line that **starts with a date** as a transaction — this is the anchor that keeps headers and footers out without needing a template for your specific bank;
- recovers the money columns by clustering the **right-hand edge** of every amount, because amounts are right-aligned. That is the property that keeps a blank Debit or Credit genuinely blank instead of shifting the row sideways;
- joins descriptions that wrapped onto a second line back onto their transaction.

Where it struggles: layouts where the date is not the first thing on the line, and statements whose columns sit very close together.

## Always check before you trust it

Every bank formats statements differently, so treat the first conversion of a new statement as something to verify, not something to accept:

- Compare the **first and last transaction** against the PDF.
- Check any row where the **description wrapped** onto two lines.
- Confirm the **transaction count** matches what the statement says, if it prints a count.
- If a row looks wrong, open **"Every line the PDF gave up"** under the table. It shows exactly what was extracted, so you can tell whether the text came out badly or the table was rebuilt badly.

This habit costs a minute and catches essentially everything.

## What to do with the CSV

Once you have it, the rest of the site takes over: [analyze the spending](/blog/analyze-spending-bank-statement), [find recurring payments](/blog/find-recurring-payments-bank-statement), [spot double charges](/blog/spot-double-charges-bank-statement), or convert it for accounting software with [CSV to QBO](/blog/convert-csv-to-qbo-for-quickbooks) or [CSV to OFX](/blog/convert-bank-csv-to-ofx). If the columns need reshaping first, the [Bank CSV Formatter](/blog/standardize-bank-csv-format) puts them into one standard layout.

## Common mistakes to avoid

- **Uploading the statement to an online converter.** This is the whole point. A bank statement is the most complete record of your finances that exists in one file; a conversion that runs on your own device removes the question of what happens to it afterwards.
- **Assuming a scan will work.** No text, no conversion. Ask your bank for the original PDF or a CSV export instead.
- **Accepting the column labels without looking.** The default is a guess based on how many columns there are. On a statement with an unusual layout it will be wrong, and a balance booked as an amount is a bad day later.
- **Not spot-checking wrapped rows.** Multi-line descriptions are where reconstruction is hardest, so they are where errors show up first.
- **Converting a password-protected PDF.** Save an unprotected copy from your PDF reader first — the password cannot be handled in the browser.

## Frequently asked questions

### How do I convert a bank statement PDF to CSV or Excel for free?

Use a converter that rebuilds the transaction table from the PDF's text. [Vexyn's Bank Statement PDF to CSV](/bank-statement-pdf-to-csv) does it in your browser with no account and no upload; from the CSV, [CSV to Excel](/csv-to-excel) gives you a real .xlsx if you need one.

### Is it safe to upload my bank statement to a PDF converter?

It is the one file worth being strict about, since it lists every transaction and balance you have. A browser-based converter avoids the question entirely — there is no upload endpoint, and you can confirm nothing is sent in your browser's Network panel.

### Why does my scanned statement not work?

A scan contains an image, not text, so there is nothing to extract without OCR. Download the original PDF from your online banking instead of scanning a printed copy.

### Why do I have to label the columns myself?

Because the tool can see that there are three columns of numbers, but not which one is the running balance — that is written in a header it does not read the way you do. Guessing would risk putting a balance where the amount belongs, so it proposes a default and lets you correct it.

### The transactions came out wrong. What do I do?

Open the extracted-lines panel under the table. If the lines look right but the rows are wrong, it is the table reconstruction; if the lines themselves are garbled, the PDF uses an unusual font encoding. Either way you can see which, instead of guessing.

## Related guides

- [How to standardize any bank CSV into one consistent layout](/blog/standardize-bank-csv-format) — reshape the converted file.
- [How to analyze your spending from a bank statement](/blog/analyze-spending-bank-statement) — what to do with it next.

## Glossary

**Text-based PDF** — A PDF whose text is stored as characters, so it can be selected, copied and extracted. What your bank generates.

**Scanned PDF** — A PDF containing an image of a page. Extracting text from one requires OCR.

**Right-aligned** — Numbers lined up by their last digit, as money always is on a statement. Clustering those right edges is how the columns are recovered.

**Page furniture** — The parts of a statement that are not transactions: bank headers, column titles, totals, page numbers. Skipped during conversion.
