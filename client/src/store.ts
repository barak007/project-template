export type Store<State> = {
  getState: () => State;
  setState: (update: (state: State) => State) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createStore<State>(initialState: State): Store<State> {
  let state = initialState;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    setState: (update) => {
      state = update(state);
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
