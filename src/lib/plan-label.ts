export function formatPlanLabel(planName: string | null | undefined) {
  const normalized = String(planName ?? "").trim().toLowerCase();
  if (normalized === "plan mensual") return "Plan Libre";
  return String(planName ?? "").trim() || "Sin plan";
}
