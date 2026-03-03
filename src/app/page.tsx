import { Dashboard } from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
      <Dashboard />
    </div>
  );
}
