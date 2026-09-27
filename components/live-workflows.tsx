"use client";

import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import type { QueueState } from "@/lib/domain/types";
import { PriorityBadge, PriorityActionButton, PriorityConfirmationModal } from "./priority-actions";

/* ── Shared types ─────────────────────────────── */
type Call = (path: string, body?: unknown) => Promise<unknown>;
type Row  = { id: string; [key: string]: unknown };
type NotifyFn = (msg: string, type?: "success" | "error" | "info") => void;

const DEPARTMENTS = [
  "General Medicine", "Gynecology", "Pediatrics", "Radiology",
  "ENT", "Dentistry", "Neurology", "Cardiology", "Orthopedics",
  "Dermatology", "Ophthalmology", "Psychiatry",
];

const MEDICINES_STATIC = [
  { id: "m-paracetamol",  name: "Paracetamol 500mg",        stockStatus: "available" },
  { id: "m-amoxicillin",  name: "Amoxicillin 250mg",         stockStatus: "available" },
  { id: "m-ibuprofen",    name: "Ibuprofen 400mg",           stockStatus: "available" },
  { id: "m-cetirizine",   name: "Cetirizine 10mg",           stockStatus: "available" },
  { id: "m-metformin",    name: "Metformin 500mg",           stockStatus: "available" },
  { id: "m-amlodipine",   name: "Amlodipine 5mg",            stockStatus: "low_stock" },
  { id: "m-omeprazole",   name: "Omeprazole 20mg",           stockStatus: "available" },
  { id: "m-azithromycin", name: "Azithromycin 500mg",        stockStatus: "available" },
  { id: "m-atorvastatin", name: "Atorvastatin 10mg",         stockStatus: "available" },
  { id: "m-ors",          name: "ORS Sachet",                stockStatus: "available" },
];

/* ── Firestore live collection hook ─────────────── */
function useRows(collectionName: string): Row[] {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    const q = query(collection(firestore, collectionName), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => setRows(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))), () => setRows([]));
  }, [collectionName]);
  return rows;
}

/* ── Helper: call API with loading ─────────────── */
async function run(
  call: Call,
  notify: NotifyFn,
  action: string,
  body: unknown,
  successMsg?: string,
): Promise<unknown> {
  try {
    const result = await call(`/api/operations/${action}`, body);
    notify(successMsg ?? `${action.replaceAll("-", " ")} completed.`, "success");
    return result;
  } catch (err) {
    notify(err instanceof Error ? err.message : "Action failed.", "error");
    return undefined;
  }
}

/* ── Waiting count helper ────────────────────────── */
const waitingFor = (state: QueueState, doctorId: string) =>
  state.visits.filter(v => v.doctorId === doctorId && v.status === "waiting");

/* ════════════════════════════════════════════════
   ADMIN LIVE
   ════════════════════════════════════════════════ */
type RequestRow = Row & { status: "pending" | "approved" | "cancelled" | string };

export function AdminLive({ state, callApi, notify }: { state: QueueState; callApi: Call; notify: NotifyFn }) {
  const loginRequests = useRows("loginRequests") as RequestRow[];
  const orders = useRows("pharmacyOrders");
  const [adminTab, setAdminTab] = useState<"dashboard" | "create-staff">("dashboard");
  const [busy, setBusy] = useState<string>("");

  // Create staff form state
  const [staffForm, setStaffForm] = useState({ email: "", password: "", displayName: "", role: "receptionist" as string, department: "General Medicine", doctorId: "", room: "" });
  const [staffBusy, setStaffBusy] = useState(false);

  const pendingCount = loginRequests.filter(r => r.status === "pending").length;

  const review = async (id: string, status: "approved" | "rejected") => {
    setBusy(id + status);
    try {
      await callApi(`/api/admin/login-requests/${id}`, { status });
      notify(
        status === "approved"
          ? "Login request approved ✅"
          : "Login request rejected 🚫",
        status === "approved" ? "success" : "info",
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : "Review failed.", "error");
    } finally {
      setBusy("");
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffBusy(true);
    try {
      const result = await callApi("/api/admin/create-staff", {
        email: staffForm.email.trim(),
        password: staffForm.password,
        displayName: staffForm.displayName.trim(),
        role: staffForm.role,
        department: staffForm.role !== "pharmacist" ? staffForm.department : "",
        doctorId: staffForm.role === "doctor" ? staffForm.doctorId.trim() : "",
        room: staffForm.role === "doctor" ? staffForm.room.trim() : "",
      });
      if (result) {
        notify(`✅ Staff account created for ${staffForm.displayName.trim()} (${staffForm.role}).`, "success");
        setStaffForm({ email: "", password: "", displayName: "", role: "receptionist", department: "General Medicine", doctorId: "", room: "" });
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not create staff account.", "error");
    } finally {
      setStaffBusy(false);
    }
  };

  // Stats
  const totalWaiting = state.visits.filter(v => v.status === "waiting").length;
  const totalInConsult = state.visits.filter(v => v.status === "in_consultation").length;
  const totalCompleted = state.visits.filter(v => v.status === "completed").length;
  const pendingOrders = orders.filter(o => String(o.status) !== "dispensed").length;
  const dispensedOrders = orders.filter(o => String(o.status) === "dispensed").length;

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-eyebrow">Admin Portal</div>
          <h1 className="page-title">Hospital Dashboard</h1>
          <p className="page-subtitle">Manage rooms, staff, and monitor OPD flow.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={`btn ${adminTab === "dashboard" ? "btn-primary" : "btn-secondary"}`} onClick={() => setAdminTab("dashboard")}>📊 Dashboard</button>
          <button className={`btn ${adminTab === "create-staff" ? "btn-primary" : "btn-secondary"}`} onClick={() => setAdminTab("create-staff")}>➕ Create Staff</button>
        </div>
      </div>

      {adminTab === "dashboard" ? (
        <>
          {/* Stats Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Waiting", value: totalWaiting, icon: "⏳", color: "var(--amber)" },
              { label: "In Consultation", value: totalInConsult, icon: "🩺", color: "var(--blue)" },
              { label: "Completed Today", value: totalCompleted, icon: "✅", color: "var(--green)" },
              { label: "Pharmacy Pending", value: pendingOrders, icon: "💊", color: "var(--amber)" },
              { label: "Dispensed", value: dispensedOrders, icon: "📦", color: "var(--green)" },
              { label: "Login Requests", value: pendingCount, icon: "🔐", color: pendingCount > 0 ? "var(--red, #e74c3c)" : "var(--muted)" },
            ].map(stat => (
              <div key={stat.label} className="card" style={{ padding: "16px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 4 }}>{stat.icon}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Pending Login Requests */}
          {pendingCount > 0 && (
            <div className="card" style={{ marginBottom: 24, border: "2px solid var(--red, #e74c3c)" }}>
              <div className="card-header" style={{ paddingBottom: 12 }}>
                <div className="card-title">🔐 Live Login Requests ({pendingCount})</div>
              </div>
              <div className="card-body" style={{ paddingTop: 0 }}>
                <div className="req-list">
                  {loginRequests.filter(r => r.status === "pending").map(req => (
                    <div key={req.id} className="req-card">
                      <div className="req-card-info">
                        <div className="req-card-name">{String(req.displayName ?? "Unknown")}</div>
                        <div className="req-card-meta">
                          <span className="req-card-meta-item">✉️ {String(req.email ?? "—")}</span>
                          <span className="req-card-meta-item">🎭 {String(req.role ?? "—")}</span>
                        </div>
                      </div>
                      <div className="req-card-actions">
                        <button className="btn btn-success btn-sm" disabled={busy === req.id + "approved"} onClick={() => void review(req.id, "approved")}>
                          {busy === req.id + "approved" ? <span className="btn-spinner dark" /> : null} Approve
                        </button>
                        <button className="btn btn-danger btn-sm" disabled={busy === req.id + "rejected"} onClick={() => void review(req.id, "rejected")}>
                          {busy === req.id + "rejected" ? <span className="btn-spinner dark" /> : null} Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Live Rooms */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header" style={{ paddingBottom: 16 }}>
              <div className="card-title">🏥 Live Rooms</div>
            </div>
            <div className="card-body" style={{ paddingTop: 0 }}>
              {state.doctors.length === 0 ? (
                <p className="text-muted text-sm">No doctor rooms configured.</p>
              ) : (
                <div className="rooms-panel">
                  {state.doctors.map(doc => {
                    const waiting = waitingFor(state, doc.id).length;
                    const currentVisit = state.visits.find(v => v.id === doc.currentVisitId);
                    return (
                      <div key={doc.id} className="room-mini-card">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div className="room-mini-name">{doc.room} · {doc.name}</div>
                          <span className={`badge ${doc.status === "available" ? "badge-green" : doc.status === "busy" ? "badge-blue" : "badge-amber"}`}>
                            {doc.status}
                          </span>
                        </div>
                        <div className="room-mini-meta">
                          {doc.department} · {waiting} waiting
                          {currentVisit ? ` · Seeing: ${currentVisit.patientName} (${currentVisit.token})` : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </>
      ) : (
        /* Create Staff Tab */
        <div className="card" style={{ maxWidth: 600 }}>
          <div className="card-header" style={{ paddingBottom: 16 }}>
            <div className="card-title">➕ Create New Staff Account</div>
          </div>
          <div className="card-body" style={{ paddingTop: 0 }}>
            <form onSubmit={handleCreateStaff} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="form-field">
                <label className="form-label">Role *</label>
                <select className="form-select" value={staffForm.role} onChange={e => setStaffForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="receptionist">🧑‍💼 Receptionist</option>
                  <option value="doctor">🩺 Doctor</option>
                  <option value="pharmacist">💊 Pharmacist</option>
                </select>
              </div>

              <div className="form-field">
                <label className="form-label">Full Name *</label>
                <input className="form-input" required value={staffForm.displayName} onChange={e => setStaffForm(f => ({ ...f, displayName: e.target.value }))} placeholder="Dr. / Mr. / Ms. Full Name" />
              </div>

              <div className="form-field">
                <label className="form-label">Email *</label>
                <input className="form-input" required type="email" value={staffForm.email} onChange={e => setStaffForm(f => ({ ...f, email: e.target.value }))} placeholder="staff@clinicify.test" />
              </div>

              <div className="form-field">
                <label className="form-label">Password * (min 8 chars)</label>
                <input className="form-input" required type="password" minLength={8} value={staffForm.password} onChange={e => setStaffForm(f => ({ ...f, password: e.target.value }))} placeholder="Min. 8 characters" />
              </div>

              {staffForm.role !== "pharmacist" && (
                <div className="form-field">
                  <label className="form-label">Department *</label>
                  <select className="form-select" value={staffForm.department} onChange={e => setStaffForm(f => ({ ...f, department: e.target.value }))}>
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              )}

              {staffForm.role === "doctor" && (
                <>
                  <div className="form-row">
                    <div className="form-field">
                      <label className="form-label">Doctor ID *</label>
                      <input className="form-input" required value={staffForm.doctorId} onChange={e => setStaffForm(f => ({ ...f, doctorId: e.target.value }))} placeholder="e.g. doc-smith" />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Room *</label>
                      <input className="form-input" required value={staffForm.room} onChange={e => setStaffForm(f => ({ ...f, room: e.target.value }))} placeholder="e.g. Room 5" />
                    </div>
                  </div>
                </>
              )}

              <button className="btn btn-primary btn-full btn-lg" disabled={staffBusy}>
                {staffBusy ? <><span className="btn-spinner" /> Creating…</> : "Create Staff Account"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

/* ════════════════════════════════════════════════
   RECEPTION LIVE
   ════════════════════════════════════════════════ */

// Departments list
const DEPT_LIST = [
  { key: "General Medicine", label: "General Medicine", desc: "General OPD, fever, cough, cold" },
  { key: "ENT",              label: "ENT",              desc: "Ear pain, sinusitis, throat problems" },
  { key: "Ophthalmology",    label: "Ophthalmology",    desc: "Eye pain, vision issues, infection" },
  { key: "Dentistry",        label: "Dentistry",        desc: "Tooth pain, cavity, gum issues" },
  { key: "Neurology",        label: "Neurology",        desc: "Headache, seizures, nerve issues" },
  { key: "Cardiology",       label: "Cardiology",       desc: "Chest pain, BP, heart concerns" },
  { key: "Radiology",        label: "Radiology",        desc: "X-ray, MRI, CT scan requests" },
  { key: "Orthopedics",      label: "Orthopedics",      desc: "Joint pain, fractures, sports injury" },
  { key: "Gynecology",       label: "Gynecology",       desc: "Women's health, OB/GYN" },
  { key: "Pediatrics",       label: "Pediatrics",       desc: "Child health, vaccination, growth" },
  { key: "Dermatology",      label: "Dermatology",      desc: "Skin rash, acne, allergy, infection" },
  { key: "Psychiatry",       label: "Psychiatry",       desc: "Mental health, anxiety, counseling" },
];

const COMPLAINT_CATEGORIES = [
  { value: "general",   label: "General" },
  { value: "fever",     label: "Fever" },
  { value: "headache",  label: "Headache" },
  { value: "injury",    label: "Injury" },
  { value: "follow_up", label: "Follow-up" },
] as const;

const fmtTime = (ms: number | null | undefined) => {
  if (!ms) return null;
  return new Date(ms).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
};

type RegForm = {
  name: string; age: string; mobile: string; email: string;
  complaint: string; complaintCategory: string; department: string; isPriority: boolean;
};
type FormErrors = Partial<Record<keyof RegForm, string>>;
type RegistrationResult = { token: string; trackingUrl: string; etaLower: number | null; etaUpper: number | null; recommendedArrival: number | null; doctorName: string; doctorRoom: string; emailSent: boolean };

type PatientMatch = {
  id?: string;
  name: string;
  mobile: string;
  age?: number | string;
  email?: string;
  gender?: string;
  hospitalPatientNumber?: string;
  lastVisitComplaint?: string;
};

const DEMO_PATIENT_RECORDS: PatientMatch[] = [
  { id: "p-001", name: "Aarav Sharma", mobile: "9820123456", age: 39, gender: "Male", hospitalPatientNumber: "UHID-2024-001", lastVisitComplaint: "Fever and fatigue" },
  { id: "p-002", name: "Meera Joshi", mobile: "9819876543", age: 28, gender: "Female", hospitalPatientNumber: "UHID-2024-002", lastVisitComplaint: "Persistent headache" },
  { id: "p-003", name: "Rahul Verma", mobile: "9876543210", age: 52, gender: "Male", hospitalPatientNumber: "UHID-2024-003", lastVisitComplaint: "Follow-up consultation" },
  { id: "p-004", name: "Ishita Rao", mobile: "9823456789", age: 34, gender: "Female", hospitalPatientNumber: "UHID-2024-004", lastVisitComplaint: "General consultation" },
  { id: "p-005", name: "Kabir Khan", mobile: "9834567890", age: 42, gender: "Male", hospitalPatientNumber: "UHID-2024-005", lastVisitComplaint: "Fever" },
  { id: "p-006", name: "Nisha Patel", mobile: "9845678901", age: 31, gender: "Female", hospitalPatientNumber: "UHID-2024-006", lastVisitComplaint: "General consultation" }
];

export function ReceptionLive({ state, department: receptionDept, callApi, notify }: {
  state: QueueState; department?: string; callApi: Call; notify: NotifyFn;
}) {
  const EMPTY_FORM: RegForm = { name: "", age: "", mobile: "", email: "", complaint: "", complaintCategory: "general", department: receptionDept ?? "", isPriority: false };
  const [form, setForm] = useState<RegForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [choosingBusy, setChoosingBusy] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [view, setView] = useState<"register" | "queue">("register");

  // Single-phone unified autofill state
  const [matchingPatients, setMatchingPatients] = useState<PatientMatch[]>([]);
  const [isSearchingPhone, setIsSearchingPhone] = useState(false);
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientMatch | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const phoneWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (phoneWrapperRef.current && !phoneWrapperRef.current.contains(e.target as Node)) {
        setShowPhoneDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const referrals = useRows("referralRequests");

  const effectiveDept = receptionDept ?? form.department;
  const filteredDoctors = effectiveDept ? state.doctors.filter(d => d.department === effectiveDept) : state.doctors;
  const queueVisits = state.visits.filter(v => v.status === "waiting" || v.status === "in_consultation");

  const ch = (k: keyof RegForm, v: string) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); setSaved(false); };

  const handleMobileChange = (val: string) => {
    ch("mobile", val);
    if (selectedPatient && val !== selectedPatient.mobile) {
      setSelectedPatient(null);
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    const clean = val.trim();
    const digits = clean.replace(/\D/g, "");

    if (digits.length < 3 && clean.length < 3) {
      setMatchingPatients([]);
      setShowPhoneDropdown(false);
      setIsSearchingPhone(false);
      return;
    }

    setIsSearchingPhone(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const localMatches: PatientMatch[] = [];
        const seen = new Set<string>();

        const addMatch = (p: PatientMatch) => {
          const key = (p.mobile || p.name).toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            localMatches.push(p);
          }
        };

        // 1. Match against DEMO_PATIENT_RECORDS
        for (const demo of DEMO_PATIENT_RECORDS) {
          if (demo.mobile.includes(digits) || (digits.length >= 4 && demo.mobile.replace(/\D/g, "").includes(digits))) {
            addMatch(demo);
          }
        }

        // 2. Match against active queue visits
        for (const v of state.visits) {
          const vMobile = v.mobile ?? "";
          if (vMobile && (vMobile.includes(digits) || vMobile.replace(/\D/g, "").includes(digits))) {
            addMatch({
              name: v.patientName,
              mobile: vMobile,
              age: v.age,
              lastVisitComplaint: v.complaint
            });
          }
        }

        // 3. Query remote API
        try {
          const res = await callApi(`/api/patients/lookup?q=${encodeURIComponent(clean)}`) as {
            patient?: Record<string, unknown> | null;
            patients?: Array<Record<string, unknown>>;
          };
          const remoteList = (res?.patients && res.patients.length > 0)
            ? res.patients
            : (res?.patient ? [res.patient] : []);

          for (const item of remoteList) {
            if (item && item.name && item.mobile) {
              addMatch({
                id: item.id as string | undefined,
                name: String(item.name),
                mobile: String(item.mobile),
                age: item.age ? Number(item.age) : undefined,
                email: item.email ? String(item.email) : undefined,
                hospitalPatientNumber: item.hospitalPatientNumber ? String(item.hospitalPatientNumber) : undefined
              });
            }
          }
        } catch {
          // Keep localMatches if API has an error
        }

        setMatchingPatients(localMatches);
        setShowPhoneDropdown(localMatches.length > 0);
      } finally {
        setIsSearchingPhone(false);
      }
    }, 200);
  };

  const handleSelectMatchingPatient = (patient: PatientMatch) => {
    setSelectedPatient(patient);
    setForm(f => ({
      ...f,
      mobile: patient.mobile,
      name: patient.name,
      age: patient.age ? String(patient.age) : f.age,
      email: patient.email ?? f.email
    }));
    setErrors(e => ({ ...e, mobile: undefined, name: undefined, age: undefined }));
    setShowPhoneDropdown(false);
    notify(`Auto-filled details for returning patient: ${patient.name}`, "success");
  };

  const handleClearPatientSelection = () => {
    setSelectedPatient(null);
    setForm(f => ({ ...f, name: "", age: "", email: "" }));
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = "Patient name is required.";
    if (!form.age || !Number.isFinite(Number(form.age)) || Number(form.age) < 0 || Number(form.age) > 130) e.age = "Enter a valid age (0–130).";
    if (!form.mobile.trim()) e.mobile = "Mobile number is required.";
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "Enter a valid email address.";
    if (!form.complaint.trim()) e.complaint = "Describe the patient complaint.";
    if (!form.complaintCategory) e.complaintCategory = "Select a complaint category.";
    if (!effectiveDept) e.department = "Select a department.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      setSaveBusy(true);
      setTimeout(() => { setSaved(true); setSaveBusy(false); }, 300);
    }
  };

  const handleSelectDoctor = async (doctorId: string) => {
    if (result) return;
    if (!validate()) { notify("Please fix the form errors before selecting a doctor.", "error"); return; }
    const doctor = filteredDoctors.find(d => d.id === doctorId);
    if (!doctor) return;
    setChoosingBusy(doctorId); setSelectedDoctorId(doctorId);
    try {
      const body = { patient: { name: form.name.trim(), age: Number(form.age), mobile: form.mobile.trim(), email: form.email.trim() || undefined }, doctorId, departmentId: doctor.departmentId ?? effectiveDept.toLowerCase().replaceAll(" ", "-"), complaint: form.complaint.trim(), complaintCategory: form.complaintCategory, isPriority: form.isPriority };
      const res = await callApi("/api/visits", body) as { token: string; trackingUrl: string };
      const visit = state.visits.find(v => v.token === res.token);
      setResult({ token: res.token, trackingUrl: res.trackingUrl, etaLower: visit?.etaLower ?? null, etaUpper: visit?.etaUpper ?? null, recommendedArrival: visit?.recommendedArrival ?? null, doctorName: doctor.name, doctorRoom: doctor.room, emailSent: !!form.email.trim() });
      notify(`Token ${res.token} — registered with ${doctor.name}.`, "success");
    } catch (err) { notify(err instanceof Error ? err.message : "Could not create visit.", "error"); setSelectedDoctorId(""); }
    finally { setChoosingBusy(""); }
  };

  const handleReset = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setSelectedDoctorId("");
    setResult(null);
    setSaved(false);
    setSelectedPatient(null);
    setMatchingPatients([]);
    setShowPhoneDropdown(false);
  };

  // ── Queue List View ──
  const [priorityModal, setPriorityModal] = useState<{ isOpen: boolean; visitId: string; patientName: string; token: string; doctorId: string; doctorName: string; currentEta: string | null }>({ isOpen: false, visitId: "", patientName: "", token: "", doctorId: "", doctorName: "", currentEta: null });
  const [priorityBusy, setPriorityBusy] = useState(false);

  const handleMarkPriority = async () => {
    setPriorityBusy(true);
    try {
      await callApi("/api/priority", { visitId: priorityModal.visitId, doctorId: priorityModal.doctorId });
      notify("Priority marked successfully.", "success");
      setPriorityModal(m => ({ ...m, isOpen: false }));
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to mark priority.", "error");
    } finally {
      setPriorityBusy(false);
    }
  };

  if (view === "queue") {
    return (
      <>
        <div className="page-header">
          <div className="page-header-left">
            <div className="page-eyebrow">Reception{receptionDept ? ` · ${receptionDept}` : ""}</div>
            <h1 className="page-title">Patient Queue</h1>
            <p className="page-subtitle">{queueVisits.length} patient{queueVisits.length !== 1 ? "s" : ""} currently active</p>
          </div>
          <button className="btn btn-primary" onClick={() => { handleReset(); setView("register"); }}>+ Add New Patient</button>
        </div>
        {queueVisits.length === 0 ? (
          <div className="no-patient-card">
            <div className="no-patient-icon">📋</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No Patients in Queue</div>
            <p style={{ color: "var(--muted)", marginBottom: 16 }}>Click &ldquo;+ Add New Patient&rdquo; to register a new patient.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {queueVisits.map(v => {
              const doc = state.doctors.find(d => d.id === v.doctorId);
              return (
                <div key={v.id} className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                  <div className="patient-avatar-lg" style={{ width: 40, height: 40, fontSize: 15, flexShrink: 0 }}>{String(v.patientName ?? "P").slice(0, 1)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{v.patientName}</span>
                      <span className="badge badge-blue" style={{ fontSize: 11 }}>{v.token}</span>
                      <span className={`badge ${v.status === "waiting" ? "badge-amber" : "badge-green"}`} style={{ fontSize: 11 }}>{v.status === "waiting" ? "Waiting" : "In Consultation"}</span>
                      {v.priorityLevel === 1 && <PriorityBadge />}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>Age {v.age} · {v.mobile ?? "—"} · {doc?.room ?? "—"} · {doc?.name ?? "Unassigned"}</div>
                    {v.complaint && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.complaint}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                    {v.status === "waiting" && v.priorityLevel !== 1 && doc && (
                      <PriorityActionButton onClick={() => setPriorityModal({ isOpen: true, visitId: v.id, patientName: String(v.patientName), token: String(v.token), doctorId: doc.id, doctorName: doc.name, currentEta: fmtTime(v.etaLower as number) })} />
                    )}
                    {v.etaLower && (<div style={{ textAlign: "right" }}><div style={{ fontSize: 11, color: "var(--muted)" }}>ETA</div><div style={{ fontSize: 13, fontWeight: 600, color: "var(--blue)" }}>{fmtTime(v.etaLower as number)}</div></div>)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        <PriorityConfirmationModal 
          isOpen={priorityModal.isOpen} 
          onClose={() => setPriorityModal(m => ({ ...m, isOpen: false }))} 
          onConfirm={handleMarkPriority}
          patientName={priorityModal.patientName}
          token={priorityModal.token}
          doctorName={priorityModal.doctorName}
          currentEta={priorityModal.currentEta}
          busy={priorityBusy}
        />
        {referrals.filter(r => String(r.status) === "pending_allocation").length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div className="section-title">↩ Incoming Referrals</div>
            {referrals.filter(r => String(r.status) === "pending_allocation").map(ref => (
              <div key={ref.id} className="referral-card" style={{ marginBottom: 10 }}>
                <div className="referral-card-info">
                  <div className="referral-card-name">{String(ref.patientName)}</div>
                  <div className="referral-card-meta">From {String(ref.referringDoctorName)} → {String(ref.department)}</div>
                  <div className="referral-card-meta">{String(ref.complaintText ?? "Follow-up")}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {state.doctors.filter(d => d.department === String(ref.department) && d.status !== "paused").map(doc => (
                    <button key={doc.id} className="btn btn-secondary btn-sm" onClick={() => void run(callApi, notify, "allocate-referral", { referralId: ref.id, doctorId: doc.id }, `Referral allocated to ${doc.room}.`)}>{doc.room} · {doc.name}</button>
                  ))}
                  {state.doctors.filter(d => d.department === String(ref.department)).length === 0 && (<span style={{ fontSize: 11, color: "var(--muted)" }}>No doctor for {String(ref.department)}</span>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  // ── Register Patient View ──
  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-eyebrow">Reception{receptionDept ? ` · ${receptionDept}` : ""}</div>
          <h1 className="page-title">Register Patient</h1>
          <p className="page-subtitle">Enter patient details, select a doctor, and generate token.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {result && <button className="btn btn-secondary" onClick={handleReset}>+ New Patient</button>}
          <button className="btn btn-secondary" onClick={() => setView("queue")} style={{ display: "flex", alignItems: "center", gap: 6 }}>Queue <span className="badge badge-blue" style={{ fontSize: 11 }}>{queueVisits.length}</span></button>
        </div>
      </div>

      <div className="reception-layout">
        {/* ── Left: Form ── */}
        <div className="card reception-form-card">
          {result ? (
            <div style={{ padding: 4 }}>
              <div style={{ textAlign: "center", paddingBottom: 18, borderBottom: "1px solid var(--line)", marginBottom: 18 }}>
                <div style={{ width: 48, height: 48, background: "var(--green-bg)", border: "2px solid var(--green)", borderRadius: "50%", display: "grid", placeItems: "center", margin: "0 auto 10px", fontSize: 20 }}>✓</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Registration Complete</div>
                <div style={{ fontSize: 38, fontWeight: 800, color: "var(--ink)", letterSpacing: "0.04em" }}>{result.token}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{result.doctorName} · {result.doctorRoom}</div>
              </div>
              {(result.etaLower || result.etaUpper) && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <div style={{ background: "var(--surface)", borderRadius: "var(--radius-sm)", padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Expected Consultation</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{fmtTime(result.etaLower) ?? "—"}{result.etaUpper ? ` – ${fmtTime(result.etaUpper)}` : ""}</div>
                  </div>
                  {result.recommendedArrival && (
                    <div style={{ background: "var(--surface)", borderRadius: "var(--radius-sm)", padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Recommended Arrival</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--blue)" }}>{fmtTime(result.recommendedArrival)}</div>
                    </div>
                  )}
                </div>
              )}
              <div style={{ background: "var(--surface)", borderRadius: "var(--radius-sm)", padding: "10px 12px", marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Patient Tracking</div>
                <a href={result.trackingUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--blue)", wordBreak: "break-all", display: "block", marginBottom: 6 }}>{result.trackingUrl}</a>
                {result.emailSent ? (<div style={{ fontSize: 12, color: "var(--green)" }}>✓ Confirmation email sent</div>) : (<div style={{ fontSize: 12, color: "var(--muted)" }}>Share this link with the patient to track live</div>)}
              </div>
              <button className="btn btn-primary btn-full" onClick={handleReset}>+ Register Next Patient</button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Patient Intake &amp; Registration</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted)" }}>Unified Front-Desk Flow</span>
              </div>

              {/* UNIFIED PHONE NUMBER FIELD WITH INSTANT AUTOFILL */}
              <div className="form-field phone-autofill-container" ref={phoneWrapperRef} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    Patient Mobile Number *
                  </label>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    Ask patient for 10-digit number
                  </span>
                </div>

                <div style={{ position: "relative" }}>
                  <input
                    className={`form-input${errors.mobile ? " input-error" : ""}`}
                    style={{ paddingRight: isSearchingPhone ? 38 : 12, fontSize: 14, fontWeight: 600, letterSpacing: "0.02em" }}
                    value={form.mobile}
                    onChange={e => handleMobileChange(e.target.value)}
                    onFocus={() => { if (matchingPatients.length > 0) setShowPhoneDropdown(true); }}
                    placeholder="e.g. 9820123456"
                    type="tel"
                    autoComplete="off"
                  />
                  {isSearchingPhone && (
                    <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}>
                      <span className="btn-spinner" style={{ width: 14, height: 14, borderColor: "var(--muted) transparent transparent transparent" }} />
                    </div>
                  )}
                </div>
                {errors.mobile && <div className="field-error">{errors.mobile}</div>}

                {/* RETURNING PATIENT STATUS PILL */}
                {selectedPatient && (
                  <div className="returning-patient-pill" style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--green-bg)", border: "1px solid rgba(22, 121, 79, 0.25)", borderRadius: "var(--radius-sm)", padding: "8px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--green)", fontWeight: 600, flexWrap: "wrap" }}>
                      <span>✓</span>
                      <span>Returning Patient: <strong>{selectedPatient.name}</strong> ({selectedPatient.age ? `${selectedPatient.age} yrs` : "Profile loaded"})</span>
                      {selectedPatient.hospitalPatientNumber && (
                        <span style={{ background: "rgba(22,121,79,0.12)", padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                          {selectedPatient.hospitalPatientNumber}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleClearPatientSelection}
                      style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 11, cursor: "pointer", textDecoration: "underline", padding: "0 4px", whiteSpace: "nowrap" }}
                    >
                      Clear / New
                    </button>
                  </div>
                )}

                {/* NEW PATIENT NOTIFICATION (when typed >= 4 digits, no selection, and no matches) */}
                {!selectedPatient && form.mobile.replace(/\D/g, "").length >= 4 && matchingPatients.length === 0 && !isSearchingPhone && (
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)", background: "var(--surface)", border: "1px dashed var(--line)", borderRadius: "var(--radius-sm)", padding: "6px 10px" }}>
                    <span>✨</span>
                    <span>New patient number — complete registration below to create profile.</span>
                  </div>
                )}

                {/* AUTOFILL SUGGESTIONS DROPDOWN */}
                {showPhoneDropdown && matchingPatients.length > 0 && (
                  <div className="phone-autocomplete-dropdown">
                    <div style={{ padding: "8px 12px", background: "var(--surface)", borderBottom: "1px solid var(--line)", fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>Matching Registered Patients</span>
                      <span style={{ fontWeight: 500, fontSize: 10, textTransform: "none" }}>Click to autofill</span>
                    </div>
                    <div style={{ maxHeight: 220, overflowY: "auto" }}>
                      {matchingPatients.map((p, idx) => (
                        <div
                          key={p.id ?? `${p.mobile}-${idx}`}
                          className="phone-suggestion-item"
                          onClick={() => handleSelectMatchingPatient(p)}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>{p.name}</span>
                              {p.hospitalPatientNumber && (
                                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", background: "var(--line)", padding: "1px 5px", borderRadius: 4 }}>
                                  {p.hospitalPatientNumber}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
                              <span>📱 {p.mobile}</span>
                              {p.age && <span>Age: {p.age} yrs</span>}
                              {p.lastVisitComplaint && <span>Prior: {p.lastVisitComplaint}</span>}
                            </div>
                          </div>
                          <span className="phone-autofill-action-btn">
                            Autofill ↵
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Name */}
              <div className="form-field" style={{ marginBottom: 10 }}>
                <label className="form-label">Patient Name *</label>
                <input className={`form-input${errors.name ? " input-error" : ""}`} value={form.name} onChange={e => ch("name", e.target.value)} placeholder="Full name" />
                {errors.name && <div className="field-error">{errors.name}</div>}
              </div>

              {/* Age + Email */}
              <div className="form-row" style={{ marginBottom: 10 }}>
                <div className="form-field">
                  <label className="form-label">Age *</label>
                  <input className={`form-input${errors.age ? " input-error" : ""}`} type="number" min="0" max="130" value={form.age} onChange={e => ch("age", e.target.value)} placeholder="Years" />
                  {errors.age && <div className="field-error">{errors.age}</div>}
                </div>
                <div className="form-field">
                  <label className="form-label">Email <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 11 }}>(optional — for notifications)</span></label>
                  <input className={`form-input${errors.email ? " input-error" : ""}`} type="email" value={form.email} onChange={e => ch("email", e.target.value)} placeholder="patient@email.com" />
                  {errors.email && <div className="field-error">{errors.email}</div>}
                </div>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", margin: "14px 0 10px", paddingTop: 12, borderTop: "1px solid var(--line)" }}>Visit Details</div>

              {/* Complaint */}
              <div className="form-field" style={{ marginBottom: 10 }}>
                <label className="form-label">Patient Problem / Reason for Visit *</label>
                <textarea className={`form-input form-textarea${errors.complaint ? " input-error" : ""}`} value={form.complaint} onChange={e => ch("complaint", e.target.value)} placeholder="Describe the chief complaint…" style={{ minHeight: 68 }} />
                {errors.complaint && <div className="field-error">{errors.complaint}</div>}
              </div>

              {/* Category + Department */}
              <div className="form-row" style={{ marginBottom: 4 }}>
                <div className="form-field">
                  <label className="form-label">Complaint Category *</label>
                  <select className={`form-select${errors.complaintCategory ? " input-error" : ""}`} value={form.complaintCategory} onChange={e => ch("complaintCategory", e.target.value)}>
                    {COMPLAINT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  {errors.complaintCategory && <div className="field-error">{errors.complaintCategory}</div>}
                </div>
                {!receptionDept && (
                  <div className="form-field">
                    <label className="form-label">Department *</label>
                    <select className={`form-select${errors.department ? " input-error" : ""}`} value={form.department} onChange={e => ch("department", e.target.value)}>
                      <option value="">— Select department —</option>
                      {DEPT_LIST.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                    </select>
                    {errors.department && <div className="field-error">{errors.department}</div>}
                  </div>
                )}
              </div>
              {effectiveDept && !receptionDept && (<div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{DEPT_LIST.find(d => d.key === effectiveDept)?.desc}</div>)}

              <div className="form-field" style={{ marginBottom: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--red, #c62828)", cursor: "pointer" }}>
                  <input type="checkbox" checked={form.isPriority} onChange={e => setForm(f => ({ ...f, isPriority: e.target.checked }))} style={{ width: 16, height: 16, accentColor: "var(--red, #c62828)" }} />
                  Mark as Emergency / Priority Case
                </label>
              </div>

              {!saved && (
                <button className="btn btn-primary btn-full btn-lg" style={{ marginTop: 16 }} onClick={handleSave} disabled={saveBusy}>
                  {saveBusy ? <><span className="btn-spinner" /> Saving…</> : "Save & Choose Room →"}
                </button>
              )}

              {saved && !result && (
                <div style={{ background: "var(--green-bg)", border: "1px solid rgba(22,121,79,0.2)", borderRadius: "var(--radius-sm)", padding: "12px 14px", fontSize: 13, color: "var(--green)", fontWeight: 600, marginTop: 16 }}>
                  ✅ Details saved — select a room on the right.
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: Available Doctors ── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Available Doctors / Rooms</div>
            {effectiveDept && <span className="badge badge-blue">{effectiveDept}</span>}
          </div>

          {result ? (
            <div style={{ background: "var(--green-bg)", border: "1px solid rgba(22,121,79,0.3)", borderRadius: "var(--radius)", padding: "18px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>✓</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--green)" }}>Assigned to {result.doctorName}</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{result.doctorRoom} · Token {result.token}</div>
            </div>
          ) : !saved ? (
            <div className="rooms-placeholder">
              <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}>🏥</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{effectiveDept ? "Fill in details & save" : "Select a department"}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Complete the form and click "Save & Choose Room"</div>
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>No Doctor Available</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>No doctor configured for <strong>{effectiveDept}</strong>.</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                {[...new Set(state.doctors.map(d => d.department))].map(dept => (<span key={dept} className="badge badge-green">{dept}</span>))}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredDoctors.map(doc => {
                const waitingList = waitingFor(state, doc.id);
                const waiting = waitingList.length;
                const current = state.visits.find(v => v.id === doc.currentVisitId);
                const isBreak = doc.status === "paused";
                const isDisabled = isBreak || !!choosingBusy || !!result;
                const lastInQueue = waitingList[waitingList.length - 1];
                return (
                  <button
                    key={doc.id}
                    className={`room-card ${isBreak ? "room-card-break" : ""} ${selectedDoctorId === doc.id && !result ? "room-card-selected" : ""}`}
                    onClick={() => !isDisabled && void handleSelectDoctor(doc.id)}
                    disabled={isDisabled}
                    style={{ width: "100%", textAlign: "left" }}
                  >
                    <div className="room-card-avatar">{doc.name.replace("Dr.", "").trim().slice(0, 1).toUpperCase()}</div>
                    <div className="room-card-info" style={{ flex: 1 }}>
                      <div className="room-card-name">
                        {doc.name}
                        {isBreak && <span className="badge badge-amber" style={{ marginLeft: 6 }}>On Break</span>}
                        {!isBreak && doc.status === "busy" && <span className="badge badge-blue" style={{ marginLeft: 6 }}>Busy</span>}
                        {!isBreak && doc.status === "available" && <span className="badge badge-green" style={{ marginLeft: 6 }}>Available</span>}
                      </div>
                      <div className="room-card-dept">{doc.department} · {doc.room}</div>
                      <div className="room-card-stats">
                        <div className="room-stat"><div className="room-stat-value">{waiting}</div><div className="room-stat-label">Waiting</div></div>
                        <div className="room-stat-divider" />
                        <div className="room-stat"><div className="room-stat-value">{current?.token ?? "—"}</div><div className="room-stat-label">Current</div></div>
                        {lastInQueue?.etaLower && (<><div className="room-stat-divider" /><div className="room-stat"><div className="room-stat-value" style={{ fontSize: 11 }}>{fmtTime(lastInQueue.etaLower)}</div><div className="room-stat-label">Next slot</div></div></>)}
                      </div>
                    </div>
                    {!isBreak && (<div className="room-card-arrow">{choosingBusy === doc.id ? <span className="btn-spinner dark" /> : "→"}</div>)}
                  </button>
                );
              })}
              <div style={{ padding: "9px 12px", background: "var(--surface)", border: "1px dashed var(--line)", borderRadius: "var(--radius-sm)", fontSize: 12, color: "var(--muted)" }}>Select a doctor above to confirm registration and generate token.</div>
            </div>
          )}

          {referrals.filter(r => String(r.status) === "pending_allocation").length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div className="section-title">↩ Incoming Referrals</div>
              {referrals.filter(r => String(r.status) === "pending_allocation").map(ref => (
                <div key={ref.id} className="referral-card" style={{ marginBottom: 10 }}>
                  <div className="referral-card-info">
                    <div className="referral-card-name">{String(ref.patientName)}</div>
                    <div className="referral-card-meta">From {String(ref.referringDoctorName)} → {String(ref.department)}</div>
                    <div className="referral-card-meta">{String(ref.complaintText ?? "Follow-up")}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {state.doctors.filter(d => d.department === String(ref.department) && d.status !== "paused").map(doc => (
                      <button key={doc.id} className="btn btn-secondary btn-sm" onClick={() => void run(callApi, notify, "allocate-referral", { referralId: ref.id, doctorId: doc.id }, `Referral allocated to ${doc.room}.`)}>{doc.room} · {doc.name}</button>
                    ))}
                    {state.doctors.filter(d => d.department === String(ref.department)).length === 0 && (<span style={{ fontSize: 11, color: "var(--muted)" }}>No doctor for {String(ref.department)}</span>)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════
   DOCTOR LIVE
   ════════════════════════════════════════════════ */
type MedItem = {
  id: string; medicineId: string; name: string;
  dosage: string; timing: string; frequency: string;
  duration: string; quantity: string;
};

export function DoctorLive({ state, doctorId, callApi, notify }: {
  state: QueueState; doctorId?: string; callApi: Call; notify: NotifyFn;
}) {
  const doctor = state.doctors.find(d => d.id === doctorId);
  const patient = state.visits.find(v => v.id === doctor?.currentVisitId)
    ?? (doctor ? waitingFor(state, doctor.id)[0] : undefined);

  const [started, setStarted] = useState(false);
  const [remark, setRemark] = useState("");
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [items, setItems] = useState<MedItem[]>([]);
  const [referrals, setReferrals] = useState<string[]>([]);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [startBusy, setStartBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Fetch medicines from Firestore (fall back to static list)
  const fsRows = useRows("medicines");
  const medicines = fsRows.length > 0 ? fsRows : MEDICINES_STATIC;

  useEffect(() => { setStarted(false); setRemark(""); setItems([]); setReferrals([]); setSearch(""); }, [patient?.id]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!doctor) {
    return (
      <div className="no-patient-card">
        <div className="no-patient-icon">🩺</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Profile Pending Approval</div>
        <p style={{ color: "var(--muted)" }}>Your doctor profile is awaiting admin approval or room assignment.</p>
      </div>
    );
  }

  const isBreak = doctor.status === "paused";

  const handleToggle = async () => {
    setToggleBusy(true);
    await run(callApi, notify, "pause", { doctorId: doctor.id, paused: !isBreak },
      isBreak ? "Status set to Working." : "Status set to Break.");
    setToggleBusy(false);
  };

  const handleStart = async () => {
    if (!patient) return;
    setStartBusy(true);
    const result = await run(callApi, notify, "start", { visitId: patient.id, doctorId: doctor.id }, "Consultation started.");
    if (result) setStarted(true);
    setStartBusy(false);
  };

  const addMed = (med: Row) => {
    setItems(curr => curr.some(i => i.medicineId === med.id) ? curr : [
      ...curr,
      { id: String(med.id), medicineId: String(med.id), name: String(med.name), dosage: "", timing: "", frequency: "", duration: "", quantity: "1" },
    ]);
    setSearch(""); setShowDropdown(false);
  };

  const updateItem = (index: number, field: keyof MedItem, value: string) =>
    setItems(curr => curr.map((item, i) => i === index ? { ...item, [field]: value } : item));

  const removeItem = (index: number) => setItems(curr => curr.filter((_, i) => i !== index));

  const visibleMeds = medicines.filter(m => String(m.name).toLowerCase().includes(search.toLowerCase()));

  const handleGenerate = async () => {
    if (!patient) return;
    if (items.length === 0) return notify("Add at least one medicine before generating prescription.", "error");
    for (const item of items) {
      if (!item.dosage.trim()) return notify(`Enter dosage for ${item.name}.`, "error");
      if (!item.timing) return notify(`Select timing for ${item.name}.`, "error");
      if (!item.frequency.trim()) return notify(`Enter frequency for ${item.name}.`, "error");
      if (!item.duration.trim()) return notify(`Enter duration for ${item.name}.`, "error");
    }
    setGenBusy(true);
    const payload = {
      visitId: patient.id,
      doctorId: doctor.id,
      notes: remark,
      referrals: referrals.filter(Boolean),
      items: items.map(i => ({
        medicineId: i.medicineId,
        name: i.name,
        dosage: i.dosage,
        timing: i.timing,
        frequency: i.frequency,
        duration: i.duration,
        quantity: Number(i.quantity) || 1,
      })),
    };
    const result = await run(callApi, notify, "prescription", payload, "Prescription generated and sent to Pharmacy.");
    if (result) {
      // Open in a new tab for native Print to PDF
      const prescriptionHTML = generatePrescriptionHTML({ patient, doctor, remark, items, referrals });
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(prescriptionHTML);
        printWindow.document.close();
      } else {
        notify("Please allow popups to print the prescription.", "error");
      }
      await run(callApi, notify, "complete", { visitId: patient.id, doctorId: doctor.id }, "Consultation completed.");
      setStarted(false);
    }
    setGenBusy(false);
  };

  // Determine if the consultation is currently active
  const isConsulting = started || patient?.status === "in_consultation";

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-eyebrow">Doctor Portal</div>
          <h1 className="page-title">Dr. {doctor.name}</h1>
          <p className="page-subtitle">{doctor.department} · {doctor.room}</p>
        </div>
        <button
          className={`doctor-status-toggle ${isBreak ? "on-break" : ""}`}
          onClick={handleToggle}
          disabled={toggleBusy}
        >
          {toggleBusy ? <span className="btn-spinner dark" /> : null}
          <span className={`status-pill ${isBreak ? "break" : "working"}`}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
            {isBreak ? "On Break" : "Working"}
          </span>
          {isBreak ? "Resume Working" : "Take Break"}
        </button>
      </div>

      {/* Content */}
      {!patient ? (
        <div className="no-patient-card">
          <div className="no-patient-icon">⏳</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No Patients in Queue</div>
          <p style={{ color: "var(--muted)" }}>
            {isBreak ? "You are on break. Resume working to accept patients." : "Waiting for the next patient to be assigned."}
          </p>
        </div>
      ) : !isConsulting ? (
        /* Patient overview — before diagnosis */
        <div className="patient-overview">
          <div className="patient-overview-header">
            <div className="patient-avatar-lg">{String(patient.patientName ?? "P").slice(0, 1)}</div>
            <div className="patient-overview-info">
              <div className="patient-name-lg" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {patient.patientName} 
                <span style={{ fontSize: 14, color: "var(--muted)", fontWeight: 400 }}>· Token {patient.token}</span>
                {patient.priorityLevel === 1 && <PriorityBadge />}
              </div>
              <div className="patient-meta-row">
                <span className="patient-meta-item">🎂 {patient.age} years</span>
                <span className="patient-meta-item">📱 {patient.mobile ?? "—"}</span>
              </div>
            </div>
          </div>

          {/* Vitals */}
          <div className="vitals-grid">
            <div className="vital-card">
              <div className="vital-value">{patient.age}</div>
              <div className="vital-unit">Age (years)</div>
            </div>
            <div className="vital-card">
              <div className="vital-value">{patient.token}</div>
              <div className="vital-unit">Token</div>
            </div>
          </div>

          <div className="complaint-box">
            <div className="complaint-label">Chief Complaint</div>
            <div className="complaint-text">{patient.complaint}</div>
          </div>

          <button className="btn btn-primary btn-lg btn-full" onClick={handleStart} disabled={startBusy || isBreak}>
            {startBusy ? <><span className="btn-spinner" /> Starting…</> : "Start Diagnosis →"}
          </button>
        </div>
      ) : (
        /* Diagnosis mode */
        <div className="diagnosis-layout">
          {/* Patient info – compact sidebar */}
          <div className="patient-mini-card">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <div className="patient-avatar-lg" style={{ width: 38, height: 38, fontSize: 14 }}>{String(patient.patientName ?? "P").slice(0, 1)}</div>
              <div className="patient-mini-name">{patient.patientName}</div>
              {patient.priorityLevel === 1 && <PriorityBadge />}
            </div>
            <div className="patient-mini-meta">
              Token: <strong>{patient.token}</strong><br />
              Age: <strong>{patient.age} yrs</strong><br />
              Phone: <strong>{patient.mobile ?? "—"}</strong>
            </div>
            <div className="patient-mini-complaint">
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 6 }}>Complaint</div>
              {patient.complaint}
            </div>
          </div>

          {/* Prescription builder */}
          <div className="prescription-card">
            {/* Remark */}
            <div className="prescription-section">
              <div className="prescription-section-title">📝 Post-Checkup Remark</div>
              <textarea
                className="form-input form-textarea"
                value={remark}
                onChange={e => setRemark(e.target.value)}
                placeholder="Doctor's clinical remark after examination…"
                style={{ minHeight: 90 }}
              />
            </div>

            {/* Medicine Search + Table */}
            <div className="prescription-section">
              <div className="prescription-section-title">💊 Medicines</div>

              <div className="med-search-wrapper" ref={searchRef}>
                <span className="med-search-icon">🔍</span>
                <input
                  className="med-search-input"
                  value={search}
                  placeholder="Search medicine to add…"
                  onChange={e => { setSearch(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  autoComplete="off"
                />
                {showDropdown && search.length > 0 && (
                  <div className="med-dropdown">
                    {visibleMeds.length === 0 ? (
                      <div style={{ padding: "12px 14px", color: "var(--muted)", fontSize: 13 }}>No medicines found.</div>
                    ) : visibleMeds.map(med => (
                      <div
                        key={String(med.id)}
                        className="med-dropdown-item"
                        onMouseDown={e => { e.preventDefault(); addMed(med); }}
                      >
                        <span className="med-dropdown-name">{String(med.name)}</span>
                        <span className={`med-dropdown-stock badge ${String(med.stockStatus) === "available" ? "badge-green" : "badge-amber"}`}>
                          {String(med.stockStatus).replace("_", " ")}
                        </span>
                        <span style={{ fontSize: 14, color: "var(--blue)" }}>＋</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {items.length > 0 && (
                <div className="med-table-wrapper">
                  <table className="med-table">
                    <thead>
                      <tr>
                        <th>Medicine</th>
                        <th>Per Dose</th>
                        <th>When to Take</th>
                        <th>Frequency</th>
                        <th>Days</th>
                        <th>Qty</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 600, color: "var(--ink)", minWidth: 140 }}>{item.name}</td>
                          <td>
                            <select
                              value={item.dosage}
                              onChange={e => updateItem(idx, "dosage", e.target.value)}
                              style={{ minWidth: 100 }}
                            >
                              <option value="">Select…</option>
                              <option value="½ tablet">½ tablet</option>
                              <option value="1 tablet">1 tablet</option>
                              <option value="2 tablets">2 tablets</option>
                              <option value="1 capsule">1 capsule</option>
                              <option value="2 capsules">2 capsules</option>
                              <option value="5 ml">5 ml</option>
                              <option value="10 ml">10 ml</option>
                              <option value="1 puff">1 puff</option>
                              <option value="2 puffs">2 puffs</option>
                            </select>
                          </td>
                          <td>
                            <select
                              value={item.timing}
                              onChange={e => updateItem(idx, "timing", e.target.value)}
                              style={{ minWidth: 110 }}
                            >
                              <option value="">Select…</option>
                              <option>Before food</option>
                              <option>After food</option>
                              <option>With food</option>
                              <option>At bedtime</option>
                              <option>Empty stomach</option>
                            </select>
                          </td>
                          <td>
                            <select
                              value={item.frequency}
                              onChange={e => updateItem(idx, "frequency", e.target.value)}
                              style={{ minWidth: 110 }}
                            >
                              <option value="">Select…</option>
                              <option>Once daily</option>
                              <option>Twice daily</option>
                              <option>Thrice daily</option>
                              <option>Every 8 hours</option>
                              <option>Every 6 hours</option>
                              <option>As needed</option>
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              min="1"
                              value={item.duration}
                              onChange={e => updateItem(idx, "duration", e.target.value)}
                              placeholder="Days"
                              style={{ width: 60 }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={e => updateItem(idx, "quantity", e.target.value)}
                              placeholder="Qty"
                              style={{ width: 60 }}
                            />
                          </td>
                          <td>
                            <button className="med-table-remove" onClick={() => removeItem(idx)} title="Remove">✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {items.length === 0 && (
                <div style={{ textAlign: "center", padding: "20px", color: "var(--muted)", fontSize: 13 }}>
                  Search and add medicines above.
                </div>
              )}
            </div>

            {/* Referrals */}
            <div className="prescription-section">
              <div className="prescription-section-title">↗ Department Referrals</div>
              {referrals.map((ref, idx) => (
                <div key={idx} className="referral-row">
                  <select
                    value={ref}
                    onChange={e => setReferrals(curr => curr.map((r, i) => i === idx ? e.target.value : r))}
                    className="form-select"
                  >
                    <option value="">Choose department…</option>
                    {DEPARTMENTS.filter(d => d !== doctor.department).map(d => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                  <button className="referral-row-remove" onClick={() => setReferrals(curr => curr.filter((_, i) => i !== idx))}>✕</button>
                </div>
              ))}
              <button className="btn btn-ghost btn-sm" onClick={() => setReferrals(curr => [...curr, ""])}>
                ＋ Add Referral
              </button>
            </div>

            {/* Generate */}
            <button
              className="btn btn-primary btn-full btn-lg"
              disabled={genBusy}
              onClick={handleGenerate}
            >
              {genBusy ? <><span className="btn-spinner" /> Generating…</> : "📄 Generate & Download Prescription"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ════════════════════════════════════════════════
   PHARMACY LIVE
   ════════════════════════════════════════════════ */
export function PharmacyLive({ callApi, notify }: { callApi: Call; notify: NotifyFn }) {
  const orders = useRows("pharmacyOrders");
  const [busy, setBusy] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  const activeOrders = orders.filter(o => String(o.status) !== "dispensed");
  const completedOrders = orders.filter(o => String(o.status) === "dispensed");

  const updateStatus = async (orderId: string, status: string) => {
    setBusy(orderId + status);
    await run(callApi, notify, "pharmacy-status", { orderId, status }, `Order status updated to "${status}".`);
    setBusy("");
  };

  const generateBill = async (order: Row) => {
    const key = order.id + "bill";
    setBusy(key);
    const result = await run(callApi, notify, "billing", { orderId: order.id, billingStatus: "paid" }, "Bill generated and recorded.");
    if (result) {
      const items = Array.isArray(order.items) ? order.items as Row[] : [];
      const billHTML = generateBillHTML({ order, items });
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(billHTML);
        printWindow.document.close();
      } else {
        notify("Please allow popups to print the bill.", "error");
      }
    }
    setBusy("");
  };

  const getStep = (status: string) => {
    const steps = ["received", "preparing", "ready", "dispensed"];
    return steps.indexOf(status);
  };

  const renderOrder = (order: Row) => {
    const items = Array.isArray(order.items) ? order.items as Row[] : [];
    const step = getStep(String(order.status));
    const steps = ["Received", "Preparing", "Ready", "Dispensed"];
    const isDone = String(order.status) === "dispensed";

    return (
      <div key={order.id} className="pharmacy-order" style={isDone ? { opacity: 0.65 } : {}}>
        <div className="pharmacy-order-header">
          <div className="pharmacy-token">{String(order.token ?? "—")}</div>
          <div className="pharmacy-order-patient">
            <div className="pharmacy-patient-name">{String(order.patientName ?? "Patient")}</div>
            <div className="pharmacy-patient-meta">
              Dr. {String(order.doctorName ?? "—")}
              {Array.isArray(order.referrals) && order.referrals.length > 0
                ? ` · Referrals: ${order.referrals.join(", ")}` : ""}
            </div>
          </div>
          {!isDone && (
            <div className="pharmacy-order-actions">
              <button
                className="btn btn-secondary btn-sm"
                disabled={step >= 1 || busy === order.id + "preparing"}
                onClick={() => void updateStatus(order.id, "preparing")}
              >
                {busy === order.id + "preparing" ? <span className="btn-spinner dark" /> : null} Prepare
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={step !== 1 || busy === order.id + "ready"}
                onClick={() => void updateStatus(order.id, "ready")}
              >
                {busy === order.id + "ready" ? <span className="btn-spinner dark" /> : null} Ready
              </button>
              <button
                className="btn btn-primary btn-sm"
                disabled={String(order.billingStatus) === "paid" || busy === order.id + "bill"}
                onClick={() => void generateBill(order)}
              >
                {busy === order.id + "bill" ? <span className="btn-spinner" /> : null}
                {String(order.billingStatus) === "paid" ? "✅ Billed" : "Generate Bill"}
              </button>
              <button
                className="btn btn-success btn-sm"
                disabled={step !== 2 || busy === order.id + "dispensed"}
                onClick={() => void updateStatus(order.id, "dispensed")}
              >
                {busy === order.id + "dispensed" ? <span className="btn-spinner dark" /> : null} Dispense
              </button>
            </div>
          )}
          {isDone && (
            <span className="badge badge-green" style={{ fontSize: 12 }}>✅ Dispensed</span>
          )}
        </div>

        <div className="pharmacy-order-body">
          {/* Medicine Table */}
          {items.length > 0 ? (
            <table className="pharmacy-med-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Per Dose</th>
                  <th>When to Take</th>
                  <th>Frequency</th>
                  <th>Days</th>
                  <th>Qty</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{String(item.name ?? "—")}</td>
                    <td>{String(item.dosage ?? "—")}</td>
                    <td>{String(item.timing ?? "—")}</td>
                    <td>{String(item.frequency ?? "—")}</td>
                    <td>{String(item.duration ?? "—")} days</td>
                    <td>{String(item.quantity ?? "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: "var(--muted)", fontSize: 13 }}>No medicine items.</p>
          )}

          {/* Progress Steps */}
          <div className="order-progress">
            {steps.map((s, i) => (
              <div key={s} className={`progress-step ${i < step ? "done" : i === step ? "current" : ""}`}>
                <div className="progress-step-dot">
                  {i < step ? "✓" : i + 1}
                </div>
                <div className="progress-step-label">{s}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-eyebrow">Pharmacy</div>
          <h1 className="page-title">Prescription Orders & Bills</h1>
          <p className="page-subtitle">
            {activeOrders.length} active order{activeOrders.length !== 1 ? "s" : ""}
            {completedOrders.length > 0 ? ` · ${completedOrders.length} completed` : ""}
          </p>
        </div>
      </div>

      {/* Active Orders */}
      {activeOrders.length === 0 && completedOrders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💊</div>
          <div className="empty-state-title">No Orders Yet</div>
          <div className="empty-state-desc">Prescriptions generated by doctors will appear here automatically.</div>
        </div>
      ) : (
        <>
          {activeOrders.length === 0 ? (
            <div className="empty-state" style={{ marginBottom: 20 }}>
              <div className="empty-state-icon">✅</div>
              <div className="empty-state-title">All Caught Up!</div>
              <div className="empty-state-desc">No active orders right now. New prescriptions will appear automatically.</div>
            </div>
          ) : (
            activeOrders.map(renderOrder)
          )}

          {/* Completed Orders (collapsible) */}
          {completedOrders.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <button
                className="btn btn-ghost"
                onClick={() => setShowCompleted(c => !c)}
                style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}
              >
                {showCompleted ? "▼" : "▶"} Completed Orders
                <span className="badge badge-green" style={{ fontSize: 11 }}>{completedOrders.length}</span>
              </button>
              {showCompleted && completedOrders.map(renderOrder)}
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ════════════════════════════════════════════════
   HTML GENERATION HELPERS
   ════════════════════════════════════════════════ */

function generatePrescriptionHTML({ patient, doctor, remark, items, referrals }: {
  patient: QueueState["visits"][0];
  doctor: QueueState["doctors"][0];
  remark: string;
  items: MedItem[];
  referrals: string[];
}): string {
  const rows = items.map(item =>
    `<tr>
      <td><strong>${item.name}</strong></td>
      <td>${item.dosage}</td>
      <td>${item.timing}</td>
      <td>${item.frequency}</td>
      <td>${item.duration} days</td>
      <td>${item.quantity}</td>
    </tr>`
  ).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Clinicify Prescription – ${patient.token}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --primary: #2563eb;
    --text-main: #0f172a;
    --text-muted: #64748b;
    --border: #e2e8f0;
    --bg-light: #f8fafc;
  }
  body { 
    font-family: 'Inter', sans-serif; 
    font-size: 14px; 
    color: var(--text-main); 
    padding: 0; 
    margin: 0;
    background: #fff;
  }
  .page {
    max-width: 800px;
    margin: 0 auto;
    padding: 40px;
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid var(--primary); padding-bottom: 16px; margin-bottom: 24px; }
  .brand { font-size: 24px; font-weight: 700; letter-spacing: -0.5px; color: var(--text-main); display: flex; align-items: center; gap: 8px; }
  .brand span { color: var(--primary); }
  .brand-icon { background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border-radius: 6px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
  .rx { font-size: 48px; font-weight: 700; color: var(--primary); line-height: 1; }
  .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; background: var(--bg-light); padding: 20px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 24px; }
  .info-group { display: flex; flex-direction: column; gap: 4px; }
  .info-label { font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); letter-spacing: 0.5px; }
  .info-value { font-weight: 600; font-size: 14px; color: var(--text-main); }
  table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 24px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  th, td { padding: 12px 16px; text-align: left; }
  th { background: var(--bg-light); font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border); letter-spacing: 0.5px; }
  td { border-bottom: 1px solid var(--border); font-size: 14px; }
  tr:last-child td { border-bottom: none; }
  .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--primary); margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px; }
  .remark-box { background: var(--bg-light); border: 1px solid var(--border); border-radius: 8px; padding: 16px; font-size: 14px; margin-bottom: 24px; line-height: 1.5; }
  .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: flex-end; }
  .signature-box { text-align: center; }
  .signature-line { width: 180px; border-bottom: 1px solid var(--text-main); margin-bottom: 8px; }
  .doctor-name { font-weight: 600; font-size: 16px; }
  .doctor-meta { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
  @media print {
    body { padding: 0; }
    .page { padding: 20px; width: 100%; max-width: 100%; box-sizing: border-box; }
    @page { margin: 1cm; size: A4 portrait; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="brand"><div class="brand-icon">✚</div> CLINICI<span>FY</span></div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:6px;font-weight:500;">Official Medical Prescription</div>
    </div>
    <div class="rx">℞</div>
  </div>

  <div class="info-grid">
    <div class="info-group"><div class="info-label">Patient Name</div><div class="info-value">${patient.patientName}</div></div>
    <div class="info-group"><div class="info-label">Token / ID</div><div class="info-value">${patient.token}</div></div>
    <div class="info-group"><div class="info-label">Age / Sex</div><div class="info-value">${patient.age} Y / U</div></div>
    <div class="info-group"><div class="info-label">Date</div><div class="info-value">${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div></div>
    <div class="info-group"><div class="info-label">Contact</div><div class="info-value">${patient.mobile ?? "—"}</div></div>
  </div>

  ${remark ? `<div class="section-title">Clinical Notes</div>
  <div class="remark-box">${remark}</div>` : ""}

  <div class="section-title">Rx Medicines</div>
  <table>
    <thead>
      <tr><th>Medicine</th><th>Dosage</th><th>Timing</th><th>Frequency</th><th>Duration</th><th>Qty</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  ${referrals.filter(Boolean).length > 0 ? `<div class="section-title">Department Referrals</div>
  <div class="remark-box">${referrals.filter(Boolean).join(", ")}</div>` : ""}

  <div class="footer">
    <div>
      <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">Powered by Clinicify Healthcare</div>
      <div style="font-size: 12px; color: var(--text-muted);">Timestamp: ${new Date().toLocaleString()}</div>
    </div>
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="doctor-name">Dr. ${doctor.name}</div>
      <div class="doctor-meta">${doctor.department} · ${doctor.room}</div>
    </div>
  </div>
</div>
<script>
  window.onload = function() {
    window.print();
  }
</script>
</body>
</html>`;
}

function generateBillHTML({ order, items }: { order: Row; items: Row[] }): string {
  const rows = items.map(item => {
    const qty = Number(item.quantity ?? 0);
    const price = Number(item.unitPrice ?? 0);
    return `<tr>
      <td><strong>${String(item.name ?? "—")}</strong><div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">${String(item.dosage ?? "—")} · ${String(item.timing ?? "—")}</div></td>
      <td style="text-align:center">${qty}</td>
      <td style="text-align:right">₹${price.toFixed(2)}</td>
      <td style="text-align:right; font-weight: 600;">₹${(qty * price).toFixed(2)}</td>
    </tr>`;
  }).join("");

  const total = items.reduce((s, i) => s + Number(i.quantity ?? 0) * Number(i.unitPrice ?? 0), 0);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Clinicify Invoice – ${String(order.token)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --primary: #10b981;
    --text-main: #0f172a;
    --text-muted: #64748b;
    --border: #e2e8f0;
    --bg-light: #f8fafc;
  }
  body { 
    font-family: 'Inter', sans-serif; 
    font-size: 14px; 
    color: var(--text-main); 
    padding: 0; 
    margin: 0;
    background: #fff;
  }
  .page {
    max-width: 800px;
    margin: 0 auto;
    padding: 40px;
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid var(--primary); padding-bottom: 16px; margin-bottom: 24px; }
  .brand { font-size: 24px; font-weight: 700; letter-spacing: -0.5px; color: var(--text-main); display: flex; align-items: center; gap: 8px; }
  .brand span { color: var(--primary); }
  .brand-icon { background: linear-gradient(135deg, #10b981, #059669); color: white; border-radius: 6px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
  
  .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; background: var(--bg-light); padding: 20px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 24px; }
  .info-group { display: flex; flex-direction: column; gap: 4px; }
  .info-label { font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); letter-spacing: 0.5px; }
  .info-value { font-weight: 600; font-size: 14px; color: var(--text-main); }
  
  table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 24px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  th, td { padding: 14px 16px; text-align: left; }
  th { background: var(--bg-light); font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border); letter-spacing: 0.5px; }
  td { border-bottom: 1px solid var(--border); font-size: 14px; }
  tr:last-child td { border-bottom: none; }
  .total-row td { font-weight: 700; font-size: 18px; background: #ecfdf5; border-top: 2px solid var(--primary); }
  
  .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--border); text-align: center; font-size: 13px; color: var(--text-muted); }
  .paid-stamp { display: inline-block; border: 4px solid var(--primary); border-radius: 8px; color: var(--primary); font-size: 28px; font-weight: 800; padding: 8px 32px; transform: rotate(-10deg); letter-spacing: 3px; margin: 24px 0; }
  
  @media print {
    body { padding: 0; }
    .page { padding: 20px; width: 100%; max-width: 100%; box-sizing: border-box; }
    @page { margin: 1cm; size: A4 portrait; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="brand"><div class="brand-icon">₹</div> CLINICI<span>FY</span></div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:6px;font-weight:500;">Tax Invoice / Pharmacy Receipt</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:12px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px;">Invoice Date</div>
      <div style="font-size:16px;font-weight:600;">${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-group"><div class="info-label">Token No.</div><div class="info-value">${String(order.token ?? "—")}</div></div>
    <div class="info-group"><div class="info-label">Patient Name</div><div class="info-value">${String(order.patientName ?? "—")}</div></div>
    <div class="info-group"><div class="info-label">Prescribed By</div><div class="info-value">Dr. ${String(order.doctorName ?? "—")}</div></div>
    <div class="info-group"><div class="info-label">Payment Status</div><div class="info-value" style="color:var(--primary);">PAID</div></div>
  </div>

  <table>
    <thead>
      <tr><th>Item Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="3" style="text-align:right">Total Amount Paid</td>
        <td style="text-align:right; color: var(--primary);">₹${total.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div style="text-align:center;">
    <div class="paid-stamp">SUCCESSFULLY PAID</div>
  </div>

  <div class="footer">
    <strong>Thank you for choosing Clinicify.</strong><br/>
    <span style="display:inline-block; margin-top:8px;">This is a computer-generated invoice and does not require a physical signature.</span>
  </div>
</div>
<script>
  window.onload = function() {
    window.print();
  }
</script>
</body>
</html>`;
}
