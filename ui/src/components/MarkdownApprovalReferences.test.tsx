// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarkdownBody } from "./MarkdownBody";
import { ThemeProvider } from "../context/ThemeContext";
import { queryKeys } from "../lib/queryKeys";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const company = { id: "company-1", issuePrefix: "ATA" };
vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({ selectedCompany: company }),
  useOptionalCompany: () => ({ selectedCompanyId: company.id, companies: [company] }),
}));
const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../api/approvals", () => ({ approvalsApi: api }));
const id = "93dca2a1-21c7-4b7b-a813-b7bb3643a6a5";
const title = "Approve merge of example PR";
const approval = { id, companyId: company.id, type: "request_board_approval", payload: { title } };
const clients: QueryClient[] = [];
afterEach(() => { clients.forEach((c) => c.clear()); clients.length = 0; vi.clearAllMocks(); });
function tree(markdown: string, seeded = true, value = approval) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  if (seeded) client.setQueryData(queryKeys.approvals.detail(id), value);
  return <QueryClientProvider client={client}><MemoryRouter initialEntries={["/ATA/issues/ATA-1"]}>
    <ThemeProvider><MarkdownBody>{markdown}</MarkdownBody></ThemeProvider>
  </MemoryRouter></QueryClientProvider>;
}
function render(markdown: string) { return renderToStaticMarkup(tree(markdown)); }

describe("Markdown approval references", () => {
  it.each([`/approvals/${id}`, `${window.location.origin}/approvals/${id}`, `/ATA/approvals/${id}`])(
    "uses a company-prefixed link and saved title for %s", (href) => {
      const html = render(`[${id}](${href})`);
      expect(html).toContain(`href="/ATA/approvals/${id}"`);
      expect(html).toContain(`>${title}</a>`);
      expect(html).not.toContain('target="_blank"');
    });
  it("links the approval UUID in the reported summary", () => {
    const html = render(`Requested board approval ${id}; waiting for that decision before merge.`);
    expect(html).toContain(`href="/ATA/approvals/${id}"`);
    expect(html).toContain(title);
    expect(html).toContain("; waiting for that decision before merge.");
  });
  it("preserves descriptive labels and query/fragment suffixes", () => {
    const html = render(`[Review this decision](/approvals/${id}?view=full#comments)`);
    expect(html).toContain(`href="/ATA/approvals/${id}?view=full#comments"`);
    expect(html).toContain(">Review this decision</a>");
  });
  it("does not rewrite external approvals or unrelated UUIDs or code", () => {
    const html = render(`[External](https://example.com/approvals/${id})\n\nRun ${id}\n\n\`approval ${id}\`\n\n\`\`\`text\napproval ${id}\n\`\`\``);
    expect(html).toContain(`href="https://example.com/approvals/${id}"`);
    expect(html).not.toContain('href="/ATA/approvals/');
    expect(html).toMatch(new RegExp(`<code[^>]*>approval ${id}</code>`));
  });
  it("keeps another company's explicit prefix and hides mismatched cached titles", () => {
    const html = renderToStaticMarkup(tree(`[${id}](/OTHER/approvals/${id})`, true,
      { ...approval, companyId: "other-company" }));
    expect(html).toContain(`href="/OTHER/approvals/${id}"`);
    expect(html).not.toContain(title);
  });
  it("keeps an unavailable approval readable and linked", () => {
    const html = renderToStaticMarkup(tree(`Requested board approval ${id}.`, false));
    expect(html).toContain(`href="/ATA/approvals/${id}"`);
    expect(html).toContain(id);
  });
  it("loads an uncached title once for repeated references", async () => {
    api.get.mockResolvedValue(approval);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () => { root.render(tree(`Approval ${id}. Board approval ${id}.`, false)); });
      await vi.waitFor(async () => {
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
        expect(host.textContent).toContain(title);
        expect(host.querySelectorAll(`a[href="/ATA/approvals/${id}"]`)).toHaveLength(2);
      });
      expect(api.get).toHaveBeenCalledTimes(1);
    } finally { await act(async () => root.unmount()); host.remove(); }
  });
  it("keeps a rejected lookup linked and readable without retrying", async () => {
    api.get.mockRejectedValue(new Error("Approval unavailable"));
    const host = document.createElement("div");
    const root = createRoot(host);
    try {
      await act(async () => { root.render(tree(`Board approval ${id}.`, false)); });
      await vi.waitFor(async () => {
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
        expect(api.get).toHaveBeenCalledTimes(1);
        expect(clients.at(-1)?.getQueryState(queryKeys.approvals.detail(id))?.status).toBe("error");
      });
      expect(host.querySelector("a")?.getAttribute("href")).toBe(`/ATA/approvals/${id}`);
      expect(host.textContent).toContain(id);
    } finally { await act(async () => root.unmount()); }
  });

});
