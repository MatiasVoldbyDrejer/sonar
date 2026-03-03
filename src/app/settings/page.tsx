import { SettingsPage } from "@/components/settings-page";

export const dynamic = "force-dynamic";

export default function Settings() {
  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
      <SettingsPage />
    </div>
  );
}
