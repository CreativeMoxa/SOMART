import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Shipment } from "@/models/Shipment";
import { Product } from "@/models/Product";
import { Todo } from "@/models/Todo";
import { isAdmin } from "@/lib/auth";

// Computed alerts (arriving soon / delayed / recently received / low / out of
// stock). Derived live from data so nothing needs to be stored or cleared.
function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const today = dayKey(new Date());
    const soon = new Date();
    soon.setDate(soon.getDate() + 7);
    const soonKey = dayKey(soon);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [pending, products, todoDocs] = await Promise.all([
      Shipment.find({ status: { $ne: "received" } })
        .select("number name freightType status expectedArrival")
        .lean(),
      Product.find()
        .select("name slug stockQty minStock")
        .lean(),
      // Open to-do list items (not archived, not fully completed).
      Todo.find({ archived: { $ne: true } })
        .select("number title dueDate items")
        .sort({ dueDate: 1, createdAt: -1 })
        .lean(),
    ]);

    const recentlyReceived = await Shipment.find({
      status: "received",
      receivedAt: { $gte: weekAgo },
    })
      .select("number name freightType receivedAt")
      .sort({ receivedAt: -1 })
      .limit(10)
      .lean();

    const arrivingSoon = pending.filter(
      (s) => s.expectedArrival && s.expectedArrival >= today && s.expectedArrival <= soonKey
    );
    const delayed = pending.filter(
      (s) => s.expectedArrival && s.expectedArrival < today
    );
    const lowStock = products.filter(
      (p) => (p.stockQty ?? 0) > 0 && (p.stockQty ?? 0) <= (p.minStock ?? 5)
    );
    const outOfStock = products.filter((p) => (p.stockQty ?? 0) === 0);

    // A to-do is "done" only when it has items and every item is finished.
    const todos = todoDocs
      .filter((t) => !((t.items?.length ?? 0) > 0 && t.items.every((i) => i.done)))
      .map((t) => ({
        _id: String(t._id),
        number: t.number,
        title: t.title,
        dueDate: t.dueDate || "",
        overdue: Boolean(t.dueDate && t.dueDate < today),
      }));

    return NextResponse.json({
      counts: {
        arrivingSoon: arrivingSoon.length,
        delayed: delayed.length,
        recentlyReceived: recentlyReceived.length,
        lowStock: lowStock.length,
        outOfStock: outOfStock.length,
        todos: todos.length,
        total:
          arrivingSoon.length +
          delayed.length +
          lowStock.length +
          outOfStock.length +
          todos.length,
      },
      arrivingSoon,
      delayed,
      recentlyReceived,
      lowStock: lowStock.slice(0, 20),
      outOfStock: outOfStock.slice(0, 20),
      todos: todos.slice(0, 20),
    });
  } catch (err) {
    console.error("GET /api/notifications failed:", err);
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
  }
}
