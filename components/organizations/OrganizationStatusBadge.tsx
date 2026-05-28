import { OrganizationStatus } from "../../lib/organizations/types";

const COLOR_BY_STATUS: Record<OrganizationStatus, string> = {
  Draft: "#6b7280",
  Active: "#059669",
  "On Hold": "#d97706",
  Suspended: "#dc2626",
  Inactive: "#4b5563"
};

export function OrganizationStatusBadge({ status }: { status: OrganizationStatus }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        color: "white",
        backgroundColor: COLOR_BY_STATUS[status],
        fontSize: 12,
        fontWeight: 600
      }}
    >
      {status}
    </span>
  );
}
