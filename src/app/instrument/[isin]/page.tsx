import { InstrumentDetail } from "@/components/instrument-detail";

export const dynamic = "force-dynamic";

export default async function InstrumentPage({
  params,
}: {
  params: Promise<{ isin: string }>;
}) {
  const { isin } = await params;
  return (
    <div className="container mx-auto max-w-7xl p-6">
      <InstrumentDetail isin={isin} />
    </div>
  );
}
