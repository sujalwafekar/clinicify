# Clinicify - Tech Stack & Architecture

## Overview
Clinicify is a modern, web-based healthcare management platform. It uses a component-based architecture and relies heavily on real-time data synchronization for queuing, reforecasting, and role-based workflows (Admin, Doctor, Receptionist, Pharmacist).

## Core Technologies

### 1. Framework & Runtime
- **Next.js (v15.5.7)**: The React framework used for building the application. It handles routing, server-side API routes, and optimized builds.
- **React (v19.1.1)**: The core UI library used for building interactive interfaces and components.
- **TypeScript**: Used extensively throughout the project to ensure type safety, robust interfaces, and maintainable code.

### 2. Backend & Database
- **Firebase (v12.4.0)**: Used as the primary Backend-as-a-Service (BaaS).
  - **Firebase Authentication**: Handles secure user login and role management.
  - **Firestore**: The NoSQL database used to store real-time state for queues, patients, clinics, and user roles. 
- **Firebase Admin SDK (v13.4.0)**: Used securely on the server side (Next.js API routes) to interact with Firebase with elevated privileges (e.g., verifying tokens, resetting states, pushing real-time updates).

### 3. UI, Styling & Animations
- **CSS / Globals**: Vanilla CSS styling configured in `globals.css`.
- **Framer Motion (`motion` v13.4.4)**: Used for smooth transitions, layout changes, and dynamic micro-animations across the UI (e.g., queue updates).
- **Spline (`@splinetool/react-spline`)**: Integrated for interactive, 3D visual experiences (often used on landing/hero sections).
- **Lucide React (`lucide-react`)**: Consistent, clean vector icons used throughout the dashboard and components.

### 4. Communication & Notifications
- **Resend (v6.1.1)**: Integrated into server-side queues to handle transactional emails (e.g., notifying patients of their queue status or estimated wait times).

## Architecture Highlights

1. **Role-Based Architecture**: 
   A top-level wrapper handles `onAuthStateChanged`. Once logged in, users are dynamically routed to specific live dashboards (Admin, Doctor, Receptionist, Pharmacist) based on their assigned role in Firestore.

2. **Real-Time Queue Management**:
   The `queue-service.ts` logic dictates how patients move through different statuses (waiting, in-consultation, pharmacy). Firestore listeners dynamically push these changes to the frontend without requiring manual refreshes.

3. **Duration & Reforecasting Model**:
   Server-side utilities (e.g., `duration-model.ts`) calculate expected wait times and adjust the clinic's schedule in real-time as appointments run over or finish early.

4. **Security & Validation**:
   - `firestore.rules` ensures strict database read/write protections per user role.
   - Next.js API routes securely validate operations using Firebase Admin credentials injected via environment variables (`FIREBASE_ADMIN_CREDENTIAL_JSON`).

## Development & Deployment
- **Local Dev Server**: `npm run dev` (Next.js dev server).
- **Deployment**: Configured to deploy seamlessly to **Vercel**, taking advantage of their edge network and serverless functions for API endpoints.
- **Environment Management**: Secrets are managed via `.env.local` for local development and securely injected into the Vercel production environment.
