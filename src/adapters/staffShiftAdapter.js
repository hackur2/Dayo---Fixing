export function normalizeStaffShift(shift) {
  return {
    id: shift.id,
    staffName:
      shift.staffName ?? shift.staff_name ?? shift.name ?? "Unnamed Staff",
    role: shift.role ?? "Staff",
    shiftDate:
      shift.shiftDate ?? shift.shift_date ?? shift.date ?? "",
    scheduledTimeIn:
      shift.scheduledTimeIn ?? shift.scheduled_time_in ?? "",
    scheduledTimeOut:
      shift.scheduledTimeOut ?? shift.scheduled_time_out ?? "",
    actualTimeIn:
      shift.actualTimeIn ?? shift.actual_time_in ?? "",
    actualTimeOut:
      shift.actualTimeOut ?? shift.actual_time_out ?? "",
    status: shift.status ?? "On Duty",
    totalHours: Number(
      shift.totalHours ?? shift.total_hours ?? shift.hours ?? 0
    ),
    notes: shift.notes ?? "No notes added.",
  };
}

export function normalizeStaffShifts(data) {
  const rawShifts = Array.isArray(data)
    ? data
    : data?.staffShifts ?? data?.staff_shifts ?? data?.items ?? data?.data ?? [];

  if (!Array.isArray(rawShifts)) {
    return [];
  }

  return rawShifts.map(normalizeStaffShift);
}

export function createStaffPayload(addStaffForm, fallbackDate) {
  return {
    staffName: addStaffForm.staffName.trim(),
    role: addStaffForm.role,
    shiftDate: fallbackDate || addStaffForm.shiftDate || new Date().toISOString().slice(0, 10),
  };
}

export function createEditStaffPayload(editStaffForm) {
  return {
    staffName: editStaffForm.staffName.trim(),
    role: editStaffForm.role,
    scheduledTimeIn: editStaffForm.scheduledTimeIn,
    scheduledTimeOut: editStaffForm.scheduledTimeOut,
    notes: editStaffForm.notes.trim() || "No notes added.",
  };
}
