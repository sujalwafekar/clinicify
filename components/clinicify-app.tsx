"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Role } from "@/lib/domain/types";
import { firebaseAuth } from "@/lib/firebase/client";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { subscribeClinicify } from "@/lib/firebase/realtime";
import type { QueueState } from "@/lib/domain/types";
import { AdminLive, DoctorLive, PharmacyLive, ReceptionLive } from "./live-workflows";
import { LandingPage } from "./landing/landing-page";



/* ── Toast ──────────────────────────────────────── */
type ToastMsg = { id: number; text: string; type: "success" | "error" | "info" };

function useToast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const push = (text: string, type: ToastMsg["type"] = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  };
  const dismiss = (id: number) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));
  return { toasts, push, dismiss };
}

function ToastContainer({
  toasts,
  dismiss,
}: {
  toasts: ToastMsg[];
  dismiss: (id: number) => void;
}) {
  const icons: Record<string, string> = {
    success: "✅",
    error: "❌",
    info: "ℹ️",
  };
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span className="toast-icon">{icons[t.type]}</span>
          <span className="toast-text">{t.text}</span>
          <button className="toast-close" onClick={() => dismiss(t.id)}>
            ×
          </button>
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
  const [state, setState] = useState<QueueState>({
    doctors: [],
    visits: [],
    events: [],
  });
  const [authLoading, setAuthLoading] = useState(true);
  const { toasts, push: notify, dismiss } = useToast();

  useEffect(
    () =>
      onAuthStateChanged(firebaseAuth, async (currentUser) => {
        setUser(currentUser);
        if (!currentUser) {
          setRole(null);
          setDoctorId(undefined);
          setDepartment(undefined);
          setAuthLoading(false);
          return;
        }
        const claims = await currentUser.getIdTokenResult(true);
        const signedRole = claims.claims.role as Role;
        setRole(signedRole);
        setDoctorId(
          typeof claims.claims.doctorId === "string"
            ? claims.claims.doctorId
            : undefined
        );
        setDepartment(
          typeof claims.claims.department === "string"
            ? claims.claims.department
            : undefined
        );
        setAuthLoading(false);
      }),
    []
  );

  useEffect(() => {
    if (!user || !role) return;
    return subscribeClinicify(setState, { role, doctorId });
  }, [user, role, doctorId]);

  const callApi = async (path: string, body?: unknown) => {
    if (!user) throw new Error("Please sign in.");
    const token = await user.getIdToken();
    const response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
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
  if (!user || !role) return <LandingPage notify={notify} />;

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
        <div className="topbar-avatar" title={user.email ?? ""}>
          {displayName.slice(0, 2).toUpperCase()}
        </div>
        <button className="topbar-signout" onClick={handleSignOut}>
          Sign out
        </button>
      </header>

      <main className="page-content">
        {role === "admin" && (
          <AdminLive state={state} callApi={callApi} notify={notify} />
        )}
        {role === "receptionist" && (
          <ReceptionLive
            state={state}
            department={department}
            callApi={callApi}
            notify={notify}
          />
        )}
        {role === "doctor" && (
          <DoctorLive
            state={state}
            doctorId={doctorId}
            callApi={callApi}
            notify={notify}
          />
        )}
        {role === "pharmacist" && (
          <PharmacyLive callApi={callApi} notify={notify} />
        )}
      </main>

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  );
}

/* ── Loading Screen ─────────────────────────────── */
function LoadingScreen() {
  return (
    <div className="lp-loading">
      <div className="lp-loading-icon">✚</div>
      <div className="lp-loading-text">Loading Clinicify…</div>
    </div>
  );
}


