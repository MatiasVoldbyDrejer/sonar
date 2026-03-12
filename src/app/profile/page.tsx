import { ProfilePage } from "@/components/profile-page";

export const dynamic = "force-dynamic";

export default function Profile() {
  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
      <ProfilePage />
    </div>
  );
}
