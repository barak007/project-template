import type { ReactNode } from "react";

/**
 * One titled part of a page, with the action that belongs to that part. The
 * heading and its content are one element, which is what ties them together:
 * the gap inside a section is smaller than the gap between two, so a heading
 * reads as belonging to what follows it rather than floating between.
 */
export function Section({
  title,
  note,
  action,
  grows = false,
  children,
}: {
  title: string;
  note?: ReactNode;
  action?: ReactNode;
  /** Fills the rest of the page — for the section holding a file tree. */
  grows?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={grows ? "section grows" : "section"}>
      <div className="section-header">
        <h2>{title}</h2>
        {note === undefined ? null : <span className="muted">{note}</span>}
        {action === undefined ? null : (
          <div className="section-action">{action}</div>
        )}
      </div>
      {children}
    </section>
  );
}
