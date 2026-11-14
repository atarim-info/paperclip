type MarkdownNode = {
  type: string;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
};

const UUID = "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
const APPROVAL_PATH = new RegExp(`^/(?:([^/]+)/)?approvals/(${UUID}|[a-f0-9]{8})/?$`, "i");
const APPROVAL_ID = new RegExp(`^(?:${UUID}|[a-f0-9]{8})$`, "i");
const APPROVAL_CONTEXT = /\b(?:board\s+)?approval(?:\s+request)?\s*:?\s*$/i;
const REFERENCE_ID = new RegExp(`(?:${UUID}|[a-f0-9]{8})(?![\\w-])`, "gi");

/** Only local approval routes qualify. External sites can use the same path. */
export function parseApprovalReference(href: string | undefined) {
  if (!href || href.startsWith("//")) return null;
  let path = href;
  if (/^https?:\/\//i.test(href)) {
    if (typeof window === "undefined") return null;
    try {
      const url = new URL(href);
      if (url.origin !== window.location.origin) return null;
      path = `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return null;
    }
  }
  const match = path.split(/[?#]/, 1)[0]!.match(APPROVAL_PATH);
  if (!match) return null;
  return { id: match[2]!.toLowerCase(), companyPrefix: match[1] ?? null, href: path };
}

function inlineText(node: MarkdownNode): string {
  if (node.type === "text" || node.type === "inlineCode") return node.value ?? "";
  if (node.type === "strong" || node.type === "emphasis" || node.type === "delete") {
    return node.children?.map(inlineText).join("") ?? "";
  }
  return "\n";
}

function approvalLink(id: string): MarkdownNode {
  return { type: "link", url: `/approvals/${id.toLowerCase()}`, children: [{ type: "text", value: id }] };
}

function rewrite(node: MarkdownNode) {
  // Leave authored links and whole code samples alone. Only a standalone ID
  // immediately after an approval label can be recognized inside inline code.
  if (["link", "linkReference", "code", "inlineCode", "definition", "html"].includes(node.type)) return;
  if (!node.children) return;
  let preceding = "";
  node.children = node.children.flatMap((child): MarkdownNode[] => {
    const before = preceding;
    preceding += inlineText(child);
    if (child.type === "inlineCode" && child.value && APPROVAL_ID.test(child.value)
      && APPROVAL_CONTEXT.test(before)) {
      return [approvalLink(child.value)];
    }
    if (child.type !== "text" || !child.value) {
      rewrite(child);
      return [child];
    }
    const value = child.value;
    const result: MarkdownNode[] = [];
    let cursor = 0;
    for (const match of value.matchAll(REFERENCE_ID)) {
      const start = match.index!;
      if (!APPROVAL_CONTEXT.test(before + value.slice(0, start))) continue;
      const id = match[0];
      result.push({ type: "text", value: value.slice(cursor, start) });
      result.push(approvalLink(id));
      cursor = start + id.length;
    }
    if (!cursor) return [child];
    if (cursor < value.length) result.push({ type: "text", value: value.slice(cursor) });
    return result;
  });
}

export function remarkLinkApprovalReferences() {
  return (tree: MarkdownNode) => rewrite(tree);
}
