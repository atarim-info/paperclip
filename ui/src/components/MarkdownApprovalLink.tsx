import { useQuery } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { Link } from "@/lib/router";
import { approvalsApi } from "../api/approvals";
import { useOptionalCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { approvalSubject } from "./ApprovalPayload";

export function MarkdownApprovalLink({
  id, href, companyPrefix, children,
}: {
  id: string;
  href: string;
  companyPrefix: string | null;
  children: ReactNode;
}) {
  const company = useOptionalCompany();
  const selectedId = company?.selectedCompanyId;
  const activePrefix = company?.companies.find((c) => c.id === selectedId)?.issuePrefix;
  const belongsToActiveRoute = !companyPrefix || companyPrefix.toUpperCase() === activePrefix?.toUpperCase();
  const short = /^[a-f0-9]{8}$/i.test(id);
  const { data: candidates } = useQuery({
    queryKey: queryKeys.approvals.list(selectedId ?? "__none__"),
    queryFn: () => approvalsApi.list(selectedId!),
    enabled: Boolean(short && selectedId && belongsToActiveRoute),
    staleTime: 60_000,
    retry: false,
  });
  const matches = short ? candidates?.filter((approval) =>
    approval.companyId === selectedId && approval.id.toLowerCase().startsWith(id.toLowerCase())) : undefined;
  const resolved = belongsToActiveRoute && matches?.length === 1 ? matches[0] : undefined;
  const { data: detail } = useQuery({
    queryKey: queryKeys.approvals.detail(id),
    queryFn: () => approvalsApi.get(id),
    // A copied example prefix must not suppress the authenticated ownership
    // lookup. Only the returned company ID can justify correcting a full UUID.
    enabled: Boolean(!short && selectedId),
    staleTime: 60_000,
    retry: false,
  });
  const data = short ? resolved : detail;
  // A cached approval from another company must never supply this label.
  const ownsActiveApproval = Boolean(data && data.companyId === selectedId);
  const subject = ownsActiveApproval && data
    ? approvalSubject(data.payload)
    : null;
  const label = typeof children === "string" ? children.trim() : null;
  const opaqueLabel = label?.toLowerCase() === id || label === href;
  // A short ID is never a valid destination until a unique company-scoped
  // match supplies the full UUID. Ambiguous and failed lookups stay readable.
  if (short && !resolved) return <>{children}</>;
  let destination = short && resolved ? href.replace(/(\/approvals\/)[a-f0-9]{8}(?=[/?#]|$)/i, `$1${resolved.id}`) : href;
  if (!short && ownsActiveApproval && activePrefix) {
    destination = destination.replace(/^\/(?:[^/]+\/)?approvals\//i, `/${activePrefix}/approvals/`);
  }
  return (
    <Link to={destination} title={subject ?? undefined} data-mention-kind="approval">
      {opaqueLabel && subject ? subject : children}
    </Link>
  );
}
