---
title: "How to convert a CSV to JSON in your browser"
description: A CSV is rows and columns; JSON is what code, APIs and config files expect. Here is how to turn a CSV into clean JSON — an array of objects or an array of arrays, pretty-printed or minified — entirely in your browser, without uploading the file.
pubDate: 2026-09-02
category: 'Cleaning & organizing'
tags: ['csv', 'json', 'guide']
related: ['/csv-to-json', '/csv-cleaner']
---

A CSV is the format spreadsheets and banks hand you; JSON is the format code, APIs, and config files ask for. Somewhere between "I have this spreadsheet" and "the script needs an array of objects" sits a conversion that is trivial in principle and quietly annoying in practice — the delimiter is a semicolon, a value has a comma inside quotes, or the header row is missing. This guide converts a CSV to JSON cleanly, in your browser, and explains the one choice that actually matters: the shape.

## Before you start — pick the shape you need

There are two common JSON shapes, and which one you want depends entirely on what will read it:

- **Array of objects** — each row becomes an object keyed by the header names: `[{ "name": "ACME", "amount": "120" }, …]`. This is what most code and APIs expect, because you address fields by name.
- **Array of arrays** — the raw grid: `[["name","amount"],["ACME","120"], …]`. Compact, order-preserving, and handy when you are feeding a table or a charting library that wants rows, not named fields.

If you are unsure, choose the array of objects. It is the one nearly every consumer of JSON assumes.

## Convert the file

Open [Vexyn's CSV to JSON converter](/csv-to-json). It runs entirely in your browser — the file is read locally and never uploaded.

1. Drop the CSV (or TSV) in, or paste the text directly if you only have a snippet. The delimiter — comma, semicolon, or tab — is detected automatically.
2. If your file has no header row, untick **First row is a header**. With it off, the object keys become `field1`, `field2`, and so on, and no data row is consumed as names.
3. Choose the **Shape**: array of objects or array of arrays.
4. Decide on **Pretty-print**. On, the JSON is indented and readable; off, it is minified to one line — smaller, and what you usually want to paste into code or send over the wire.
5. Check the preview, then **Download JSON** or **Copy** it straight to your clipboard.

## A note on types: everything stays a string

This is the detail that trips people up. A CSV has no types — every cell is text — so a faithful conversion keeps every value as a **string**, including numbers: `"amount": "120"`, not `"amount": 120`. That is deliberate. It means an account number like `00123` keeps its leading zeros and a long id is never mangled into scientific notation. If your code needs real numbers or booleans, cast them on the receiving side (`Number(row.amount)`), where you know which fields are actually numeric — that is safer than a converter guessing and corrupting an ID that merely looked like a number.

## Clean the CSV first if it is messy

Conversion is faithful, not corrective: junk headers, blank rows, and stray whitespace all pass straight through into the JSON. If your export is messy, run it through the [CSV Cleaner](/csv-cleaner) first — trim whitespace, drop blank rows, fix duplicate headers — then convert the tidy result. Duplicate header names matter especially here: two columns both called "Amount" cannot both become the `amount` key, so the cleaner's "make headers unique" step keeps your objects intact.

## Common mistakes to avoid

- **Expecting numbers, getting strings.** A CSV has no types. Cast on the receiving side rather than blaming the converter — it is protecting your leading zeros and long IDs.
- **Leaving the header toggle wrong.** If the first row is actually data, turning the header option off keeps it; leaving it on silently promotes your first record to field names.
- **Duplicate headers collapsing.** Two identically-named columns can't both be one object key. Make headers unique first with the [CSV Cleaner](/csv-cleaner).
- **Uploading the file to an online converter.** For a job this simple there is no reason to send your data to a server. Keep it local.

## Frequently asked questions

### How do I convert a CSV to JSON without uploading it?

Use a browser-based converter like [Vexyn's CSV to JSON](/csv-to-json): it reads the file with JavaScript on your device and never sends it anywhere. You can confirm nothing is uploaded in your browser's Network panel.

### Should I use an array of objects or an array of arrays?

Array of objects for most code and APIs — you get named fields like `row.amount`. Array of arrays when you want the compact raw grid, for example to feed a table or chart that expects rows.

### Why are my numbers wrapped in quotes?

Because a CSV has no type information, a faithful conversion keeps every value as a string. This preserves leading zeros and long IDs. Convert the fields you know are numeric to numbers in your own code.

### Can I convert a TSV or a semicolon-separated file?

Yes. The delimiter is detected automatically, so tab-separated and semicolon-separated (common in European exports) files convert the same way.

### What about nested JSON?

A CSV is flat — rows and columns — so the direct output is flat too. Nesting requires knowing how columns relate, which is a transformation, not a conversion; do that in code after converting to the array of objects.

## Related guides

- [How to clean a messy bank CSV export](/blog/clean-messy-bank-csv) — tidy the file before converting.
- [How to open a CSV in Excel without breaking your numbers](/blog/open-csv-in-excel-without-breaking-numbers) — the same type traps, in a spreadsheet.

## Glossary

**JSON** — JavaScript Object Notation. A text format for structured data that code and APIs read natively, made of objects (`{ }`) and arrays (`[ ]`).

**Array of objects** — A JSON list where each entry is a `{key: value}` object. The common shape for row data, addressed by field name.

**Pretty-print** — Formatting JSON with indentation and line breaks so a human can read it. The opposite is minified — one compact line, smaller to store or send.

**Delimiter** — The character separating fields in a CSV: comma, semicolon, or tab. Detected automatically during conversion.
