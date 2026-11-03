import { supabase } from "../lib/supabase";

function unavailableError(error) {
  if (error?.code === "PGRST202" || error?.code === "42883") {
    return new Error("Online-ordering availability is not configured on this server.");
  }
  return new Error(error?.message || "Unable to check online-ordering availability.");
}

function isStatus(data) {
  return data
    && typeof data.manual_enabled === "boolean"
    && typeof data.local_online === "boolean"
    && typeof data.effective_enabled === "boolean";
}

export const onlineOrderingService = {
  async getCustomerStatus() {
    if (!supabase) throw unavailableError();
    const { data, error } = await supabase.rpc("get_online_ordering_status");
    if (error) throw unavailableError(error);
    if (!isStatus(data)) throw unavailableError();
    return data;
  },

  async getLocalStatus() {
    if (!supabase) throw unavailableError();
    const { data, error } = await supabase.rpc("get_local_online_ordering_status");
    if (error) throw unavailableError(error);
    if (!isStatus(data)) throw unavailableError();
    return data;
  },

  async setLocalEnabled(enabled) {
    if (!supabase) throw unavailableError();
    const { data, error } = await supabase.rpc("set_local_online_ordering_enabled", {
      p_enabled: Boolean(enabled),
    });
    if (error) throw unavailableError(error);
    if (typeof data !== "boolean") throw unavailableError();
    return data;
  },
};
