import { syncService } from "../services/sync.service.js";
import { supabase } from "../config/supabase.js";

export async function handleSync(req, res) {
  const userId = req.user.id;
  const result = await syncService.processSync(userId, req.body);
  res.json(result);
}

export async function handleSyncStatus(req, res) {
  const userId = req.user.id;

  const tables = ["transactions", "categories", "budgets", "goals", "debts"];
  let latestUpdate = null;

  for (const table of tables) {
    const { data } = await supabase
      .from(table)
      .select("updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (data?.updated_at) {
      if (!latestUpdate || data.updated_at > latestUpdate) {
        latestUpdate = data.updated_at;
      }
    }
  }

  res.json({
    user_id: userId,
    last_server_update: latestUpdate,
  });
}
