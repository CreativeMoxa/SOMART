import type { Metadata } from "next";
import InventoryManager from "./InventoryManager";

export const metadata: Metadata = { title: "Inventory — Admin" };
export const dynamic = "force-dynamic";

export default function InventoryPage() {
  return <InventoryManager />;
}
