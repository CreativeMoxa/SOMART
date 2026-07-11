import type { Metadata } from "next";
import SettingsManager from "./SettingsManager";

export const metadata: Metadata = { title: "Settings — Admin" };
export const dynamic = "force-dynamic";

export default function AdminSettingsPage() {
  return <SettingsManager />;
}
