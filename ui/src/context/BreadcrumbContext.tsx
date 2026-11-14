import { createContext, useCallback, useContext, useEffect, useState, type ReactNode, type MouseEventHandler } from "react";

export interface Breadcrumb {
  label: string;
  href?: string;
  /** Optional handler for preserving local work before navigating. */
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  /**
   * Optional task identifier (e.g. "PAP-1204") rendered in gray monospace
   * between the leading glyph and the label.
   */
  identifier?: string;
  /** Task status used for the browser tab badge. */
  taskStatus?: string;
  /** Optional node rendered before the label (e.g. a status glyph). */
  leading?: ReactNode;
  /**
   * Stable identity for `leading` so equality/diffing works without comparing
   * React nodes by reference (which always differ across renders). Set this to
   * a primitive that changes only when the rendered `leading` should change.
   */
  leadingKey?: string;
  /** Optional action beside the label, outside the breadcrumb link. */
  trailing?: ReactNode;
  /** Stable identity for the action, following leadingKey semantics. */
  trailingKey?: string;
  /** Optional control that replaces the visible label and its leading/trailing nodes. */
  control?: ReactNode;
  /** Stable identity for the control, following leadingKey semantics. */
  controlKey?: string;
}

interface BreadcrumbContextValue {
  breadcrumbs: Breadcrumb[];
  setBreadcrumbs: (crumbs: Breadcrumb[]) => void;
  breadcrumbToolbar: ReactNode | null;
  setBreadcrumbToolbar: (node: ReactNode | null) => void;
  breadcrumbPanelControl: BreadcrumbPanelControl | null;
  setBreadcrumbPanelControl: (control: BreadcrumbPanelControl | null) => void;
  mobileToolbar: ReactNode | null;
  setMobileToolbar: (node: ReactNode | null) => void;
}

export interface BreadcrumbPanelControl {
  open: boolean;
  onToggle: () => void;
}

interface BreadcrumbProviderProps {
  children: ReactNode;
  companyName?: string | null;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

function breadcrumbsEqual(left: Breadcrumb[], right: Breadcrumb[]) {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (
      left[index]?.label !== right[index]?.label
      || left[index]?.onClick !== right[index]?.onClick
      || left[index]?.href !== right[index]?.href
      || left[index]?.identifier !== right[index]?.identifier
      || left[index]?.taskStatus !== right[index]?.taskStatus
      || left[index]?.leadingKey !== right[index]?.leadingKey
      || left[index]?.trailingKey !== right[index]?.trailingKey
      || left[index]?.controlKey !== right[index]?.controlKey
    ) {
      return false;
    }
  }
  return true;
}

export function buildDocumentTitle(breadcrumbs: Breadcrumb[], companyName?: string | null) {
  const pageParts = breadcrumbs.length === 0
    ? []
    : [...breadcrumbs].reverse().map((breadcrumb) => {
      const identifier = breadcrumb.identifier?.trim();
      return identifier && identifier !== breadcrumb.label.trim()
        ? `${identifier} — ${breadcrumb.label}`
        : breadcrumb.label;
    });
  const companyPart = companyName?.trim() ? [companyName.trim()] : [];
  const parts = [...pageParts, ...companyPart, "Paperclip"];
  return parts.join(" • ");
}

const taskStatusColors: Record<string, string> = {
  backlog: "#a8aeb2",
  in_review: "#7c3aed",
  cancelled: "#a8aeb2",
  blocked: "#dc2626",
  todo: "#eab308",
  in_progress: "#2563eb",
  done: "#16a34a",
};

export function taskStatusFavicon(status?: string): string | null {
  const color = status ? taskStatusColors[status] : undefined;
  if (!color) return null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><style>path{stroke:#18181b}@media(prefers-color-scheme:dark){path{stroke:#e4e4e7}}</style><path stroke-width="2" d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"/><circle cx="19" cy="19" r="4.5" fill="white"/><circle cx="19" cy="19" r="3.5" fill="${color}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function BreadcrumbProvider({ children, companyName }: BreadcrumbProviderProps) {
  const [breadcrumbs, setBreadcrumbsState] = useState<Breadcrumb[]>([]);
  const [breadcrumbToolbar, setBreadcrumbToolbarState] = useState<ReactNode | null>(null);
  const [breadcrumbPanelControl, setBreadcrumbPanelControlState] =
    useState<BreadcrumbPanelControl | null>(null);
  const [mobileToolbar, setMobileToolbarState] = useState<ReactNode | null>(null);

  const setBreadcrumbs = useCallback((crumbs: Breadcrumb[]) => {
    setBreadcrumbsState((current) => (breadcrumbsEqual(current, crumbs) ? current : crumbs));
  }, []);

  const setMobileToolbar = useCallback((node: ReactNode | null) => {
    setMobileToolbarState(node);
  }, []);

  const setBreadcrumbToolbar = useCallback((node: ReactNode | null) => {
    setBreadcrumbToolbarState(node);
  }, []);

  const setBreadcrumbPanelControl = useCallback((control: BreadcrumbPanelControl | null) => {
    setBreadcrumbPanelControlState(control);
  }, []);

  useEffect(() => {
    document.title = buildDocumentTitle(breadcrumbs, companyName);
  }, [breadcrumbs, companyName]);

  useEffect(() => {
    const status = breadcrumbs.at(-1)?.taskStatus;
    const icon = taskStatusFavicon(status);
    if (!icon) return;
    const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
    const originals = links.map((link) => ({
      link, href: link.getAttribute("href"), type: link.getAttribute("type"), sizes: link.getAttribute("sizes"),
    }));
    for (const { link } of originals) {
      link.setAttribute("href", icon);
      link.setAttribute("type", "image/svg+xml");
      link.removeAttribute("sizes");
    }
    return () => {
      for (const { link, href, type, sizes } of originals) {
        for (const [name, value] of [["href", href], ["type", type], ["sizes", sizes]] as const) {
          if (value === null) link.removeAttribute(name);
          else link.setAttribute(name, value);
        }
      }
    };
  }, [breadcrumbs]);

  return (
    <BreadcrumbContext.Provider
      value={{
        breadcrumbs,
        setBreadcrumbs,
        breadcrumbToolbar,
        setBreadcrumbToolbar,
        breadcrumbPanelControl,
        setBreadcrumbPanelControl,
        mobileToolbar,
        setMobileToolbar,
      }}
    >
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbs() {
  const ctx = useContext(BreadcrumbContext);
  if (!ctx) {
    throw new Error("useBreadcrumbs must be used within BreadcrumbProvider");
  }
  return ctx;
}
