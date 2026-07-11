import type { Metadata } from "next";
import FreightManager from "@/components/admin/FreightManager";

export const metadata: Metadata = { title: "Sea Freight — Admin" };
export const dynamic = "force-dynamic";

export default function SeaFreightPage() {
  return <FreightManager freightType="sea" />;
}
