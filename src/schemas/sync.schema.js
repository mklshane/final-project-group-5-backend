import { z } from "zod";
import { SYNCED_TABLES, MAX_SYNC_BATCH_SIZE } from "../utils/constants.js";

const syncChangeSchema = z.object({
  table: z.enum(SYNCED_TABLES),
  action: z.enum(["create", "update", "delete"]),
  record: z.record(z.string(), z.unknown()).optional(),
  record_id: z.string().uuid().optional(),
  version: z.number().int().min(1),
}).refine(
  (data) => {
    // create and update need a record, delete needs record_id
    if (data.action === "delete") return !!data.record_id;
    return !!data.record;
  },
  { message: "create/update require 'record', delete requires 'record_id'" }
);

export const syncRequestSchema = z.object({
  last_sync_at: z.string().datetime().nullable(),
  changes: z
    .array(syncChangeSchema)
    .max(MAX_SYNC_BATCH_SIZE, `Maximum ${MAX_SYNC_BATCH_SIZE} changes per sync`),
});
