// Dedicated layout for TV display — clean container without duplicated html/body tags
export default function WaitingRoomLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ margin: 0, padding: 0, overflow: "hidden", width: "100vw", height: "100vh", background: "#ffffff" }}>
      {children}
    </div>
  );
}
