import type { Metadata } from "next";
import TodoManager from "./TodoManager";

export const metadata: Metadata = { title: "To-Do List — Admin" };
export const dynamic = "force-dynamic";

export default function AdminTodosPage() {
  return <TodoManager />;
}
