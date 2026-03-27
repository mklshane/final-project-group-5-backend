import { supabase } from "../config/supabase.js";
import { PROTECTED_FIELDS, SYNCED_TABLES } from "../utils/constants.js";
import { logger } from "../utils/logger.js";

export class SyncService {
  /**
   * Process a full sync cycle:
   * 1. Apply client changes (with conflict detection)
   * 2. Gather server changes since last sync
   * 3. Log the sync operation
   */
  async processSync(userId, request) {
    const startTime = Date.now();
    const syncedAt = new Date().toISOString();
    const acknowledged = [];
    const conflicts = [];

    // 1. Process incoming changes from client
    for (const change of request.changes) {
      try {
        const result = await this.applyChange(userId, change);
        if (result.status === "acknowledged") {
          acknowledged.push(result.recordId);
        } else if (result.status === "conflict") {
          conflicts.push(result.conflict);
        }
      } catch (err) {
        logger.error("Failed to apply sync change", {
          userId,
          table: change.table,
          action: change.action,
          error: err.message,
        });
        // Continue processing other changes — don't fail the whole batch
      }
    }

    // 2. Pull server changes since last sync
    const serverChanges = await this.getServerChanges(userId, request.last_sync_at);

    // 3. Log this sync operation
    const durationMs = Date.now() - startTime;
    await this.logSync(userId, request.changes.length, serverChanges.length, conflicts.length, durationMs);

    logger.info("Sync completed", {
      userId,
      pushed: request.changes.length,
      acknowledged: acknowledged.length,
      conflicts: conflicts.length,
      pulled: serverChanges.length,
      durationMs,
    });

    return {
      synced_at: syncedAt,
      acknowledged,
      conflicts,
      server_changes: serverChanges,
    };
  }

  /**
   * Apply a single change from the client.
   * Returns acknowledged if successful, conflict if version mismatch.
   */
  async applyChange(userId, change) {
    const { table, action, record, record_id, version } = change;
    const recordId = record_id || record?.id;

    if (!recordId) {
      throw new Error("Missing record ID");
    }

    // Sanitize: strip protected fields and inject user_id
    const sanitized = this.sanitizeRecord(record || {}, userId);

    if (action === "create") {
      return this.handleCreate(userId, table, recordId, sanitized);
    } else if (action === "update") {
      return this.handleUpdate(userId, table, recordId, version, sanitized);
    } else {
      return this.handleDelete(userId, table, recordId, version);
    }
  }

  async handleCreate(userId, table, recordId, record) {
    // Check if record already exists (duplicate sync)
    const { data: existing } = await supabase
      .from(table)
      .select("id")
      .eq("id", recordId)
      .eq("user_id", userId)
      .single();

    if (existing) {
      // Already exists — treat as acknowledged (idempotent)
      return { status: "acknowledged", recordId };
    }

    const { error } = await supabase.from(table).insert({
      ...record,
      id: recordId,
      user_id: userId,
    });

    if (error) throw new Error(`Insert failed on ${table}: ${error.message}`);
    return { status: "acknowledged", recordId };
  }

  async handleUpdate(userId, table, recordId, clientVersion, record) {
    // Fetch current server version
    const { data: existing, error: fetchError } = await supabase
      .from(table)
      .select("*")
      .eq("id", recordId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !existing) {
      // Record doesn't exist on server — create it instead
      const { error } = await supabase.from(table).insert({
        ...record,
        id: recordId,
        user_id: userId,
        version: clientVersion,
      });
      if (error) throw new Error(`Upsert failed on ${table}: ${error.message}`);
      return { status: "acknowledged", recordId };
    }

    const serverVersion = existing.version;

    // Conflict check: client version must be >= server version
    if (clientVersion < serverVersion) {
      return {
        status: "conflict",
        recordId,
        conflict: {
          table,
          record_id: recordId,
          client_version: clientVersion,
          server_version: serverVersion,
          server_record: existing,
        },
      };
    }

    // Apply update
    const { error } = await supabase
      .from(table)
      .update({
        ...record,
        version: clientVersion,
        updated_at: new Date().toISOString(),
      })
      .eq("id", recordId)
      .eq("user_id", userId);

    if (error) throw new Error(`Update failed on ${table}: ${error.message}`);
    return { status: "acknowledged", recordId };
  }

  async handleDelete(userId, table, recordId, clientVersion) {
    // Soft delete: set deleted_at, bump version
    const { data: existing } = await supabase
      .from(table)
      .select("version")
      .eq("id", recordId)
      .eq("user_id", userId)
      .single();

    if (!existing) {
      // Already gone — acknowledge
      return { status: "acknowledged", recordId };
    }

    const serverVersion = existing.version;

    if (clientVersion < serverVersion) {
      // Fetch full record for conflict response
      const { data: full } = await supabase
        .from(table)
        .select("*")
        .eq("id", recordId)
        .single();

      return {
        status: "conflict",
        recordId,
        conflict: {
          table,
          record_id: recordId,
          client_version: clientVersion,
          server_version: serverVersion,
          server_record: full || {},
        },
      };
    }

    const { error } = await supabase
      .from(table)
      .update({
        deleted_at: new Date().toISOString(),
        version: clientVersion,
        updated_at: new Date().toISOString(),
      })
      .eq("id", recordId)
      .eq("user_id", userId);

    if (error) throw new Error(`Delete failed on ${table}: ${error.message}`);
    return { status: "acknowledged", recordId };
  }

  /**
   * Get all changes on the server since the client's last sync.
   * Includes creates, updates, and soft deletes.
   */
  async getServerChanges(userId, lastSyncAt) {
    const changes = [];
    const since = lastSyncAt || "1970-01-01T00:00:00Z";

    for (const table of SYNCED_TABLES) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("user_id", userId)
        .gt("updated_at", since)
        .order("updated_at", { ascending: true })
        .limit(1000);

      if (error) {
        logger.error(`Failed to pull changes from ${table}`, { error: error.message });
        continue;
      }

      if (!data) continue;

      for (const record of data) {
        const action = record.deleted_at
          ? "delete"
          : new Date(record.created_at).toISOString() > since
            ? "create"
            : "update";

        changes.push({
          table,
          action,
          record,
          version: record.version,
        });
      }
    }

    return changes;
  }

  /**
   * Strip protected fields and ensure user_id is not spoofed
   */
  sanitizeRecord(record, userId) {
    const sanitized = { ...record };
    for (const field of PROTECTED_FIELDS) {
      delete sanitized[field];
    }
    // user_id is always set server-side
    sanitized.user_id = userId;
    return sanitized;
  }

  /**
   * Log sync operation for analytics
   */
  async logSync(userId, pushed, pulled, conflicts, durationMs) {
    try {
      await supabase.from("sync_log").insert({
        user_id: userId,
        changes_pushed: pushed,
        changes_pulled: pulled,
        conflicts,
        duration_ms: durationMs,
      });
    } catch (err) {
      // Non-critical — don't fail the sync if logging fails
      logger.warn("Failed to log sync", { error: err.message });
    }
  }
}

export const syncService = new SyncService();
