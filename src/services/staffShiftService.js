import { supabase } from "../lib/supabase";

function normalize(row) {
  return { ...row, staffName: row.staff?.full_name || row.staffName || row.staff_name,
    role: row.staff?.role_label || row.role,
    staffId: row.staff_id,
    shiftDate: row.shift_date,
    scheduledTimeIn: row.scheduled_time_in,
    scheduledTimeOut: row.scheduled_time_out,
    actualTimeIn: row.actual_time_in,
    actualTimeOut: row.actual_time_out,
    totalHours: row.actual_time_in && row.actual_time_out ? (new Date(row.actual_time_out) - new Date(row.actual_time_in)) / 3600000 : 0 };
}

export const staffShiftService = {
  async getStaffShifts() {
    const { data, error } = await supabase.from("staff_shifts").select("*, staff:staff!staff_shifts_staff_id_fkey(full_name,role_label)").order("shift_date", { ascending: false });
    if (error) throw error; return data.map(normalize);
  },
  async createStaff(payload) {
    const { data, error } = await supabase.functions.invoke("create-staff-account", {
      body: {
        staffName: payload.staffName,
        email: payload.email,
        password: payload.password,
        roleLabel: payload.role,
        allowedRoutes: payload.allowedRoutes,
        shiftDate: payload.shiftDate,
      },
    });
    if (error) throw error;
    if (!data?.staff) throw new Error(data?.error || "Unable to create the staff account.");
    return normalize(data.staff);
  },
  async updateStaff(shiftId, payload) {
    const { data: shift, error: readError } = await supabase.from("staff_shifts").select("staff_id").eq("id", shiftId).single();
    if (readError) throw readError;
    const { error: staffError } = await supabase.from("staff").update({ full_name: payload.staffName, role_label: payload.role }).eq("id", shift.staff_id);
    if (staffError) throw staffError;
    const { data, error } = await supabase.from("staff_shifts").update({ scheduled_time_in: payload.scheduledTimeIn || null,
      scheduled_time_out: payload.scheduledTimeOut || null, notes: payload.notes }).eq("id", shiftId).select("*, staff:staff!staff_shifts_staff_id_fkey(full_name,role_label)").single();
    if (error) throw error; return normalize(data);
  },
  async updateDutyStatus(shiftId, status) {
    const { data, error } = await supabase
      .from("staff_shifts")
      .update({ status })
      .eq("id", shiftId)
      .select("*, staff:staff!staff_shifts_staff_id_fkey(full_name,role_label)")
      .single();
    if (error) throw error;
    return normalize(data);
  },
};
