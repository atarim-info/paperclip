type MarkdownNode = {
  type: string;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
};

const UUID = "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
const APPROVAL_PATH = new RegExp(`^/(?:([^/]+)/)?approvals/(${UUID})/?$`, "i");
const CONTEXTUAL_APPROVAL = new RegExp(`\\b(?:board\\s+)?approval(?:\\s+request)?\\s+(${UUID})\\b`, "gi");

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

function rewrite(node: MarkdownNode) {
  // Deliberate links and code are authored content, not prose to auto-link.
  if (["link", "linkReference", "code", "inlineCode", "definition", "html"].includes(node.type)) return;
  if (!node.children) return;
  node.children = node.children.flatMap((child): MarkdownNode[] => {
    if (child.type !== "text" || !child.value) {
      rewrite(child);
      return [child];
    }
    const value = child.value;
    const result: MarkdownNode[] = [];
    let cursor = 0;
    for (const match of value.matchAll(CONTEXTUAL_APPROVAL)) {
      const id = match[1]!;
      const start = match.index! + match[0].length - id.length;
      result.push({ type: "text", value: value.slice(cursor, start) });
      result.push({ type: "link", url: `/approvals/${id.toLowerCase()}`, children: [{ type: "text", value: id }] });
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
