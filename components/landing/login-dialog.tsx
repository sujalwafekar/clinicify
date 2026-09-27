"use client";

import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Role } from "@/lib/domain/types";
import { firebaseAuth } from "@/lib/firebase/client";
import { signInWithEmailAndPassword } from "firebase/auth";
import {
  Stethoscope,
  ClipboardList,
  Pill,
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  X,
  ArrowRight,
  AlertCircle,
  Building2,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  notify: (msg: string, type?: "success" | "error" | "info") => void;
}

const ROLES_CONFIG: Record<
  Role,
  {
    icon: typeof Stethoscope;
    label: string;
    desk: string;
    color: string;
    bgLight: string;
    description: string;
    demoEmail: string;
    demoPass: string;
  }
> = {
  doctor: {
    icon: Stethoscope,
    label: "Doctor",
    desk: "Consulting Room Desk",
    color: "#1687d9",
    bgLight: "#edf6fc",
    description: "Access patient queue, record diagnoses, and issue signed e-prescriptions.",
    demoEmail: "doctor@clinicify.test",
    demoPass: "D12345678",
  },
  receptionist: {
    icon: ClipboardList,
    label: "Reception",
    desk: "Front Desk & Triage",
    color: "#2563eb",
    bgLight: "#eff6ff",
    description: "Register walk-in patients, issue OPD tokens, and allocate consulting rooms.",
    demoEmail: "reception@clinicify.test",
    demoPass: "R12345678",
  },
  pharmacist: {
    icon: Pill,
    label: "Pharmacy",
    desk: "Dispensary Counter",
    color: "#059669",
    bgLight: "#ecfdf5",
    description: "Receive live digital prescriptions, verify stock, and generate billing.",
    demoEmail: "pharmacy@clinicify.test",
    demoPass: "P12345678",
  },
  admin: {
    icon: ShieldCheck,
    label: "Admin",
    desk: "Hospital Operations",
    color: "#4f46e5",
    bgLight: "#eef2ff",
    description: "Oversee clinic queues, manage staff accounts, and configure departments.",
    demoEmail: "admin@clinicify.test",
    demoPass: "A12345678",
  },
};

export function LoginDialog({ isOpen, onClose, notify }: LoginDialogProps) {
  const [selectedRole, setSelectedRole] = useState<Role>("doctor");
  const [email, setEmail] = useState("doctor@clinicify.test");
  const [password, setPassword] = useState("D12345678");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeMeta = ROLES_CONFIG[selectedRole];
  const IconComponent = activeMeta.icon;

  const handleRoleChange = (role: Role) => {
    setSelectedRole(role);
    setEmail(ROLES_CONFIG[role].demoEmail);
    setPassword(ROLES_CONFIG[role].demoPass);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      notify(`Authenticated as ${activeMeta.label}`, "success");
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed.";
      setError(
        msg.includes("auth/invalid-credential") || msg.includes("auth/wrong-password")
          ? "Invalid email or password. Click 'Fill Demo Account' to use default credentials."
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="login-backdrop" onClick={onClose}>
        <motion.div
          className="login-modal-window"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
        >
          {/* Header */}
          <div className="login-modal-top">
            <div className="login-hospital-brand">
              <div className="brand-logo-sq">✚</div>
              <div>
                <div className="brand-title">CLINICIFY HOSPITAL</div>
                <div className="brand-sub">Clinical Staff Access Portal</div>
              </div>
            </div>

            <button className="login-close-button" onClick={onClose} aria-label="Close dialog">
              <X size={18} />
            </button>
          </div>

          {/* Role Segmented Switcher with motion.dev layoutId */}
          <div className="role-segmented-tabs">
            {(Object.keys(ROLES_CONFIG) as Role[]).map((rKey) => {
              const r = ROLES_CONFIG[rKey];
              const RIcon = r.icon;
              const isSelected = selectedRole === rKey;

              return (
                <button
                  key={rKey}
                  type="button"
                  className={`role-tab-btn ${isSelected ? "selected" : ""}`}
                  onClick={() => handleRoleChange(rKey)}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="loginActiveRole"
                      className="role-tab-indicator"
                      transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className="role-tab-content">
                    <RIcon size={16} />
                    <span>{r.label}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Role Context Bar */}
          <div className="role-context-bar" style={{ backgroundColor: activeMeta.bgLight }}>
            <div className="role-context-icon" style={{ color: activeMeta.color }}>
              <IconComponent size={20} />
            </div>
            <div className="role-context-text">
              <div className="role-context-title" style={{ color: activeMeta.color }}>
                {activeMeta.desk}
              </div>
              <div className="role-context-desc">{activeMeta.description}</div>
            </div>
          </div>

          {/* Error Notice */}
          {error && (
            <motion.div
              className="login-error-strip"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Authentication Form */}
          <form className="login-form-body" onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="staff-email">Work Email</label>
              <div className="input-field-wrapper">
                <Mail size={16} className="input-icon" />
                <input
                  id="staff-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor@clinicify.test"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="staff-password">Password</label>
              <div className="input-field-wrapper">
                <Lock size={16} className="input-icon" />
                <input
                  id="staff-password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((p) => !p)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Quick Demo Fill Helper */}
            <div className="quick-demo-row">
              <span className="demo-label">Testing credentials:</span>
              <button
                type="button"
                className="demo-autofill-btn"
                onClick={() => {
                  setEmail(activeMeta.demoEmail);
                  setPassword(activeMeta.demoPass);
                  setError(null);
                }}
              >
                <Sparkles size={13} />
                <span>Fill {activeMeta.label} Account</span>
              </button>
            </div>

            {/* Submit Button */}
            <button className="login-submit-button" type="submit" disabled={loading}>
              {loading ? (
                <span className="spinner-loader" />
              ) : (
                <>
                  <span>Sign In to {activeMeta.label} Desk</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Security & Audit Footer */}
          <div className="login-modal-footer">
            <div className="security-tag">
              <CheckCircle2 size={13} />
              <span>256-bit TLS encrypted session · Restricted to hospital personnel</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
