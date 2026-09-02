/**
 * The tool registry. The whole site is data: every tool is one object here,
 * grouped into three zones. Available tools link to their page; the rest render
 * as "Soon" cards so the roadmap is visible and each becomes an indexable page
 * as it ships. Adding a tool = adding an object here.
 *
 * Almost all of these are faces of a small number of shared engines (see
 * src/lib/csv.ts for the first one). The names are separate because people
 * search for the specific job — "csv to qbo", "stripe reconciliation",
 * "subscription finder" — not for the engine underneath.
 */

export type ZoneId = 'data' | 'business' | 'personal';

export type Zone = {
  id: ZoneId;
  name: string;
  tagline: string;
  icon: string;
  order: number;
};

export const ZONES: Zone[] = [
  {
    id: 'data',
    name: 'Financial Data',
    tagline: 'Clean, convert and reshape CSV and bank exports.',
    icon: '📊',
    order: 1,
  },
  {
    id: 'business',
    name: 'Business Finance',
    tagline: 'Stripe, reconciliation, revenue and SaaS metrics.',
    icon: '💼',
    order: 2,
  },
  {
    id: 'personal',
    name: 'Personal Finance',
    tagline: 'Understand your bank statements and spending.',
    icon: '🏦',
    order: 3,
  },
];

export type Tool = {
  slug: string;
  zone: ZoneId;
  name: string;
  description: string;
  icon: string;
  available: boolean;
};

export const TOOLS: Tool[] = [
  // --- Financial Data (the shared CSV engine — built first, lowest risk) ---
  { slug: 'csv-cleaner', zone: 'data', name: 'CSV Cleaner', description: 'Trim whitespace, remove empty rows, duplicates and messy headers.', icon: '🧹', available: true },
  { slug: 'csv-to-excel', zone: 'data', name: 'CSV to Excel', description: 'Convert CSV to a real .xlsx file, with values kept as text.', icon: '📗', available: true },
  { slug: 'csv-deduplicator', zone: 'data', name: 'CSV Deduplicator', description: 'Find and remove duplicate rows, exact or by key column.', icon: '🔁', available: true },
  { slug: 'csv-merger', zone: 'data', name: 'CSV Merger', description: 'Combine several CSVs into one, aligning columns by name.', icon: '🔗', available: true },
  { slug: 'csv-to-json', zone: 'data', name: 'CSV to JSON', description: 'Turn a CSV into clean JSON records.', icon: '{ }', available: true },
  { slug: 'csv-to-qbo', zone: 'data', name: 'CSV to QBO', description: 'Convert a bank CSV to a QuickBooks .qbo file for import.', icon: '📥', available: true },
  { slug: 'csv-to-ofx', zone: 'data', name: 'CSV to OFX', description: 'Convert a bank CSV to OFX for import into finance software.', icon: '📤', available: true },
  { slug: 'bank-csv-formatter', zone: 'data', name: 'Bank CSV Formatter', description: 'Reshape any bank export into a clean, standard layout.', icon: '🏛', available: true },

  // --- Business Finance ---
  { slug: 'stripe-csv-cleaner', zone: 'business', name: 'Stripe CSV Cleaner', description: 'Turn a raw Stripe export into a clean, readable sheet.', icon: '💳', available: true },
  { slug: 'stripe-payout-analyzer', zone: 'business', name: 'Stripe Payout Analyzer', description: 'See exactly what each payout contains, net of fees.', icon: '💸', available: false },
  { slug: 'stripe-reconciliation', zone: 'business', name: 'Stripe Reconciliation', description: 'Match charges, refunds and fees to payouts.', icon: '⚖️', available: false },
  { slug: 'invoice-reconciliation', zone: 'business', name: 'Invoice Reconciliation', description: 'Match invoices against payments received.', icon: '🧾', available: true },
  { slug: 'bank-reconciliation', zone: 'business', name: 'Bank Reconciliation', description: 'Reconcile your ledger against the bank statement.', icon: '🏦', available: true },
  { slug: 'transaction-matcher', zone: 'business', name: 'Transaction Matcher', description: 'Match two lists of transactions and surface the gaps.', icon: '🔍', available: true },
  { slug: 'revenue-analyzer', zone: 'business', name: 'Revenue Analyzer', description: 'Break revenue down by period, product and customer.', icon: '📈', available: true },
  { slug: 'saas-metrics', zone: 'business', name: 'SaaS Metrics', description: 'MRR, churn and growth from a subscriptions export.', icon: '📊', available: true },

  // --- Personal Finance ---
  { slug: 'bank-statement-analyzer', zone: 'personal', name: 'Bank Statement Analyzer', description: 'Understand where your money goes from a bank export.', icon: '🔎', available: true },
  { slug: 'subscription-finder', zone: 'personal', name: 'Subscription Finder', description: 'Find every recurring charge hiding in your statement.', icon: '🔔', available: true },
  { slug: 'recurring-payment-finder', zone: 'personal', name: 'Recurring Payment Finder', description: 'Detect all repeating payments and their cadence.', icon: '🔄', available: true },
  { slug: 'spending-analyzer', zone: 'personal', name: 'Spending Analyzer', description: 'Categorize and chart your spending over time.', icon: '💰', available: true },
  { slug: 'transaction-categorizer', zone: 'personal', name: 'Transaction Categorizer', description: 'Auto-assign categories to raw transactions.', icon: '🏷', available: true },
  { slug: 'duplicate-transaction-finder', zone: 'personal', name: 'Duplicate Transaction Finder', description: 'Spot double charges and duplicate entries.', icon: '⚠️', available: true },
  { slug: 'merchant-analyzer', zone: 'personal', name: 'Merchant Analyzer', description: 'See who you pay most, grouped by merchant.', icon: '🏪', available: true },
  { slug: 'cash-flow-analyzer', zone: 'personal', name: 'Cash Flow Analyzer', description: 'Track money in vs money out, month by month.', icon: '🌊', available: true },
  { slug: 'net-worth-analyzer', zone: 'personal', name: 'Net Worth Analyzer', description: 'Combine accounts into one net-worth view with a breakdown.', icon: '📐', available: true },
];

export function toolsInZone(zone: ZoneId): Tool[] {
  return TOOLS.filter((t) => t.zone === zone);
}

export const AVAILABLE_TOOLS = TOOLS.filter((t) => t.available);
