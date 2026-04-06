// Tables that participate in sync
export const SYNCED_TABLES = [
  "transactions",
  "categories",
  "wallets",
  "budgets",
  "goals",
  "debts",
];

// Maximum number of changes per sync request
export const MAX_SYNC_BATCH_SIZE = 500;

// Fields the client is never allowed to set/override
export const PROTECTED_FIELDS = ["user_id", "created_at"];

// Default pagination
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;
