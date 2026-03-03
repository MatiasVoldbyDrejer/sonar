import { SettingsPage } from "@/components/settings-page";

export const dynamic = "force-dynamic";

export default function Settings() {
  return (
    <div className="container mx-auto max-w-7xl p-6">
      <SettingsPage />
    </div>
  );
}
