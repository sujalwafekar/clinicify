import { WaitingRoomDisplay } from "@/components/waiting-room-display";

export const metadata = {
  title: "Waiting Room | Clinicify",
  description: "Live token display for hospital waiting room TV.",
};

export default function WaitingRoomPage() {
  return (
    <main style={{
      width: "100vw",
      height: "100vh",
      overflow: "hidden",
      background: "#ffffff",
      display: "flex",
      flexDirection: "column",
    }}>
      <WaitingRoomDisplay />
    </main>
  );
}
