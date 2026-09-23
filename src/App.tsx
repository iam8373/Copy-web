export default function App() {
  return (
    <main
      style={{
        minHeight: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 640,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 40,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span
            style={{
              fontSize: 12,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "var(--accent)",
              fontWeight: 600,
            }}
          >
            Copy Web
          </span>
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.2 }}>
            Your development environment is running
          </h1>
          <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.6 }}>
            This starter was scaffolded because the repository was empty. It
            runs on Vite + React + TypeScript inside Docker, and is ready for
            you to build on.
          </p>
        </div>

        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "grid",
            gap: 12,
          }}
        >
          {[
            ["Frontend", "Vite dev server on port 3000"],
            ["Entry point", "src/App.tsx"],
            ["Container", "docker-compose.alloy.yaml"],
          ].map(([label, value]) => (
            <li
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                padding: "12px 16px",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                fontSize: 14,
              }}
            >
              <span style={{ color: "var(--muted)" }}>{label}</span>
              <span style={{ fontWeight: 600 }}>{value}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
