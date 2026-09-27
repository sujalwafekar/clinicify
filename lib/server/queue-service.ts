import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import { adminDb } from "@/lib/firebase/admin";
import { DURATION_MINUTES, uncertaintyFor } from "@/lib/domain/queue";
import type { ComplaintCategory, Role } from "@/lib/domain/types";
import { sendNotification } from "./notifications";
import { buildVisitConfirmationEmail, buildQueueUpdateEmail } from "./email-templates";
import { predictDuration } from "./duration-model";
const buffer = 2; const arrivalBuffer = 10;
const queueId = (doctorId: string) => `H1-${new Date().toISOString().slice(0, 10)}-Q-${doctorId}`;
const eta = (minutes: number, now: number) => ({ etaLower: Timestamp.fromMillis(now + Math.max(0, minutes - uncertaintyFor(minutes)) * 60000), etaUpper: Timestamp.fromMillis(now + (minutes + uncertaintyFor(minutes)) * 60000), recommendedArrival: Timestamp.fromMillis(now + Math.max(0, minutes - uncertaintyFor(minutes) - arrivalBuffer) * 60000) });

export async function getPatientsAhead(doctorId: string, visitId: string, priorityLevel: number, sequenceNumber: number) {
  const db = adminDb();
  const ahead = await db.collection("visits").where("doctorId", "==", doctorId).get();
  return ahead.docs.filter(doc => {
    const other = doc.data();
    if (other.status !== "waiting") return false;
    return doc.id !== visitId && ((other.priorityLevel ?? 0) > priorityLevel || ((other.priorityLevel ?? 0) === priorityLevel && (other.sequenceNumber ?? 0) < sequenceNumber));
  }).length;
}

export async function reforecastDoctorQueue(doctorId: string, actorUid: string, reason?: string) {
  const db = adminDb(); const now = Date.now();
  const doctorRef = db.collection("doctors").doc(doctorId);
  const doctor = (await doctorRef.get()).data(); if (!doctor) throw new Error("Doctor not found");
  const snapshot = await db.collection("visits").where("doctorId", "==", doctorId).get();
  
  const visits = snapshot.docs
    .filter(d => d.data().status === "waiting")
    .map(d => {
    const data = d.data();
    return {
      id: d.id,
      previousEtaLower: data.etaLower?.toMillis?.() as number | undefined,
      previousEtaUpper: data.etaUpper?.toMillis?.() as number | undefined,
      previousRecommendedArrival: data.recommendedArrival?.toMillis?.() as number | undefined,
      email: data.email as string | undefined,
      trackingKey: data.trackingKey as string | undefined,
      token: data.token as string,
      ...data
    };
  }).sort((a: any, b: any) => (b.priorityLevel ?? 0) - (a.priorityLevel ?? 0) || (a.priorityInsertedAt?.toMillis?.() ?? 0) - (b.priorityInsertedAt?.toMillis?.() ?? 0) || (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0));
  
  let workload = doctor.status === "paused" ? 15 : 0;
  if (doctor.currentVisitId) { const current = await db.collection("visits").doc(doctor.currentVisitId).get(); const active = current.data(); if (active?.consultationStartedAt) workload += Math.max((active.predictedDurationMin ?? 8) - Math.floor((now - active.consultationStartedAt.toMillis()) / 60000), 2); }
  const batch = db.batch();
  
  const materiallyAffectedVisits = [];

  for (const visit of visits) { 
    const newEta = eta(workload, now);
    let etaUpdateReason = null;

    if (reason && visit.previousEtaLower) {
      const diffLower = Math.abs(newEta.etaLower.toMillis() - visit.previousEtaLower);
      const diffRecommended = visit.previousRecommendedArrival ? Math.abs(newEta.recommendedArrival.toMillis() - visit.previousRecommendedArrival) : 0;
      
      if (diffLower >= 5 * 60000 || diffRecommended >= 5 * 60000) {
        etaUpdateReason = reason;
        if (visit.email && visit.trackingKey) {
          materiallyAffectedVisits.push({
            id: visit.id,
            email: visit.email,
            token: visit.token,
            previousEtaLower: visit.previousEtaLower,
            previousEtaUpper: visit.previousEtaUpper,
            newEtaLower: newEta.etaLower.toMillis(),
            newEtaUpper: newEta.etaUpper.toMillis(),
            recommendedArrival: newEta.recommendedArrival.toMillis(),
            trackingKey: visit.trackingKey
          });
        }
      }
    }

    batch.update(db.collection("visits").doc(visit.id), { 
      ...newEta, 
      etaRevisionCount: FieldValue.increment(1), 
      lastReforecastAt: FieldValue.serverTimestamp(),
      ...(etaUpdateReason ? { etaUpdateReason } : {})
    }); 
    workload += ((visit as any).predictedDurationMin ?? 8) + buffer; 
  }
  
  batch.set(db.collection("queues").doc(queueId(doctorId)), { hospitalId: "H1", doctorId, departmentId: doctor.departmentId, date: new Date().toISOString().slice(0,10), currentVisitId: doctor.currentVisitId ?? null, paused: doctor.status === "paused", lastReforecastAt: FieldValue.serverTimestamp(), actorUid }, { merge: true });
  await batch.commit();
  
  return materiallyAffectedVisits;
}

export async function createVisit(input: { patient: { name: string; age: number; mobile: string; email?: string }; doctorId: string; complaint: string; complaintCategory: ComplaintCategory; departmentId: string; isPriority?: boolean }, actorUid: string) {
  const db = adminDb(); const existing = await db.collection("patients").where("mobile", "==", input.patient.mobile).limit(1).get(); const patientRef = existing.docs[0]?.ref ?? db.collection("patients").doc(); const visitRef = db.collection("visits").doc();
  // Determine Clinic number from doctor's room (e.g. "Room 3" -> 3, "Room 1" -> 1)
  const docSnapEarly = await db.collection("doctors").doc(input.doctorId).get();
  const docRoom = docSnapEarly.data()?.room ?? "";
  const clinicMatch = String(docRoom).match(/\d+/);
  const clinicNum = clinicMatch ? clinicMatch[0] : "1";

  // Determine sequential token number starting from 15 (e.g. C1-15, C1-16, C1-17...)
  const doctorVisitsSnap = await db.collection("visits").where("doctorId", "==", input.doctorId).get();
  let maxSeq = 14;
  doctorVisitsSnap.docs.forEach(d => {
    const t = d.data().token;
    if (typeof t === "string") {
      const m = t.match(/-(\d+)$/);
      if (m) {
        const num = parseInt(m[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
  });
  const token = `C${clinicNum}-${maxSeq + 1}`;
  const prediction = await predictDuration(input.doctorId, input.complaintCategory);
  const duration = prediction.minutes;
  const trackingKey = randomUUID();
  const priorityLevel = input.isPriority ? 1 : 0;
  const sequenceNumber = input.isPriority ? -Date.now() : Date.now();
  await db.runTransaction(async tx => { tx.set(patientRef, { name: input.patient.name, age: input.patient.age, mobile: input.patient.mobile, email: input.patient.email ?? null, hospitalPatientNumber: existing.docs[0]?.data().hospitalPatientNumber ?? `P-${patientRef.id.slice(-6)}`, updatedAt: FieldValue.serverTimestamp(), ...(existing.empty ? { createdAt: FieldValue.serverTimestamp() } : {}) }, { merge: true }); tx.set(visitRef, { patientId: patientRef.id, patientName: input.patient.name, age: input.patient.age, mobile: input.patient.mobile, hospitalId: "H1", departmentId: input.departmentId, doctorId: input.doctorId, token, trackingKey, email: input.patient.email ?? null, complaintText: input.complaint, complaintCategory: input.complaintCategory, priorityLevel, sequenceNumber, status: "waiting", predictedDurationMin: duration, registeredAt: FieldValue.serverTimestamp(), ...(input.isPriority ? { priorityInsertedAt: FieldValue.serverTimestamp() } : {}) }); tx.set(db.collection("queueEvents").doc(), { queueId: queueId(input.doctorId), visitId: visitRef.id, eventType: "VISIT_CREATED", actorUid, createdAt: FieldValue.serverTimestamp(), affectedQueueIds: [queueId(input.doctorId)] }); });
  const affectedVisits = await reforecastDoctorQueue(input.doctorId, actorUid, input.isPriority ? "PRIORITY_INSERTION" : undefined);
  const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/track/${trackingKey}`;
  
  // Fetch authoritative state for the emails
  const [visitSnap, docSnap] = await Promise.all([
    visitRef.get(),
    db.collection("doctors").doc(input.doctorId).get()
  ]);
  const visitData = visitSnap.data();
  const doctorData = docSnap.data();

  if (visitData && doctorData) {
    const doctorName = doctorData.name ?? "Clinic";
    const doctorRoom = doctorData.room;
    const department = doctorData.department ?? input.departmentId;

    // Send emails to affected patients if priority insertion caused shifts
    if (input.isPriority && affectedVisits.length > 0) {
      const emailPromises = affectedVisits.map(async (v) => {
        if (!v.email) return;
        const vTrackingUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/track/${v.trackingKey}`;
        try {
          await sendNotification({
            visitId: v.id,
            recipient: v.email,
            type: "ETA_UPDATED",
            subject: `Clinicify Queue Update — Token ${v.token}`,
            html: buildQueueUpdateEmail({
              token: v.token,
              doctorName,
              previousEtaLower: v.previousEtaLower,
              previousEtaUpper: v.previousEtaUpper,
              newEtaLower: v.newEtaLower,
              newEtaUpper: v.newEtaUpper,
              recommendedArrival: v.recommendedArrival,
              trackingUrl: vTrackingUrl
            })
          });
        } catch (err) {
          console.error("[QueueService] Failed to send shift notification:", err);
        }
      });
      await Promise.all(emailPromises);
    }
    
    // Calculate patients ahead for the new patient
    const patientsAhead = await getPatientsAhead(input.doctorId, visitRef.id, priorityLevel, sequenceNumber);
    
    // Send VISIT_CREATED email using authoritative ETA
    if (input.patient.email) {
      try {
        await sendNotification({ 
          visitId: visitRef.id, 
          recipient: input.patient.email, 
          type: "VISIT_CREATED", 
          subject: `Clinicify Visit Confirmation — Token ${token}`, 
          html: buildVisitConfirmationEmail({
            token,
            doctorName,
            department,
            room: doctorRoom,
            etaLower: visitData.etaLower?.toMillis() ?? Date.now(),
            etaUpper: visitData.etaUpper?.toMillis() ?? Date.now(),
            recommendedArrival: visitData.recommendedArrival?.toMillis() ?? Date.now(),
            patientsAhead: Math.max(0, patientsAhead),
            trackingUrl
          })
        });
      } catch (err) {
        console.error("[QueueService] Failed to send visit confirmation notification:", err);
      }
    }
  }
  
  return { visitId: visitRef.id, token, trackingUrl };
}

export async function insertPriorityVisit(visitId: string, doctorId: string, actorUid: string, actorRole: Role) {
  if (!(["receptionist", "admin"] as Role[]).includes(actorRole)) throw new Error("Permission denied: Only authorised staff may insert a priority case.");
  
  const db = adminDb(); const visitRef = db.collection("visits").doc(visitId); 
  const visitSnap = await visitRef.get(); 
  if (!visitSnap.exists) throw new Error("Visit not found");
  const visitData = visitSnap.data()!;
  
  if (visitData.priorityLevel === 1) {
    const err = new Error("Patient is already marked priority.");
    err.name = "ConflictError";
    throw err;
  }
  
  const oldDoctorId = visitData.doctorId;
  if (oldDoctorId && oldDoctorId !== doctorId) {
    const err = new Error("Transfer the patient before marking priority.");
    err.name = "BadRequestError";
    throw err;
  }
  
  await visitRef.update({ 
    priorityLevel: 1, 
    priorityInsertedAt: FieldValue.serverTimestamp(), 
    sequenceNumber: -Date.now() 
  });
  
  await db.collection("queueEvents").add({ 
    queueId: queueId(doctorId), 
    visitId, 
    eventType: "PRIORITY_INSERTED", 
    actorUid, 
    createdAt: FieldValue.serverTimestamp(), 
    metadata: { authorized: true }, 
    affectedQueueIds: [queueId(doctorId)] 
  });
  
  const affectedVisits = await reforecastDoctorQueue(doctorId, actorUid, "PRIORITY_REFORECAST");
  
  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  const emailPromises = affectedVisits.map(async (v) => {
    const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/track/${v.trackingKey}`;
    const prevRange = `${formatTime(v.previousEtaLower)}${v.previousEtaUpper ? ` – ${formatTime(v.previousEtaUpper)}` : ""}`;
    const newRange = `${formatTime(v.newEtaLower)} – ${formatTime(v.newEtaUpper)}`;
    
    await sendNotification({
      visitId: v.id,
      recipient: v.email,
      type: "ETA_UPDATED",
      subject: "Clinicify Queue Update",
      html: `
        <p>Your expected consultation time has changed.</p>
        <p>Previous expected consultation:<br/><strong>${prevRange}</strong></p>
        <p>Updated expected consultation:<br/><strong>${newRange}</strong></p>
        <p>Recommended arrival:<br/><strong>${formatTime(v.recommendedArrival)}</strong></p>
        <p>Reason:<br/><strong>A priority case affected your doctor's queue.</strong></p>
        <br/>
        <p><a href="${trackingUrl}">Track My Queue</a></p>
      `
    });
  });
  
  await Promise.all(emailPromises);
}
