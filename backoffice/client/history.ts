/**
 * The URL surface the client needs from its environment, in the spirit of
 * Host (client/host.ts): the browser adapter wraps window.history, tests use
 * createMemoryHistory — the client itself never touches platform globals.
 */
export type History = {
  path(): string;
  push(path: string): void;
  replace(path: string): void;
  /** Called when the environment changes the path (e.g. browser back). */
  onChange(listener: (path: string) => void): void;
};

export type MemoryHistory = History & {
  /** Simulates the environment navigating back (browser popstate). */
  back(): void;
};

export function createMemoryHistory(initialPath = "/"): MemoryHistory {
  const stack = [initialPath];
  let listener: ((path: string) => void) | undefined;
  const current = () => stack[stack.length - 1] ?? initialPath;
  return {
    path: current,
    push: (path) => {
      stack.push(path);
    },
    replace: (path) => {
      stack[stack.length - 1] = path;
    },
    onChange: (onChange) => {
      listener = onChange;
    },
    back: () => {
      if (stack.length > 1) stack.pop();
      listener?.(current());
    },
  };
}
