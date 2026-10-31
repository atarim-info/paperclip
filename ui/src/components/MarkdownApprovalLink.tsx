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
  const { data } = useQuery({
    queryKey: queryKeys.approvals.detail(id),
    queryFn: () => approvalsApi.get(id),
    enabled: Boolean(selectedId && belongsToActiveRoute),
    staleTime: 60_000,
    retry: false,
  });
  // A cached approval from another company must never supply this label.
  const subject = belongsToActiveRoute && data && data.companyId === selectedId
    ? approvalSubject(data.payload)
    : null;
  const label = typeof children === "string" ? children.trim() : null;
  const opaqueLabel = label?.toLowerCase() === id || label === href;
  return (
    <Link to={href} title={subject ?? undefined} data-mention-kind="approval">
      {opaqueLabel && subject ? subject : children}
    </Link>
  );
}
