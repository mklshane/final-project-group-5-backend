import { supabase } from "../config/supabase.js";
import { NotFoundError } from "../utils/errors.js";

export class AdminService {
  async getUsers(page = 1, pageSize = 50, search) {
    let query = supabase
      .from("profiles")
      .select("id, full_name, email, currency, role, onboarding_done, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to fetch users: ${error.message}`);

    return {
      users: data || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  }

  async getUserById(userId) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !profile) throw new NotFoundError("User");

    // Get transaction summary
    const { data: txSummary } = await supabase
      .from("transactions")
      .select("type, amount")
      .eq("user_id", userId)
      .is("deleted_at", null);

    const totalExpenses = (txSummary || [])
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalIncome = (txSummary || [])
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return {
      ...profile,
      stats: {
        total_transactions: txSummary?.length || 0,
        total_expenses: totalExpenses,
        total_income: totalIncome,
        net_flow: totalIncome - totalExpenses,
      },
    };
  }

  async updateUserStatus(userId, role) {
    const { data, error } = await supabase
      .from("profiles")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update user: ${error.message}`);
    return data;
  }

  async deleteUser(userId) {
    // Soft approach: mark all their data as deleted
    const tables = ["transactions", "categories", "budgets", "goals", "debts"];
    const now = new Date().toISOString();

    for (const table of tables) {
      await supabase
        .from(table)
        .update({ deleted_at: now })
        .eq("user_id", userId)
        .is("deleted_at", null);
    }

    // Mark profile role as suspended
    await supabase
      .from("profiles")
      .update({ role: "suspended", updated_at: now })
      .eq("id", userId);

    return { success: true };
  }

  async getAnalytics() {
    // Active users (synced in last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { count: totalUsers } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    const { count: activeUsers } = await supabase
      .from("sync_log")
      .select("user_id", { count: "exact", head: true })
      .gt("created_at", sevenDaysAgo);

    // Transactions today
    const today = new Date().toISOString().split("T")[0];
    const { count: todayTransactions } = await supabase
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("date", today)
      .is("deleted_at", null);

    // Total platform spend
    const { data: spendData } = await supabase
      .from("transactions")
      .select("amount")
      .eq("type", "expense")
      .is("deleted_at", null);

    const totalSpend = (spendData || []).reduce((sum, t) => sum + Number(t.amount), 0);

    return {
      total_users: totalUsers || 0,
      active_users_7d: activeUsers || 0,
      transactions_today: todayTransactions || 0,
      total_platform_spend: totalSpend,
    };
  }
}

export const adminService = new AdminService();
