import type { ReactNode } from "react";

import { routeToPath } from "../client/index.js";
import type { AppCore, Route } from "../client/index.js";

/**
 * A real anchor — crawlable, middle-clickable, copyable — that navigates
 * through the store instead of reloading the page.
 */
export function RouteLink({
  core,
  to,
  className,
  children,
}: {
  core: AppCore;
  to: Route;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={routeToPath(to)}
      {...(className === undefined ? {} : { className })}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        core.navigation.navigate(to);
      }}
    >
      {children}
    </a>
  );
}
