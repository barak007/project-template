import type { ReactNode } from "react";

export function ErrorText({ children }: { children: ReactNode }) {
  return <p className="error">{children}</p>;
}
