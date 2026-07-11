import type { Metadata } from "next";
import FreightManager from "@/components/admin/FreightManager";

export const metadata: Metadata = { title: "Air Freight — Admin" };
export const dynamic = "force-dynamic";

export default function AirFreightPage() {
  return <FreightManager freightType="air" />;
}
