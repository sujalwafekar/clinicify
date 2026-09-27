"use client";

import { motion } from "motion/react";
import {
  QrCode,
  Smartphone,
  Pill,
  Tv,
  CheckCircle2,
  Clock,
  TrendingDown,
  Building2,
  FileCheck,
} from "lucide-react";

export function BentoFeatures() {
  return (
    <section className="bento-section" id="features">
      <div className="bento-inner">
        {/* Section Header */}
        <div className="bento-header">
          <div className="section-eyebrow">
            <Building2 size={14} />
            <span>Outpatient Facilities & Services</span>
          </div>
          <h2 className="bento-title">
            Organized clinical care centered on patient comfort.
          </h2>
          <p className="bento-desc">
            From the moment you arrive at our reception to your doctor's consultation and medicine pickup,
            our hospital ensures clear token tracking and comfortable waiting environments.
          </p>
        </div>

        {/* Bento Grid: Hospital Outpatient Highlights */}
        <div className="bento-grid">
          {/* Card 1: Printed Token Slip & Phone Tracking (Large) */}
          <motion.div
            className="bento-card bento-card-large"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <div className="bento-card-header">
              <div className="bento-card-icon blue">
                <Smartphone size={18} />
              </div>
              <div className="bento-card-title-group">
                <h3>Token Slip & Mobile Tracking</h3>
                <p>Track your place in line from the hospital waiting lounge or cafeteria.</p>
              </div>
            </div>

            {/* Visual: Realistic Patient Hospital Ticket */}
            <div className="ticket-preview-box">
              <div className="ticket-card">
                <div className="ticket-top">
                  <div className="ticket-hospital">CLINICIFY HOSPITAL · OPD</div>
                  <div className="ticket-date">Today · Counter #2</div>
                </div>
                <div className="ticket-body">
                  <div className="ticket-token">GM-204</div>
                  <div className="ticket-dept">General Medicine · Room 102</div>
                  <div className="ticket-doctor">Dr. Ramesh Gupta, MD</div>
                  <div className="ticket-status-row">
                    <span className="ticket-eta-pill">
                      <Clock size={12} /> Estimated Wait: ~12 mins
                    </span>
                    <span className="ticket-ahead-pill">2 patients ahead</span>
                  </div>
                </div>
                <div className="ticket-footer">
                  <div className="ticket-qr-placeholder">
                    <QrCode size={36} />
                  </div>
                  <div className="ticket-qr-text">
                    Scan with your mobile camera to see live consultation progress. No app download needed.
                  </div>
                </div>
              </div>
            </div>

            <div className="bento-card-footer">
              <div className="bento-feature-point">
                <CheckCircle2 size={15} />
                <span>Printed receipt with allocated room number and physician name</span>
              </div>
              <div className="bento-feature-point">
                <CheckCircle2 size={15} />
                <span>Patients and attendants can comfortably sit in any lounge without missing their turn</span>
              </div>
            </div>
          </motion.div>

          {/* Card 2: Consultation Room Pacing */}
          <motion.div
            className="bento-card"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="bento-card-header">
              <div className="bento-card-icon green">
                <TrendingDown size={18} />
              </div>
              <div className="bento-card-title-group">
                <h3>Dedicated Consultation Time</h3>
                <p>Our physicians allocate unhurried time based on patient clinical needs.</p>
              </div>
            </div>

            <div className="pacing-viz-box">
              <div className="pacing-header">
                <span className="pacing-metric-big">12.4 min</span>
                <span className="pacing-metric-sub">Average consultation window</span>
              </div>

              {/* Bar visualization */}
              <div className="pacing-bars">
                <div className="pacing-bar-group">
                  <div className="bar-track">
                    <div className="bar-fill" style={{ height: "45%" }} />
                  </div>
                  <span className="bar-label">Follow-up (6m)</span>
                </div>
                <div className="pacing-bar-group">
                  <div className="bar-track">
                    <div className="bar-fill active" style={{ height: "80%" }} />
                  </div>
                  <span className="bar-label">General (12m)</span>
                </div>
                <div className="pacing-bar-group">
                  <div className="bar-track">
                    <div className="bar-fill" style={{ height: "95%" }} />
                  </div>
                  <span className="bar-label">Comprehensive (19m)</span>
                </div>
              </div>

              <div className="pacing-callout">
                <Clock size={13} />
                <span>Wait estimations adapt dynamically if a doctor handles an acute emergency case.</span>
              </div>
            </div>
          </motion.div>

          {/* Card 3: In-House Hospital Dispensary */}
          <motion.div
            className="bento-card"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <div className="bento-card-header">
              <div className="bento-card-icon purple">
                <Pill size={18} />
              </div>
              <div className="bento-card-title-group">
                <h3>Direct Dispensary Dispatch</h3>
                <p>Prescriptions route directly from the doctor's desk to our ground-floor pharmacy.</p>
              </div>
            </div>

            <div className="rx-preview-box">
              <div className="rx-item">
                <div className="rx-dot" />
                <div className="rx-info">
                  <div className="rx-name">Paracetamol 650mg</div>
                  <div className="rx-dosage">1 tablet · Thrice daily · 5 days</div>
                </div>
                <span className="rx-stock-badge in-stock">Ready at Counter</span>
              </div>
              <div className="rx-item">
                <div className="rx-dot" />
                <div className="rx-info">
                  <div className="rx-name">Amoxicillin 500mg</div>
                  <div className="rx-dosage">1 capsule · Twice daily · 7 days</div>
                </div>
                <span className="rx-stock-badge in-stock">Ready at Counter</span>
              </div>
              <div className="rx-item">
                <div className="rx-dot" />
                <div className="rx-info">
                  <div className="rx-name">Cetirizine 10mg</div>
                  <div className="rx-dosage">1 tablet · Bedtime · 3 days</div>
                </div>
                <span className="rx-stock-badge in-stock">Ready at Counter</span>
              </div>
            </div>

            <div className="bento-card-footer">
              <div className="bento-feature-point">
                <FileCheck size={14} />
                <span>Zero handwritten script errors · Itemized billing and medication guidance upon pickup</span>
              </div>
            </div>
          </motion.div>

          {/* Card 4: Waiting Lounge Public Displays (Wide) */}
          <motion.div
            className="bento-card bento-card-wide"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <div className="bento-card-header">
              <div className="bento-card-icon amber">
                <Tv size={18} />
              </div>
              <div className="bento-card-title-group">
                <h3>Audio-Visual Waiting Hall Screens</h3>
                <p>Large LED display monitors and chime announcements installed across every outpatient wing.</p>
              </div>
            </div>

            <div className="tv-preview-mockup">
              <div className="tv-screen-bezel">
                <div className="tv-screen-content">
                  <div className="tv-screen-header">
                    <span className="tv-hospital-title">CLINICIFY HOSPITAL · MAIN OPD WAITING HALL</span>
                    <span className="tv-screen-clock">10:42 AM</span>
                  </div>
                  <div className="tv-screen-split">
                    <div className="tv-screen-column serving-now">
                      <div className="tv-col-label">NOW SERVING</div>
                      <div className="tv-token-display">GM-204</div>
                      <div className="tv-sub-info">Room 102 · Dr. Ramesh Gupta</div>
                    </div>
                    <div className="tv-screen-column next-list">
                      <div className="tv-col-label">NEXT TO CONSULT</div>
                      <div className="tv-next-row">
                        <span className="token-tag">GM-205</span>
                        <span className="token-desc">Rahul Patel</span>
                        <span className="token-status">Proceed to Room 102</span>
                      </div>
                      <div className="tv-next-row">
                        <span className="token-tag">CR-108</span>
                        <span className="token-desc">Mohan Lal</span>
                        <span className="token-status">Room 204 (Cardiology)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bento-card-footer">
              <div className="bento-feature-point">
                <CheckCircle2 size={15} />
                <span>Bilingual audio chimes and clear visual room directions assist all visiting patients</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
