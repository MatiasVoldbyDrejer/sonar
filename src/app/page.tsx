import { Dashboard } from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="container mx-auto max-w-7xl p-6">
      <Dashboard />
    </div>
  );
}
