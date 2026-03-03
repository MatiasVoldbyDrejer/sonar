import { DeepDive } from "@/components/deep-dive";

export const dynamic = "force-dynamic";

export default function DeepDivePage() {
  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
      <DeepDive />
    </div>
  );
}
