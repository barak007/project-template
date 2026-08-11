import type { ReactNode } from "react";

/**
 * One glyph and one colour per domain entity, so the same thing looks the same
 * everywhere: an organization on the dashboard, in a breadcrumb and in a
 * heading are one visual identity rather than three pieces of text.
 *
 * Inline SVG rather than an icon font or emoji: it inherits `currentColor` (so
 * the colour comes from the `--entity-*` token on the class, in one place) and
 * renders identically on every platform. The colours live in
 * [styles.css](./styles.css) with the rest of the design tokens.
 */
export type Entity =
  "organization" | "workspace" | "project" | "session" | "repository";

/**
 * Drawn on a 24×24 grid, stroked with `currentColor`. Each shape says what the
 * thing *is*: an organization is a building, a workspace stacks the things it
 * collects, a project is one box holding them, a session is a running copy, a
 * repository is a branch.
 */
const shapes: Record<Entity, ReactNode> = {
  organization: (
    <>
      <path d="M4 20V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v15" />
      <path d="M15 10h4a1 1 0 0 1 1 1v9" />
      <path d="M3 20h18" />
      <path d="M8 8h3M8 12h3M8 16h3" />
    </>
  ),
  workspace: (
    <>
      <path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" />
      <path d="M3 12.5 12 17l9-4.5" />
      <path d="M3 17.5 12 22l9-4.5" />
    </>
  ),
  project: (
    <>
      <path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7L12 2.5Z" />
      <path d="M3.5 7 12 11.5 20.5 7" />
      <path d="M12 11.5v10" />
    </>
  ),
  session: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5l6 3.5-6 3.5v-7Z" />
    </>
  ),
  repository: (
    <>
      <circle cx="7" cy="6" r="2.5" />
      <circle cx="7" cy="18" r="2.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M7 8.5v7" />
      <path d="M17 11.5c0 3-3 3.5-5 4" />
    </>
  ),
};

export function EntityIcon({ entity }: { entity: Entity }) {
  return (
    <svg
      className={`entity-icon entity-${entity}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {shapes[entity]}
    </svg>
  );
}
