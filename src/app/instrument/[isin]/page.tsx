import { InstrumentDetail } from "@/components/instrument-detail";

export const dynamic = "force-dynamic";

export default async function InstrumentPage({
  params,
}: {
  params: Promise<{ isin: string }>;
}) {
  const { isin } = await params;
  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
      <InstrumentDetail isin={isin} />
    </div>
  );
}
