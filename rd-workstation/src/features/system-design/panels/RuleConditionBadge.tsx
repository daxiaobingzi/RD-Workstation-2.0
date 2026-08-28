export function RuleConditionBadge({ ruleCode, rules }: { ruleCode: string; rules: { id: string; code: string; condition_json?: string }[] }) {
  const rule = rules.find((r) => r.code === ruleCode || ruleCode.startsWith(r.code))
  if (!rule?.condition_json) return null
  return (
    <span className="ml-1.5 rounded-full bg-warn-soft px-1.5 py-0.5 font-mono text-[10px] text-warn" title="条件规则">
      条件 {rule.condition_json}
    </span>
  )
}