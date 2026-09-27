// No shared app shell — TV display needs a completely clean full-screen page
export default function WaitingRoomLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, overflow: "hidden", width: "100vw", height: "100vh", background: "#ffffff" }}>
        {children}
      </body>
    </html>
  );
}
