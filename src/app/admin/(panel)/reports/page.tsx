import type { Metadata } from "next";
import ReportsManager from "./ReportsManager";

export const metadata: Metadata = { title: "Reports — Admin" };

export default function ReportsPage() {
  return <ReportsManager />;
}
