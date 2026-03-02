import { InstrumentDetail } from "@/components/instrument-detail";

export const dynamic = "force-dynamic";

export default async function InstrumentPage({
  params,
}: {
  params: Promise<{ isin: string }>;
}) {
  const { isin } = await params;
  return <InstrumentDetail isin={isin} />;
}
