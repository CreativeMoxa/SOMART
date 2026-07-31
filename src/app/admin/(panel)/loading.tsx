// Shown instantly on navigation while the module's data loads on the server,
// so tapping a sidebar link gives immediate feedback instead of a blank wait.
export default function PanelLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-3 w-24 rounded bg-line" />
      <div className="mt-3 h-8 w-64 rounded bg-line" />
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl border border-line bg-surface" />
        ))}
      </div>
      <div className="mt-6 h-64 rounded-2xl border border-line bg-surface" />
    </div>
  );
}
