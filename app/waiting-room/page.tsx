import { WaitingRoomDisplay } from "@/components/waiting-room-display";

export const metadata = {
  title: "Waiting Room Display | Tokens Called | Clinicify",
  description: "Live waiting room display board showing tokens called across hospital clinics and upcoming patient sequence.",
};

export default function WaitingRoomPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f0f9ff" }}>
      <WaitingRoomDisplay />
    </main>
  );
}
