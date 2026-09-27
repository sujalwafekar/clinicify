"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Activity,
  ArrowRight,
  Clock,
  UserCheck,
  Stethoscope,
  PlusCircle,
  Sparkles,
  Layers,
  ChevronRight,
} from "lucide-react";

interface PatientToken {
  id: string;
  token: string;
  name: string;
  doctor: string;
  room: string;
  wait: string;
  status: "active" | "next" | "waiting";
}

const INITIAL_QUEUES: Record<string, PatientToken[]> = {
  general: [
    {
      id: "p1",
      token: "GM-204",
      name: "Priya Sharma",
      doctor: "Dr. Ramesh Gupta",
      room: "Room 102",
      wait: "In Room",
      status: "active",
    },
    {
      id: "p2",
      token: "GM-205",
      name: "Rahul Patel",
      doctor: "Dr. Ramesh Gupta",
      room: "Waiting Lobby",
      wait: "~6 min",
      status: "next",
    },
    {
      id: "p3",
      token: "GM-206",
      name: "Anita Desai",
      doctor: "Dr. Ramesh Gupta",
      room: "Waiting Lobby",
      wait: "~18 min",
      status: "waiting",
    },
    {
      id: "p4",
      token: "GM-207",
      name: "Vikram Mehta",
      doctor: "Dr. Ramesh Gupta",
      room: "Waiting Lobby",
      wait: "~31 min",
      status: "waiting",
    },
  ],
  cardio: [
    {
      id: "c1",
      token: "CR-108",
      name: "Mohan Lal",
      doctor: "Dr. Kavita Rao",
      room: "Room 204",
      wait: "In Room",
      status: "active",
    },
    {
      id: "c2",
      token: "CR-109",
      name: "Sunita Verma",
      doctor: "Dr. Kavita Rao",
      room: "Waiting Lobby",
      wait: "~12 min",
      status: "next",
    },
    {
      id: "c3",
      token: "CR-110",
      name: "Amit Joshi",
      doctor: "Dr. Kavita Rao",
      room: "Waiting Lobby",
      wait: "~25 min",
      status: "waiting",
    },
  ],
  pediatrics: [
    {
      id: "pd1",
      token: "PD-041",
      name: "Aarav Pillai (Child)",
      doctor: "Dr. Deepa Nair",
      room: "Room 108",
      wait: "In Room",
      status: "active",
    },
    {
      id: "pd2",
      token: "PD-042",
      name: "Ishita Kapoor",
      doctor: "Dr. Deepa Nair",
      room: "Waiting Lobby",
      wait: "~9 min",
      status: "next",
    },
    {
      id: "pd3",
      token: "PD-043",
      name: "Karan Johar",
      doctor: "Dr. Deepa Nair",
      room: "Waiting Lobby",
      wait: "~22 min",
      status: "waiting",
    },
  ],
};

export function InteractiveHero3D({ onOpenLogin }: { onOpenLogin: () => void }) {
  const [dept, setDept] = useState<"general" | "cardio" | "pediatrics">("general");
  const [queue, setQueue] = useState<PatientToken[]>(INITIAL_QUEUES.general);
  const [callCount, setCallCount] = useState(1);
  const cardRef = useRef<HTMLDivElement>(null);

  // 3D perspective tilt calculations (spline3d / interactive 3D effect)
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });

  useEffect(() => {
    setQueue(INITIAL_QUEUES[dept]);
  }, [dept]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotX = ((y - centerY) / centerY) * -7;
    const rotY = ((x - centerX) / centerX) * 7;

    setRotateX(rotX);
    setRotateY(rotY);
    setGlarePos({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.15,
    });
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
    setGlarePos((prev) => ({ ...prev, opacity: 0 }));
  };

  const handleCallNext = () => {
    if (queue.length <= 1) {
      setQueue(INITIAL_QUEUES[dept]);
      setCallCount((c) => c + 1);
      return;
    }
    const [called, ...rest] = queue;
    if (rest.length > 0) {
      rest[0].status = "active";
      rest[0].wait = "In Room";
      if (rest[1]) {
        rest[1].status = "next";
        rest[1].wait = "~7 min";
      }
    }
    setQueue(rest);
    setCallCount((c) => c + 1);
  };

  const handleAddWalkIn = () => {
    const nextNum = 208 + queue.length;
    const names = ["Suresh Menon", "Pooja Reddy", "Naveen Singhal", "Fatima Khan"];
    const randomName = names[Math.floor(Math.random() * names.length)];
    const newToken: PatientToken = {
      id: `new-${Date.now()}`,
      token: dept === "general" ? `GM-${nextNum}` : dept === "cardio" ? `CR-${nextNum}` : `PD-${nextNum}`,
      name: randomName,
      doctor: dept === "general" ? "Dr. Ramesh Gupta" : dept === "cardio" ? "Dr. Kavita Rao" : "Dr. Deepa Nair",
      room: "Waiting Lobby",
      wait: `~${queue.length * 11 + 6} min`,
      status: "waiting",
    };
    setQueue((prev) => [...prev, newToken]);
  };

  return (
    <div className="hero-3d-container">
      {/* 3D Perspective Card Container */}
      <div
        ref={cardRef}
        className="hero-3d-stage"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `perspective(1100px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
          transition: "transform 0.12s ease-out",
        }}
      >
        {/* Dynamic glare / specular light reflection */}
        <div
          className="hero-3d-glare"
          style={{
            background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 65%)`,
            opacity: glarePos.opacity,
          }}
        />

        {/* Main Clinical Console Surface */}
        <div className="console-surface">
          {/* Top Bar: Live Hospital Status */}
          <div className="console-topbar">
            <div className="console-brand-pill">
              <span className="live-ping-dot">
                <span className="live-ping-ring" />
              </span>
              <span className="console-status-text">OPD Consultation Board</span>
            </div>

            {/* Department Segmented Switcher (motion.dev layoutId) */}
            <div className="dept-tabs">
              {(
                [
                  { id: "general", label: "Medicine" },
                  { id: "cardio", label: "Cardiology" },
                  { id: "pediatrics", label: "Pediatrics" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  className={`dept-tab-btn ${dept === tab.id ? "active" : ""}`}
                  onClick={() => setDept(tab.id)}
                >
                  {dept === tab.id && (
                    <motion.div
                      layoutId="activeDeptTab"
                      className="dept-tab-indicator"
                      transition={{ type: "spring", stiffness: 450, damping: 30 }}
                    />
                  )}
                  <span className="dept-tab-title">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Doctor Telemetry Strip */}
          <div className="console-doctor-strip">
            <div className="doctor-avatar-circle">
              <Stethoscope size={16} />
            </div>
            <div className="doctor-meta">
              <div className="doctor-name">
                {dept === "general"
                  ? "Dr. Ramesh Gupta, MD"
                  : dept === "cardio"
                  ? "Dr. Kavita Rao, DM"
                  : "Dr. Deepa Nair, DCH"}
              </div>
              <div className="doctor-pacing">
                <span>Room 102</span>
                <span className="dot-sep">•</span>
                <span>Pacing: ~11 min/patient</span>
                <span className="dot-sep">•</span>
                <span className="pacing-badge">On Schedule</span>
              </div>
            </div>
          </div>

          {/* Live Patient Queue List with Motion layout animations */}
          <div className="console-queue-list">
            <div className="queue-list-header">
              <span>Token</span>
              <span>Patient Name</span>
              <span style={{ textAlign: "right" }}>Status / ETA</span>
            </div>

            <div className="queue-rows-container">
              <AnimatePresence initial={false} mode="popLayout">
                {queue.map((pt) => {
                  const isActive = pt.status === "active";
                  const isNext = pt.status === "next";

                  return (
                    <motion.div
                      key={pt.id}
                      layout
                      initial={{ opacity: 0, scale: 0.96, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.94, y: 15 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 28,
                      }}
                      className={`queue-row ${isActive ? "row-active" : isNext ? "row-next" : ""}`}
                    >
                      <div className="token-cell">
                        <span className={`token-badge ${isActive ? "token-active" : ""}`}>
                          {pt.token}
                        </span>
                      </div>

                      <div className="name-cell">
                        <span className="pt-name">{pt.name}</span>
                        <span className="pt-sub">{pt.room}</span>
                      </div>

                      <div className="status-cell">
                        {isActive ? (
                          <span className="status-pill in-room">
                            <span className="pulse-mini" /> In Consultation
                          </span>
                        ) : isNext ? (
                          <span className="status-pill next-up">
                            <Clock size={12} /> Next Up ({pt.wait})
                          </span>
                        ) : (
                          <span className="status-pill waiting">
                            {pt.wait}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Board Controls */}
          <div className="console-controls">
            <button
              className="console-action-btn primary"
              onClick={handleCallNext}
              title="Simulates advancing to the next waiting patient"
            >
              <UserCheck size={15} />
              <span>Call Next Patient</span>
            </button>

            <button
              className="console-action-btn secondary"
              onClick={handleAddWalkIn}
              title="Simulates registering an incoming walk-in patient"
            >
              <PlusCircle size={15} />
              <span>Register Patient</span>
            </button>

            <div className="simulation-hint">
              <span className="hint-pill">Live OPD Board</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
