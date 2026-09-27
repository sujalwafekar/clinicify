"use client";

import { useEffect, useState, useRef } from "react";
import { motion, useInView } from "motion/react";

interface CounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}

export function AnimatedNumber({ value, duration = 1.6, prefix = "", suffix = "" }: CounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (!isInView) return;

    let startTime: number | null = null;
    let animationFrameId: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.floor(eased * value));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isInView, value, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {displayValue.toLocaleString()}
      {suffix}
    </span>
  );
}

export function HospitalMetrics() {
  const metrics = [
    {
      numeric: 42500,
      suffix: "+",
      label: "Patients consulted annually",
      detail: "Across multi-specialty outpatient clinics",
    },
    {
      numeric: 14,
      suffix: " min",
      label: "Average consultation window",
      detail: "Dedicated, thorough physician attention",
    },
    {
      numeric: 12,
      suffix: " clinics",
      label: "Specialized outpatient chambers",
      detail: "Medicine, Cardiology, Pediatrics & more",
    },
    {
      numeric: 100,
      suffix: "%",
      label: "In-house dispensary availability",
      detail: "Zero delay between prescription & pickup",
    },
  ];

  return (
    <section className="metrics-strip">
      <div className="metrics-inner">
        {metrics.map((m, idx) => (
          <motion.div
            key={m.label}
            className="metric-item"
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: idx * 0.1 }}
          >
            <div className="metric-value">
              <AnimatedNumber value={m.numeric} suffix={m.suffix} />
            </div>
            <div className="metric-label">{m.label}</div>
            <div className="metric-detail">{m.detail}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
