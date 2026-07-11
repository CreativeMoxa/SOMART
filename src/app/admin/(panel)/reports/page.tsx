import type { Metadata } from "next";
import ReportsManager from "./ReportsManager";

export const metadata: Metadata = { title: "Reports — Admin" };
export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return <ReportsManager initialTab={tab ?? ""} />;
}
