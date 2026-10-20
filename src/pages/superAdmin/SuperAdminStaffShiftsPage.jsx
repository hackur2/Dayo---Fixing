import AdminPageActions from "../../components/layout/AdminPageActions";
import { useEffect, useMemo, useState } from "react";

import AddStaffModal from "../../components/superAdmin/staff/AddStaffModal";
import EditStaffModal from "../../components/superAdmin/staff/EditStaffModal";
import StaffDirectoryModal from "../../components/superAdmin/staff/StaffDirectoryModal";
import StaffFilters from "../../components/superAdmin/staff/StaffFilters";
import StaffShiftTable from "../../components/superAdmin/staff/StaffShiftTable";
import StaffSummaryCards from "../../components/superAdmin/staff/StaffSummaryCards";
import { sortRecords } from "../../utils/sortUtils";
import { useStaffShiftsData } from "../../hooks/useStaffShiftsData";

import "../../styles/superAdminStaffShifts.css";

const STAFF_POSITION_OPTIONS = [
  "Cashier",
  "Kitchen Staff",
  "Barista",
  "Cook",
  "Service Crew",
  "Helper",
];

const STAFF_POSITION_FILTER_OPTIONS = ["All", ...STAFF_POSITION_OPTIONS];

const STAFF_STATUS_OPTIONS = ["All", "On Duty", "Completed", "Late", "Absent"];

const DEFAULT_STAFF_FORM = {
  staffName: "",
  position: "Cashier",
};

const DEFAULT_EDIT_FORM = {
  staffName: "",
  position: "Cashier",
  scheduledTimeIn: "",
  scheduledTimeOut: "",
  notes: "",
};

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function createStaffId() {
  return Date.now();
}

function getStaffPosition(staff) {
  return staff.position || staff.role || "Staff";
}

function SuperAdminStaffShiftsPage() {
  const staffShiftData = useStaffShiftsData();

  const staffShifts = staffShiftData.staffShifts || [];
  const isStaffShiftsLoading =
    staffShiftData.isStaffShiftsLoading ||
    staffShiftData.isStaffShiftLoading ||
    false;

  const staffShiftsError =
    staffShiftData.staffShiftsError || staffShiftData.staffShiftError || "";

  const staffShiftActionError =
    staffShiftData.staffShiftActionError ||
    staffShiftData.staffShiftsActionError ||
    "";

  const createStaff =
    staffShiftData.createStaff ||
    staffShiftData.addStaff ||
    staffShiftData.createStaffShift ||
    staffShiftData.addStaffShift;

  const updateStaff =
    staffShiftData.updateStaff ||
    staffShiftData.editStaff ||
    staffShiftData.updateStaffShift ||
    staffShiftData.editStaffShift;
  const setDutyStatus = staffShiftData.setDutyStatus;
  const [updatingDutyId, setUpdatingDutyId] = useState(null);

  const [localStaffShifts, setLocalStaffShifts] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortDirection, setSortDirection] = useState("desc");

  function handleSortColumn(column) {
    setSortDirection((currentDirection) =>
      sortBy === column
        ? currentDirection === "asc" ? "desc" : "asc"
        : column === "date" ? "desc" : "asc"
    );
    setSortBy(column);
  }

  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);
  const [isEditStaffModalOpen, setIsEditStaffModalOpen] = useState(false);
  const [isStaffDirectoryOpen, setIsStaffDirectoryOpen] = useState(false);

  const [selectedStaff, setSelectedStaff] = useState(null);
  const [addStaffForm, setAddStaffForm] = useState(DEFAULT_STAFF_FORM);
  const [editStaffForm, setEditStaffForm] = useState(DEFAULT_EDIT_FORM);

  useEffect(() => {
    setLocalStaffShifts(staffShifts);
  }, [staffShifts]);

  const summary = useMemo(() => {
    const totalStaff = new Set(
      localStaffShifts.map(
        (staff) => `${staff.staffName}-${getStaffPosition(staff)}`
      )
    ).size;

    return {
      totalStaff,
      onDutyCount: localStaffShifts.filter(
        (staff) => staff.status === "On Duty"
      ).length,
      lateCount: localStaffShifts.filter((staff) => staff.status === "Late")
        .length,
      absentCount: localStaffShifts.filter((staff) => staff.status === "Absent")
        .length,
    };
  }, [localStaffShifts]);

  const filteredStaffShifts = useMemo(() => {
    const searchValue = searchTerm.trim().toLowerCase();

    const matches = localStaffShifts.filter((staff) => {
      const position = getStaffPosition(staff);

      const matchesSearch =
        searchValue === "" ||
        staff.staffName.toLowerCase().includes(searchValue) ||
        position.toLowerCase().includes(searchValue);

      const matchesPosition =
        positionFilter === "All" || position === positionFilter;

      const matchesStatus =
        statusFilter === "All" || staff.status === statusFilter;

      const matchesDate = dateFilter === "" || staff.shiftDate === dateFilter;

      return matchesSearch && matchesPosition && matchesStatus && matchesDate;
    });
    const getters = {
      date: [(staff) => staff.shiftDate, "date"],
      name: [(staff) => staff.staffName, "text"],
      position: [(staff) => getStaffPosition(staff), "text"],
      status: [(staff) => staff.status, "text"],
      hours: [(staff) => staff.totalHours, "number"],
    };
    const [getter, type] = getters[sortBy];
    return sortRecords(matches, getter, sortDirection, type);
  }, [localStaffShifts, searchTerm, positionFilter, statusFilter, dateFilter, sortBy, sortDirection]);

  const staffDirectory = useMemo(() => {
    const staffMap = new Map();

    localStaffShifts.forEach((staff) => {
      const position = getStaffPosition(staff);
      const staffKey = `${staff.staffName}-${position}`;

      if (!staffMap.has(staffKey)) {
        staffMap.set(staffKey, {
          id: staff.id,
          staffName: staff.staffName,
          position,
          dateAdded:
            staff.dateAdded || staff.createdAt || staff.shiftDate || "Not set",
          status: "Active",
        });
      }
    });

    return Array.from(staffMap.values());
  }, [localStaffShifts]);

  function updateAddStaffForm(field, value) {
    setAddStaffForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function updateEditStaffForm(field, value) {
    setEditStaffForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function closeAddStaffModal() {
    setIsAddStaffModalOpen(false);
    setAddStaffForm(DEFAULT_STAFF_FORM);
  }

  function closeEditStaffModal() {
    setIsEditStaffModalOpen(false);
    setSelectedStaff(null);
    setEditStaffForm(DEFAULT_EDIT_FORM);
  }

  async function handleSubmitAddStaff(event) {
    event.preventDefault();

    if (!addStaffForm.staffName.trim()) {
      return;
    }

    const newStaff = {
      id: createStaffId(),
      staffName: addStaffForm.staffName.trim(),
      position: addStaffForm.position,
      role: addStaffForm.position,
      dateAdded: getTodayDate(),
      shiftDate: getTodayDate(),
      scheduledTimeIn: "",
      scheduledTimeOut: "",
      actualTimeIn: "",
      actualTimeOut: "",
      status: "On Duty",
      totalHours: 0,
      notes: "New staff record added.",
    };

    try {
      if (createStaff) {
        await createStaff(newStaff);
      }

      setLocalStaffShifts((currentStaff) => [newStaff, ...currentStaff]);
      closeAddStaffModal();
    } catch (error) {
      console.error("Unable to add staff:", error.message);
    }
  }

  function openEditStaffModal(staff) {
    setSelectedStaff(staff);

    setEditStaffForm({
      staffName: staff.staffName || "",
      position: getStaffPosition(staff),
      scheduledTimeIn: staff.scheduledTimeIn || "",
      scheduledTimeOut: staff.scheduledTimeOut || "",
      notes: staff.notes || "",
    });

    setIsEditStaffModalOpen(true);
  }

  async function handleSubmitEditStaff(event) {
    event.preventDefault();

    if (!selectedStaff || !editStaffForm.staffName.trim()) {
      return;
    }

    const updatedStaff = {
      ...selectedStaff,
      staffName: editStaffForm.staffName.trim(),
      position: editStaffForm.position,
      role: editStaffForm.position,
      scheduledTimeIn: editStaffForm.scheduledTimeIn,
      scheduledTimeOut: editStaffForm.scheduledTimeOut,
      notes: editStaffForm.notes,
    };

    try {
      if (updateStaff) {
        await updateStaff(selectedStaff.id, updatedStaff);
      }

      setLocalStaffShifts((currentStaff) =>
        currentStaff.map((staff) =>
          staff.id === selectedStaff.id ? updatedStaff : staff
        )
      );

      closeEditStaffModal();
    } catch (error) {
      console.error("Unable to update staff:", error.message);
    }
  }

  async function handleToggleDuty(staff) {
    if (!setDutyStatus) return;
    const nextStatus = staff.status === "On Duty" ? "Off Duty" : "On Duty";
    setUpdatingDutyId(staff.id);
    try {
      await setDutyStatus(staff.id, nextStatus);
      setLocalStaffShifts((current) => current.map((item) =>
        item.id === staff.id ? { ...item, status: nextStatus } : item
      ));
    } catch (error) {
      console.error("Unable to change staff duty status:", error.message);
    } finally {
      setUpdatingDutyId(null);
    }
  }

  if (isStaffShiftsLoading) {
    return (
      <section className="admin-page">
        <div className="admin-page-heading">
          <div>
            
            <h1>Staff Shifts</h1>
            <p>Loading staff shift records...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <div className="admin-page-heading">
        <div>
          
          <h1>Staff Shifts</h1>
          
        </div>

        <AdminPageActions className="staff-shifts-heading-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setIsStaffDirectoryOpen(true)}
          >
            Staff Directory
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={() => setIsAddStaffModalOpen(true)}
          >
            Add Staff
          </button>
        </AdminPageActions>
      </div>

      {staffShiftsError && (
        <section className="staff-message warning">{staffShiftsError}</section>
      )}

      {staffShiftActionError && (
        <section className="staff-message danger">{staffShiftActionError}</section>
      )}

      <StaffSummaryCards summary={summary} />

      <StaffFilters
        searchTerm={searchTerm}
        positionFilter={positionFilter}
        statusFilter={statusFilter}
        dateFilter={dateFilter}
        positionOptions={STAFF_POSITION_FILTER_OPTIONS}
        statusOptions={STAFF_STATUS_OPTIONS}
        onSearchChange={setSearchTerm}
        onPositionChange={setPositionFilter}
        onStatusChange={setStatusFilter}
        onDateChange={setDateFilter}
      />

      <StaffShiftTable
        staffShifts={filteredStaffShifts}
        onEditStaff={openEditStaffModal}
        onToggleDuty={handleToggleDuty}
        updatingDutyId={updatingDutyId}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSortColumn={handleSortColumn}
      />

      {isAddStaffModalOpen && (
        <AddStaffModal
          formData={addStaffForm}
          positionOptions={STAFF_POSITION_OPTIONS}
          onChange={updateAddStaffForm}
          onClose={closeAddStaffModal}
          onSubmit={handleSubmitAddStaff}
        />
      )}

      {isEditStaffModalOpen && selectedStaff && (
        <EditStaffModal
          formData={editStaffForm}
          positionOptions={STAFF_POSITION_OPTIONS}
          onChange={updateEditStaffForm}
          onClose={closeEditStaffModal}
          onSubmit={handleSubmitEditStaff}
        />
      )}

      {isStaffDirectoryOpen && (
        <StaffDirectoryModal
          staffDirectory={staffDirectory}
          onClose={() => setIsStaffDirectoryOpen(false)}
        />
      )}
    </section>
  );
}

export default SuperAdminStaffShiftsPage;
