import { OrganizationRecord } from "./types";

function compactName(input: string): string {
  const cleaned = input
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length === 0) return "ORG";
  if (parts[0].length >= 4) return parts[0].slice(0, 8);
  return parts.slice(0, 3).map((p) => p[0]).join("");
}

function nextNumberForShortName(shortName: string, existing: OrganizationRecord[]): number {
  const prefix = `ORG-${shortName}-`;
  const used = existing
    .map((o) => o.organization_code)
    .filter((c) => c.startsWith(prefix))
    .map((c) => Number(c.slice(prefix.length)))
    .filter((n) => Number.isFinite(n));

  return used.length === 0 ? 1 : Math.max(...used) + 1;
}

export function generateOrganizationCode(name: string, existing: OrganizationRecord[]): string {
  const shortName = compactName(name);
  const num = nextNumberForShortName(shortName, existing);
  return `ORG-${shortName}-${String(num).padStart(3, "0")}`;
}
