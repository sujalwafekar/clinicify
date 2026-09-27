"use client";

import { useState } from "react";

export function PriorityBadge() {
  return (
    <span className="badge badge-red" style={{ 
      fontSize: 11, 
      fontWeight: 800, 
      backgroundColor: "var(--red-bg, #ffebee)", 
      color: "var(--red, #c62828)", 
      border: "1px solid rgba(198, 40, 40, 0.2)"
    }}>
      PRIORITY
    </span>
  );
}

export function PriorityActionButton({ onClick }: { onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      style={{
        background: "transparent",
        border: "1px solid var(--red, #c62828)",
        color: "var(--red, #c62828)",
        padding: "4px 8px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap"
      }}
    >
      Mark Priority
    </button>
  );
}

export function PriorityConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  patientName,
  token,
  doctorName,
  currentEta,
  busy
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  patientName: string;
  token: string;
  doctorName: string;
  currentEta: string | null;
  busy: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999
    }}>
      <div className="card" style={{ width: 400, padding: 24, margin: 20 }}>
        <h3 style={{ marginTop: 0, marginBottom: 16, color: "var(--red, #c62828)" }}>Mark Priority Case</h3>
        
        <div style={{ background: "var(--surface)", padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>Patient</div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{patientName} <span className="badge badge-blue">{token}</span></div>
          
          <div style={{ fontSize: 13, color: "var(--muted)" }}>Doctor</div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{doctorName}</div>
          
          {currentEta && (
            <>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>Current ETA</div>
              <div style={{ fontWeight: 600 }}>{currentEta}</div>
            </>
          )}
        </div>

        <p style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
          <strong>Mark this patient as Priority?</strong>
          <br /><br />
          This will move the patient ahead in this doctor's queue and recalculate affected waiting times.
        </p>
        
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button 
            className="btn btn-primary" 
            style={{ backgroundColor: "var(--red, #c62828)", borderColor: "var(--red, #c62828)" }}
            onClick={onConfirm} 
            disabled={busy}
          >
            {busy ? "Confirming..." : "Confirm Priority"}
          </button>
        </div>
      </div>
    </div>
  );
}
