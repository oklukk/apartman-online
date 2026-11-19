import type { ReactNode } from "react";

/** Native disclosure keeps forms mounted, including unsaved values and confirmations. */
export function PanelGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <details className="panel-group">
      <summary>
        <span>
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
      </summary>
      <div className="panel-group-content">{children}</div>
    </details>
  );
}
