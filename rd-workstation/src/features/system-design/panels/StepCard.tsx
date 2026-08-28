export function StepCard({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-rule bg-surface p-4 shadow-sm">
      <h2 className="text-[14px] font-semibold">{title}</h2>
      {desc && <p className="mt-0.5 text-[12px] text-muted">{desc}</p>}
      <div className="mt-3">{children}</div>
    </div>
  )
}