---
title: How to find unused subscriptions in your bank statement
description: Forgotten subscriptions quietly drain hundreds a year. Here is how to find every recurring charge in your bank statement from a CSV export — spot the ones you no longer use, and cancel with confidence — without uploading your data.
pubDate: 2026-09-01
category: 'Understanding your money'
tags: ['subscriptions', 'bank', 'guide']
related: ['/subscription-finder', '/recurring-payment-finder']
---

The average person underestimates what they spend on subscriptions, usually by a lot. It is not carelessness; it is design. A £4.99 here and a $12 there, billed on different days to different cards, never lands as one number you can see. This guide shows how to pull every recurring charge out of your own bank statement, judge which ones still earn their place, and cancel the rest — all from a CSV export you never upload anywhere.

## Before you start — why a few months matters

A subscription is only visible as a pattern once it has repeated. One month of statement shows a charge; three or four months show that the same charge lands every cycle, for the same amount. So the first thing to do is export a decent range from your bank.

Most banks let you download a statement as CSV from the transactions screen — look for "Export", "Download" or a spreadsheet icon, and pick a date range of at least three months. If you have several cards or accounts, export each; subscriptions love to hide on the card you check least.

## Load the statement and let it find the patterns

Open the [Subscription Finder](/subscription-finder). It runs in your browser and uploads nothing.

Drop the CSV in and map three columns: the date, the amount, and the description (the payee text). If your bank uses separate debit and credit columns instead of one signed amount, switch to that mode. Set the date format and decimal separator to match your file so nothing is misread. The tool then groups charges by merchant, checks that the amount is stable and the interval is regular, and lists what recurs — with an estimated monthly and yearly cost for each.

Anything billed twice at a steady interval shows up, tagged by cadence (monthly, yearly, and so on). Two-charge matches are marked "unconfirmed" because two payments could be a coincidence rather than a real subscription.

## Read the list with a critical eye

The list is a prompt, not a verdict. Go down it and put each entry in one of three buckets:

- **Keep** — you use it and it is worth the price.
- **Downgrade** — you use it, but a cheaper tier would do.
- **Cancel** — you forgot it existed, or stopped using it months ago.

Pay special attention to annual charges. A yearly subscription is the easiest to forget because it only appears once in twelve statements, and it is often the largest single line. The estimated yearly total next to each entry is the number that tends to change minds.

## Cancel from the source, not the statement

Cancelling is the one step the data cannot do for you. Cancel through the service's own account page or app, not by asking your bank to block the payment — a blocked payment can leave the subscription "active but unpaid", which sometimes means a debt or a reactivation later. Once you have cancelled, note the date, and check next month's statement to confirm the charge actually stopped.

If a charge is recurring but you cannot tell what it is, the merchant label is your clue. Search the exact description text — the cryptic string like `SP* SOMECODE` or `PADDLE.NET` usually resolves to a real company, because these are payment processors billing on behalf of the actual service.

## Common mistakes to avoid

- **Exporting one month.** A monthly subscription needs several cycles to show as a pattern. One statement shows charges, not recurrence.
- **Trusting the merchant name blindly.** Payment processors (Paddle, Stripe, PayPal) appear in place of the real service. The finder groups what it can, but confirm the company before cancelling.
- **Cancelling by blocking the card.** This can leave the account unpaid rather than closed. Cancel at the source.
- **Ignoring "unconfirmed" matches.** Two charges is weak evidence, but it can still be a brand-new subscription worth checking. Look, do not dismiss.
- **Forgetting the annual ones.** They dwarf the monthly charges and hide in plain sight because they appear so rarely.

## Frequently asked questions

### How do I find subscriptions I forgot about?

Export three or more months of your bank statement as CSV and run it through a recurring-charge finder like [Vexyn's Subscription Finder](/subscription-finder). It groups charges that repeat at a steady amount and interval, which is exactly the signature of a subscription you stopped noticing.

### Is it safe to upload my bank statement to a tool like this?

You should not need to. Vexyn's finder runs entirely in your browser and sends nothing — open DevTools, go to the Network tab, and you will see your file is never sent out. Avoid any online tool that uploads a statement to a server.

### Why does a subscription I have not show up?

Usually the price changed (a rise breaks the stable-amount match), the merchant is written differently each month, or your date range is too short. Detection stays conservative to avoid false alarms, so a moving target can slip through.

### What is the difference between this and a recurring payment finder?

The Subscription Finder focuses on money going out. The [Recurring Payment Finder](/recurring-payment-finder) detects repeating payments in both directions, so it also surfaces recurring income like salary, or a standing order you receive.

### Will cancelling a subscription hurt my credit?

Cancelling a normal subscription (streaming, software, a gym) has no effect on your credit. A loan or credit agreement is different — do not confuse a recurring loan repayment with a subscription.

## Related guides

- [How to analyze your spending from a bank statement](/blog/analyze-spending-bank-statement)
- [How to spot double charges on your bank statement](/blog/spot-double-charges-bank-statement)

## Glossary

**Recurring charge** — A payment that repeats at a regular interval for a stable amount. The defining trait a finder looks for: same payee, same figure, consistent gap between charges.

**Cadence** — How often a charge repeats: weekly, every two weeks, monthly, quarterly or yearly. The interval between one charge and the next.

**Payment processor** — A company that bills your card on behalf of the real service (Paddle, Stripe, PayPal). Its name often appears on the statement instead of the service you actually signed up for.

**Signed amount** — A single number whose sign gives direction: negative for money out, positive for money in. Some banks use this instead of separate debit and credit columns.
