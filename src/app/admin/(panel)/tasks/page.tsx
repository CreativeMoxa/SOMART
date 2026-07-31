import type { Metadata } from "next";
import TaskManager from "./TaskManager";

export const metadata: Metadata = { title: "Task Manager — Admin" };
export const dynamic = "force-dynamic";

export default function TasksPage() {
  return <TaskManager />;
}
