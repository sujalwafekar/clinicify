"use client";

import {
  useEffect, useState, type FormEvent,
} from "react";
import type { Role } from "@/lib/domain/types";
import { firebaseAuth } from "@/lib/firebase/client";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { subscribeClinicify } from "@/lib/supabase/realtime";
import type { QueueState } from "@/lib/domain/types";
import { DoctorLive, PharmacyLive, ReceptionLive } from "./live-workflows";
import { AdminLive } from "./admin-live";
import { WaitingRoomDisplay } from "./waiting-room-display";

/* ── Constants ──────────────────────────────────── */
const DEPARTMENTS = [
  "General Medicine", "Gynecology", "Pediatrics", "Radiology",
  "ENT", "Dentistry", "Neurology", "Cardiology", "Orthopedics",
  "Dermatology", "Ophthalmology", "Psychiatry",
];

const ROLE_META: Record<Role, { icon: string; label: string; desc: string; colorClass: string }> = {
  admin: { icon: "🏛️", label: "Admin", desc: "Manage staff requests & operations", colorClass: "admin" },
  doctor: { icon: "🩺", label: "Doctor", desc: "View queue & write prescriptions", colorClass: "doctor" },
  receptionist: { icon: "📋", label: "Receptionist", desc: "Register patients & assign rooms", colorClass: "recept" },
  pharmacist: { icon: "💊", label: "Pharmacist", desc: "Dispense medicines & generate bills", colorClass: "pharma" },
};

/* ── Toast ──────────────────────────────────────── */
type ToastMsg = { id: number; text: string; type: "success" | "error" | "info" };

function useToast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const push = (text: string, type: ToastMsg["type"] = "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };
  const dismiss = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));
  return { toasts, push, dismiss };
}

function ToastContainer({ toasts, dismiss }: { toasts: ToastMsg[]; dismiss: (id: number) => void }) {
  const icons: Record<string, string> = { success: "✅", error: "❌", info: "ℹ️" };
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span className="toast-icon">{icons[t.type]}</span>
          <span className="toast-text">{t.text}</span>
          <button className="toast-close" onClick={() => dismiss(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}

/* ── Main App ───────────────────────────────────── */
export function ClinicifyApp() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [doctorId, setDoctorId] = useState<string>();
  const [department, setDepartment] = useState<string>();
  const [state, setState] = useState<QueueState>({ doctors: [], visits: [], events: [] });
  const [authLoading, setAuthLoading] = useState(true);
  const [showWaitingDisplay, setShowWaitingDisplay] = useState(false);
  const { toasts, push: notify, dismiss } = useToast();

  useEffect(() => onAuthStateChanged(firebaseAuth, async currentUser => {
    setUser(currentUser);
    if (!currentUser) { setRole(null); setDoctorId(undefined); setDepartment(undefined); setAuthLoading(false); return; }
    const claims = await currentUser.getIdTokenResult(true);
    const signedRole = claims.claims.role as Role;
    setRole(signedRole);
    setDoctorId(typeof claims.claims.doctorId === "string" ? claims.claims.doctorId : undefined);
    setDepartment(typeof claims.claims.department === "string" ? claims.claims.department : undefined);
    setAuthLoading(false);
  }), []);

  useEffect(() => {
    if (!user || !role) return;
    return subscribeClinicify(setState, { role, doctorId });
  }, [user, role, doctorId]);

  const callApi = async (path: string, body?: unknown) => {
    if (!user) throw new Error("Please sign in.");
    const token = await user.getIdToken();
    const response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Action failed");
    return result;
  };

  const handleSignOut = async () => {
    await signOut(firebaseAuth);
    notify("Signed out successfully.", "success");
  };

  if (authLoading) return <LoadingScreen />;
  if (!user || !role) {
    return (
      <>
        <LandingPage notify={notify} onOpenWaitingDisplay={() => setShowWaitingDisplay(true)} />
        {showWaitingDisplay && (
          <div className="waiting-display-modal-overlay" onClick={() => setShowWaitingDisplay(false)}>
            <div className="waiting-display-modal-content" onClick={e => e.stopPropagation()}>
              <WaitingRoomDisplay
                isModal={true}
                onClose={() => setShowWaitingDisplay(false)}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  const displayName = user.email?.split("@")[0] ?? "User";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="topbar-brand-icon">✚</div>
          CLINICIFY
        </div>
        <div className="topbar-live">
          <div className="topbar-live-dot" />
          LIVE
        </div>
        <div className="topbar-role-badge">
          <div className="topbar-role-dot" />
          {role.charAt(0).toUpperCase() + role.slice(1)}
          {department ? ` · ${department}` : ""}
        </div>
        <button
          className="topbar-display-btn"
          onClick={() => setShowWaitingDisplay(true)}
          title="Open Waiting Room Display Board"
        >
          📺 Tokens Called Display
        </button>
        <a
          href="/waiting-room"
          target="_blank"
          rel="noopener noreferrer"
          className="topbar-display-link"
          title="Open Fullscreen Waiting Room TV in new tab"
        >
          ↗ TV Tab
        </a>
        <div className="topbar-avatar" title={user.email ?? ""}>
          {displayName.slice(0, 2).toUpperCase()}
        </div>
        <button className="topbar-signout" onClick={handleSignOut}>Sign out</button>
      </header>

      <main className="page-content">
        {role === "admin" && <AdminLive state={state} callApi={callApi} notify={notify} />}
        {role === "receptionist" && <ReceptionLive state={state} department={department} callApi={callApi} notify={notify} />}
        {role === "doctor" && <DoctorLive state={state} doctorId={doctorId} callApi={callApi} notify={notify} />}
        {role === "pharmacist" && <PharmacyLive callApi={callApi} notify={notify} />}
      </main>

      {/* Waiting Room TV Display Modal */}
      {showWaitingDisplay && (
        <div className="waiting-display-modal-overlay" onClick={() => setShowWaitingDisplay(false)}>
          <div className="waiting-display-modal-content" onClick={e => e.stopPropagation()}>
            <WaitingRoomDisplay
              initialDoctors={state.doctors}
              initialVisits={state.visits}
              isModal={true}
              onClose={() => setShowWaitingDisplay(false)}
            />
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  );
}



/* ── Loading Screen ─────────────────────────────── */
function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", background: "#071426", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ width: 52, height: 52, background: "linear-gradient(135deg,#1687d9,#3fa8f5)", borderRadius: 14, display: "grid", placeItems: "center", fontSize: 26, boxShadow: "0 8px 24px rgba(22,135,217,0.4)" }}>✚</div>
      <div style={{ color: "rgba(180,210,230,0.7)", fontSize: 14 }}>Loading Clinicify…</div>
    </div>
  );
}

/* ── Landing Page (Split Layout) ───────────────── */
type AuthStep = { role: Role; mode: "signin" } | null;

function LandingPage({ notify, onOpenWaitingDisplay }: { notify: (msg: string, type?: ToastMsg["type"]) => void; onOpenWaitingDisplay: () => void }) {
  const [authStep, setAuthStep] = useState<AuthStep>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "error" | "success" | "info" } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      // onAuthStateChanged in parent will handle the rest
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Invalid email or password.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelect = (role: Role) => {
    setAuthStep({ role, mode: "signin" });
    setEmail("");
    setPassword("");
    setMessage(null);
  };

  return (
    <div className="landing-split" style={{ position: "relative" }}>
      <button 
        onClick={onOpenWaitingDisplay}
        title="Open Live TV Monitor"
        style={{
          position: "absolute",
          top: "24px",
          right: "24px",
          background: "rgba(255, 255, 255, 0.95)",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
          borderRadius: "8px",
          padding: "10px 16px",
          fontWeight: 600,
          color: "#0f172a",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          cursor: "pointer",
          zIndex: 50
        }}
      >
        📺 View Live Screen
      </button>
      {/* Left Branding Side */}
      <div className="landing-left">
        <div className="landing-left-content">
          <div className="landing-brand-split">
            <div className="landing-brand-icon-split">✚</div>
            <div className="landing-brand-name-split">CLINICI<span>FY</span></div>
          </div>
          <h1 className="landing-title-split">
            Intelligent<br />OPD Flow System
          </h1>
          <p className="landing-subtitle-split">
            Experience seamless patient care with real-time queue management, live dashboards, and an integrated hospital ecosystem.
          </p>
        </div>
      </div>

      {/* Right Interaction Side */}
      <div className="landing-right">
        <div className="landing-right-content">
          {!authStep ? (
            <div className="landing-role-selection">
              <h2 className="landing-heading">Welcome to Clinicify</h2>
              <p className="landing-subheading">Select your role to securely sign in to your dashboard.</p>


              <div className="role-grid-split">
                {(Object.entries(ROLE_META) as [Role, typeof ROLE_META[Role]][]).map(([role, meta]) => (
                  <button
                    key={role}
                    className="role-card-split"
                    onClick={() => handleRoleSelect(role)}
                  >
                    <div className={`role-card-icon-split ${meta.colorClass}`}>{meta.icon}</div>
                    <div className="role-card-title-split">{meta.label}</div>
                    <div className="role-card-desc-split">{meta.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="landing-auth-form">
              <button className="btn-back-split" onClick={() => setAuthStep(null)}>
                ← Back to roles
              </button>

              <div className="auth-header-split">
                <div className={`auth-icon-large ${ROLE_META[authStep.role].colorClass}`}>
                  {ROLE_META[authStep.role].icon}
                </div>
                <h2>{ROLE_META[authStep.role].label} Sign In</h2>
                <p>Enter your credentials to access your workspace.</p>
              </div>

              {message && (
                <div className={`auth-message-split ${message.type}`}>
                  {message.text}
                </div>
              )}

              <form className="auth-form-split" onSubmit={submit}>
                <div className="form-field-split">
                  <label className="auth-label-split">Email Address</label>
                  <input
                    className="auth-input-split"
                    required
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@hospital.com"
                  />
                </div>

                <div className="form-field-split">
                  <label className="auth-label-split">Password</label>
                  <input
                    className="auth-input-split"
                    required
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                  />
                </div>

                <button
                  type="button"
                  style={{
                    background: "#f0f7fc",
                    border: "1px dashed #93c5fd",
                    borderRadius: "var(--radius-sm)",
                    padding: "9px 12px",
                    fontSize: 13,
                    color: "#1e40af",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6
                  }}
                  onClick={() => {
                    const creds: Record<Role, { email: string; pass: string }> = {
                      admin: { email: "admin@clinicify.test", pass: "A12345678" },
                      doctor: { email: "doctor@clinicify.test", pass: "D12345678" },
                      receptionist: { email: "reception@clinicify.test", pass: "R12345678" },
                      pharmacist: { email: "pharmacy@clinicify.test", pass: "P12345678" },
                    };
                    const c = creds[authStep.role];
                    setEmail(c.email);
                    setPassword(c.pass);
                  }}
                >
                  ⚡ Autofill demo {ROLE_META[authStep.role].label} account
                </button>

                <button className="auth-btn-split" disabled={loading}>
                  {loading && <span className="btn-spinner" />}
                  {loading ? "Signing in…" : "Sign In to Workspace"}
                </button>

                <div className="auth-footer-note">
                  Staff accounts must be created by the Hospital Admin.
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
