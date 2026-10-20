import { useEffect, useState } from "react";
import { staffShiftService } from "../services/staffShiftService";
import { createEditStaffPayload, createStaffPayload, normalizeStaffShift, normalizeStaffShifts } from "../adapters/staffShiftAdapter";

export function useStaffShiftsData() {
  const [staffShifts, setStaffShifts] = useState([]);
  const [isStaffShiftsLoading, setIsStaffShiftsLoading] = useState(true);
  const [staffShiftsError, setStaffShiftsError] = useState("");
  const [staffShiftsActionError, setStaffShiftsActionError] = useState("");

  async function loadStaffShifts() {
    try {
      setIsStaffShiftsLoading(true);
      setStaffShiftsError("");
      setStaffShifts(normalizeStaffShifts(await staffShiftService.getStaffShifts()));
    } catch (error) {
      console.error("Unable to load staff shifts:", error.message);
      setStaffShiftsError("Unable to load staff shifts from Supabase.");
    } finally { setIsStaffShiftsLoading(false); }
  }
  useEffect(() => { loadStaffShifts(); }, []);

  async function addStaff(form, fallbackDate) {
    try {
      setStaffShiftsActionError("");
      const created = normalizeStaffShift(await staffShiftService.createStaff(createStaffPayload(form, fallbackDate)));
      setStaffShifts((items) => [...items, created]);
      return created;
    } catch (error) { setStaffShiftsActionError(error.message || "Unable to add staff."); throw error; }
  }

  async function editStaff(id, form) {
    try {
      setStaffShiftsActionError("");
      const updated = normalizeStaffShift(await staffShiftService.updateStaff(id, createEditStaffPayload(form)));
      setStaffShifts((items) => items.map((item) => item.id === id ? updated : item));
    } catch (error) { setStaffShiftsActionError(error.message || "Unable to update staff."); throw error; }
  }

  async function setDutyStatus(id, status) {
    try {
      setStaffShiftsActionError("");
      const updated = normalizeStaffShift(await staffShiftService.updateDutyStatus(id, status));
      setStaffShifts((items) => items.map((item) => item.id === id ? updated : item));
      return updated;
    } catch (error) {
      setStaffShiftsActionError(error.message || "Unable to update staff duty status.");
      throw error;
    }
  }

  return { staffShifts, isStaffShiftsLoading, staffShiftsError, staffShiftsActionError, addStaff, editStaff, setDutyStatus };
}
