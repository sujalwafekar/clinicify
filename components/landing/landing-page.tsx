"use client";

import { useState, useEffect } from "react";
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Printer,
  Building2,
  PhoneCall,
  Laptop,
  Tv,
  MapPin,
  Ambulance,
  Lock,
  Menu,
  X,
} from "lucide-react";
import { InteractiveHero3D } from "./interactive-hero-3d";
import { BentoFeatures } from "./bento-features";
import { HospitalMetrics } from "./stats-counter";
import { LoginDialog } from "./login-dialog";

export function LandingPage({
  notify,
}: {
  notify: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setNavScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="clinicify-landing">
      {/* ── Redesigned Hospital Header ── */}
      <header className={`hospital-header ${navScrolled ? "scrolled" : ""}`}>
        <div className="header-inner">
          {/* Hospital Brand & Accreditation */}
          <a href="/" className="hospital-brand">
            <div className="brand-crest">
              <span className="crest-cross">✚</span>
            </div>
            <div className="brand-copy">
              <div className="brand-main-row">
                <span className="brand-hospital-name">CLINICIFY</span>
                <span className="brand-accreditation">
                  <span className="acc-dot" /> NABH
                </span>
              </div>
              <span className="brand-facility-desc">HOSPITAL & MEDICAL CENTER</span>
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="header-nav" aria-label="Main Navigation">
            <a href="#board" className="header-nav-link active">
              <span className="live-status-pip" />
              <span>Live OPD Board</span>
            </a>
            <a href="#features" className="header-nav-link">
              <span>Clinical Services</span>
            </a>
            <a href="#workflow" className="header-nav-link">
              <span>Patient Guide</span>
            </a>
            <a href="#timings" className="header-nav-link">
              <span>Hours & Location</span>
            </a>
          </nav>

          {/* Right Action Elements */}
          <div className="header-right-actions">
            <a href="tel:+918041235600" className="header-helpline-pill" title="Call OPD Desk">
              <div className="helpline-icon-wrap">
                <PhoneCall size={13} />
              </div>
              <div className="helpline-text-wrap">
                <span className="helpline-label">OPD Helpdesk</span>
                <span className="helpline-num">(080) 4123-5600</span>
              </div>
            </a>

            <button
              className="staff-portal-btn"
              onClick={() => setIsLoginOpen(true)}
              title="Restricted to clinical staff"
            >
              <Lock size={13} className="portal-lock-icon" />
              <span>Staff Portal</span>
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              className="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="mobile-nav-drawer">
            <nav className="mobile-nav-links">
              <a href="#board" onClick={() => setMobileMenuOpen(false)}>
                Live OPD Board
              </a>
              <a href="#features" onClick={() => setMobileMenuOpen(false)}>
                Clinical Services
              </a>
              <a href="#workflow" onClick={() => setMobileMenuOpen(false)}>
                Patient Guide
              </a>
              <a href="#timings" onClick={() => setMobileMenuOpen(false)}>
                Hours & Location
              </a>
            </nav>
            <div className="mobile-drawer-footer">
              <a href="tel:+918041235600" className="mobile-helpline-link">
                <PhoneCall size={15} />
                <span>OPD Helpdesk: (080) 4123-5600</span>
              </a>
              <button
                className="staff-portal-btn full-width"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setIsLoginOpen(true);
                }}
              >
                <Lock size={14} />
                <span>Staff Portal Sign In</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero Section ── */}
      <section className="landing-hero" id="board">
        <div className="hero-container">
          <div className="hero-text-col">
            <div className="hero-tag">
              <Building2 size={14} />
              <span>Outpatient Department & Consultation Center</span>
            </div>

            <h1 className="hero-heading">
              Live OPD queue status.
              <br />
              <span className="hero-heading-gradient">Know your doctor's consultation wait.</span>
            </h1>

            <p className="hero-description">
              Check real-time consulting room queues, doctor schedules, and estimated wait times before
              or during your hospital visit. Printed token slips include instant mobile tracking so you
              can rest comfortably in our lounges.
            </p>

            <div className="hero-cta-group">
              <button className="primary-action-btn" onClick={() => setIsLoginOpen(true)}>
                <span>Clinical Staff Sign In</span>
                <ArrowRight size={16} />
              </button>
              <a href="#workflow" className="secondary-action-btn">
                <span>Patient Visit Guide</span>
              </a>
            </div>

            <div className="hero-trust-row">
              <div className="trust-item">
                <CheckCircle2 size={15} />
                <span>Walk-in and prior appointments accepted</span>
              </div>
              <div className="trust-item">
                <CheckCircle2 size={15} />
                <span>Instant thermal token slip with mobile QR code</span>
              </div>
              <div className="trust-item">
                <CheckCircle2 size={15} />
                <span>24/7 Emergency & trauma wing open</span>
              </div>
            </div>
          </div>

          {/* Interactive 3D Hero Console & Live Queue Board */}
          <div className="hero-visual-col">
            <InteractiveHero3D onOpenLogin={() => setIsLoginOpen(true)} />
          </div>
        </div>
      </section>

      {/* ── Metrics Strip ── */}
      <HospitalMetrics />

      {/* ── Clinical Facilities Showcase ── */}
      <BentoFeatures />

      {/* ── Patient Visit Guide Steps ── */}
      <section className="workflow-section" id="workflow">
        <div className="workflow-inner">
          <div className="section-eyebrow">
            <Clock size={14} />
            <span>Patient Visit Guide</span>
          </div>
          <h2 className="section-main-heading">
            What to expect during your outpatient consultation.
          </h2>
          <p className="section-sub-heading">
            Our digital token system ensures fair, orderly consultations without corridor crowding.
          </p>

          <div className="workflow-steps-grid">
            <div className="workflow-step-card">
              <div className="step-badge">Step 01</div>
              <div className="step-icon-wrap">
                <Printer size={22} />
              </div>
              <h3>Reception & Token Slip</h3>
              <p>
                Our front desk captures patient information, assigns your doctor and consultation chamber,
                and provides a printed token slip with your estimated consultation window.
              </p>
              <div className="step-subdetail">
                <span>Active reception counters: #1 to #4</span>
              </div>
            </div>

            <div className="workflow-step-card">
              <div className="step-badge">Step 02</div>
              <div className="step-icon-wrap">
                <Tv size={22} />
              </div>
              <h3>Waiting Lounge & Mobile Tracking</h3>
              <p>
                Attendants and patients can rest in comfortable air-conditioned waiting lounges with
                live LED token screens, or scan the token QR code to track their position from the cafeteria.
              </p>
              <div className="step-subdetail">
                <span>Bilingual audio chimes announce each call</span>
              </div>
            </div>

            <div className="workflow-step-card">
              <div className="step-badge">Step 03</div>
              <div className="step-icon-wrap">
                <Laptop size={22} />
              </div>
              <h3>Doctor Consultation & Pharmacy</h3>
              <p>
                When your token is announced, proceed to the doctor's room. Prescriptions are sent
                digitally to our ground-floor dispensary for instant verification and quick pickup.
              </p>
              <div className="step-subdetail">
                <span>Itemized medicine receipts and instructions</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Hospital Timings & Location Section ── */}
      <section className="hardware-section" id="timings">
        <div className="hardware-inner">
          <div className="hardware-text">
            <div className="section-eyebrow">
              <Building2 size={14} />
              <span>Outpatient Schedules & Location</span>
            </div>
            <h2>Visit our hospital consultation wings.</h2>
            <p>
              Our multi-specialty outpatient clinics operate six days a week with experienced
              physicians across General Medicine, Cardiology, Pediatrics, Orthopedics, and ENT.
            </p>

            <div className="hardware-specs-list">
              <div className="spec-row">
                <span className="spec-title">OPD Consultation Hours:</span>
                <span className="spec-desc">Monday – Saturday: 8:00 AM – 8:00 PM (Sunday: 9:00 AM – 1:00 PM)</span>
              </div>
              <div className="spec-row">
                <span className="spec-title">Emergency & Trauma Wing:</span>
                <span className="spec-desc">Open 24 Hours, 365 Days with dedicated trauma team</span>
              </div>
              <div className="spec-row">
                <span className="spec-title">In-House Central Pharmacy:</span>
                <span className="spec-desc">Ground Floor, Open 24/7 for inpatient and outpatient dispensing</span>
              </div>
              <div className="spec-row">
                <span className="spec-title">Diagnostic & Lab Services:</span>
                <span className="spec-desc">Sample collection: 7:00 AM – 9:00 PM daily</span>
              </div>
            </div>
          </div>

          <div className="hardware-card-visual">
            <div className="hardware-kiosk-box">
              <div className="kiosk-status-badge">
                <span className="kiosk-dot" /> Hospital Helpdesk Active
              </div>
              <div className="kiosk-mock-screen">
                <div className="kiosk-header">
                  <MapPin size={13} style={{ display: "inline", marginRight: 4 }} />
                  MAIN HOSPITAL CAMPUS
                </div>
                <div className="kiosk-large-token" style={{ fontSize: "28px", letterSpacing: "normal" }}>
                  Clinicify Medical Center
                </div>
                <div className="kiosk-room">42 Healthcare Boulevard, Bangalore 560029</div>
                <div className="kiosk-chime-bar" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Ambulance size={14} color="#f87171" />
                  <span>24x7 Ambulance & Emergency: 1066</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final Hospital Call to Action ── */}
      <section className="landing-cta-section">
        <div className="cta-box-container">
          <div className="cta-icon-center">✚</div>
          <h2>Visiting our hospital today?</h2>
          <p>
            Our reception counters are open for walk-in token allocation. Hospital clinical staff,
            physicians, and pharmacists can access their respective departmental desks below.
          </p>

          <div className="cta-buttons">
            <button className="primary-action-btn large" onClick={() => setIsLoginOpen(true)}>
              <span>Clinical Staff Portal</span>
              <ArrowRight size={17} />
            </button>
          </div>

          <div className="cta-security-line">
            <ShieldCheck size={16} />
            <span>NABH Accredited Healthcare Institution · Department of Outpatient Services</span>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="footer-top">
            <div className="footer-brand">
              <div className="brand-symbol small">✚</div>
              <span className="brand-name">Clinicify Hospital</span>
            </div>
            <p className="footer-tagline">
              Comprehensive outpatient clinical services, organized token queues, and dedicated patient care.
            </p>
          </div>

          <div className="footer-links-row">
            <a href="#board">Live OPD Board</a>
            <a href="#features">Clinical Services</a>
            <a href="#workflow">Patient Guide</a>
            <a href="#timings">Hospital Hours & Location</a>
            <button className="footer-login-link" onClick={() => setIsLoginOpen(true)}>
              Clinical Staff Portal
            </button>
          </div>

          <div className="footer-bottom">
            <span>© 2025 Clinicify Hospital & Healthcare Institute. All rights reserved.</span>
            <span>Emergency Services available 24/7.</span>
          </div>
        </div>
      </footer>

      {/* ── Login Modal Dialog ── */}
      <LoginDialog
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        notify={notify}
      />
    </div>
  );
}
