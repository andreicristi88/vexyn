---
title: How to open a CSV in Excel without breaking your numbers
description: Excel silently mangles CSV data — leading zeros vanish, long numbers turn into 1.23E+15, and codes become dates. Here is why it happens and three reliable ways to open a CSV with every value intact.
pubDate: 2026-09-01
category: 'Spreadsheets & Excel'
tags: ['csv', 'excel', 'guide']
related: ['/csv-to-excel']
---

You export a CSV from your bank or your shop, double-click it, and Excel opens it instantly. Then you look closer: the account number `00123` is now `123`. A 16-digit card number reads `1.23457E+15`. A product code like `3-5` became a date. None of this was in the original file — Excel changed it on open, and if you save now, the damage is permanent.

This is the single most common way spreadsheets corrupt data, and it happens because opening a CSV and importing a CSV are two different things. This guide explains why, and gives you three reliable ways to get every value into Excel exactly as it was written.

## Before you start — what Excel is actually doing

A CSV file is plain text. It has no idea what a "number" or a "date" is — it just stores characters. When you double-click a CSV, Excel reads that text and **guesses a type for every cell**. Those guesses are where the damage comes from:

- A value made only of digits becomes a number. Numbers have no leading zeros, so `00123` becomes `123`.
- A long run of digits becomes a number too big to show, so Excel switches to scientific notation: `1234567890123456` becomes `1.23457E+15`. The original digits are gone.
- Something that looks date-shaped, like `3-5` or `1/2`, becomes a date.
- A leading `+` or `=` can be read as a formula.

The fix in every case is the same idea: **tell Excel to treat the columns as text instead of letting it guess.** The three methods below all do that, in different ways.

## Method A — Convert to .xlsx with text preserved (easiest, no upload)

The cleanest fix is to convert the CSV to a real Excel file where every value is already marked as text, so Excel never gets the chance to guess. [Vexyn's CSV to Excel converter](/csv-to-excel) does exactly this, entirely in your browser — the file is never uploaded.

1. Open the [CSV to Excel](/csv-to-excel) tool.
2. Drop your CSV in. It detects the delimiter automatically (comma, semicolon, tab).
3. Download the .xlsx. Every cell is written as text, so `00123` stays `00123` and long numbers stay whole.
4. Open the .xlsx in Excel — no import dialog, no guessing, nothing to configure.

Best for: anyone who wants the file to just open correctly, especially for account numbers, card numbers, IDs, and postal codes. Because it runs locally, it is also the right choice for bank statements and payment reports you would not upload to a random converter.

## Method B — Import with the Text Import Wizard (built into Excel)

If you would rather stay inside Excel, do not double-click the file. **Import** it and set the column types by hand.

1. Open Excel to a blank workbook first.
2. Go to the **Data** tab → **Get Data** → **From File** → **From Text/CSV** (older Excel: **From Text**).
3. Pick your CSV. A preview window opens.
4. This is the important part: find the option to set column data types, and set the columns that hold codes, IDs, or long numbers to **Text**. In the classic wizard this is the third step, where you click each column and choose "Text". In the modern Power Query preview, use **Transform Data**, select the column, and set its type to Text.
5. Load the data.

Best for: people who do this often and want it inside Excel without extra tools. The catch is that you have to remember to set every sensitive column to Text every single time, or the corruption sneaks back.

## Method C — Force text with a helper column or a leading apostrophe

If the file is small and you only need to protect a value or two, there are two quick manual tricks:

- **Leading apostrophe:** typing `'00123` in a cell forces Excel to keep it as text and show `00123`. The apostrophe does not print. Fine for a handful of cells, tedious for a whole column.
- **Format before paste:** select the target column, set its format to **Text** (Home → Number format → Text), then paste the values in. Because the column is already text, Excel does not reinterpret them.

Best for: fixing a small number of cells, or rescuing one column in a file you have already opened.

## How to check it worked

Before you trust the file, spot-check the columns that matter:

- **Leading zeros:** an account or postal code that started with `0` still shows the `0`.
- **Long numbers:** a card or IBAN number shows all its digits, not `1.2E+15`. Click the cell — the formula bar should show the full value, not a rounded one.
- **Codes and ranges:** a value like `3-5` or `1/2` is still text, not a date.

If any of these are wrong, the file was opened with Excel guessing types. Go back to Method A or B — you cannot fix scientific-notation damage after the fact, because the original digits are already lost.

## Common mistakes to avoid

- **Double-clicking the CSV "just to look".** The moment it opens, the guessing has happened. If you then save, the corruption is baked in. Always import, or convert first.
- **Fixing scientific notation by widening the column or changing the format.** Once a 16-digit number became `1.23457E+15`, Excel already threw away the exact digits. Formatting cannot bring them back — you have to re-open the original CSV as text.
- **Assuming the CSV itself is broken.** Open the CSV in a plain text editor (Notepad, TextEdit). The values are almost always fine there — the problem is only how Excel read them.
- **Uploading a sensitive file to a "CSV to Excel" website.** For a public dataset that is fine. For a bank export or a customer list, that hands your data to a third party for a job your own browser can do locally.

## Frequently asked questions

### Why does Excel remove leading zeros from CSV files?

Because it reads a digits-only value as a number, and numbers do not store leading zeros. `00123` and `123` are the same number, so the zeros are dropped. The only way to keep them is to make Excel treat the column as text, which is what all three methods above do.

### How do I stop a long number becoming 1.23E+15?

Get the value into a text-typed cell or column before Excel interprets it — convert the CSV to .xlsx with values kept as text, or import and set that column to Text. Once the number has been shown in scientific notation and saved, the exact digits are gone, so do this from the original CSV.

### Does saving the CSV back keep my changes?

Only within the CSV's limits — a .csv is still plain text, so any Excel formatting you added is lost on save, and if Excel already corrupted values on open, saving writes the corrupted version. To keep formatting and typed columns, save as .xlsx.

### Why did my code turn into a date?

Excel recognises date-shaped text like `3-5`, `1/2`, or `Mar-5` and converts it to a date automatically. Setting the column to Text before the value is read prevents it.

### Is there a way that does not touch my data at all?

Converting to .xlsx with every cell marked as text is the closest — Excel opens the result without guessing anything, so no value is reinterpreted. [Vexyn's CSV to Excel](/csv-to-excel) does this in your browser without uploading the file.

## Related guides

- [CSV Cleaner](/csv-cleaner) — tidy up whitespace, empty rows and duplicate headers before converting.
- [CSV to Excel](/csv-to-excel) — the converter used in Method A, values kept as text.

## Sources cited in this guide

- [Microsoft: Import or export text (.txt or .csv) files](https://support.microsoft.com/en-us/office/import-or-export-text-txt-or-csv-files-5250ac4c-663c-47ce-937b-339e391393ba)
- [Microsoft: Keep leading zeros and large numbers](https://support.microsoft.com/en-us/office/keep-leading-zeros-and-large-numbers-1bf7b935-36e1-4985-842f-5dfa51f85fe7)

## Glossary

**CSV** — Comma-Separated Values. A plain-text file where each line is a row and fields are separated by a delimiter (comma, semicolon, or tab). It stores no type information — every value is just text.

**Scientific notation** — A way of writing very large or very small numbers, like `1.23E+15` for `1,230,000,000,000,000`. Excel switches to it when a number is too long to display, which loses the exact digits.

**Leading zero** — A zero at the start of a value, as in `00123`. Meaningful in codes, account numbers, and postal codes, but dropped when the value is treated as a number.

**Text type** — A cell format that tells Excel to store the value exactly as written and never reinterpret it. The fix for every kind of CSV corruption described here.
