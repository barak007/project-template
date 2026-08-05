export type Store<State, Event> = {
  getState: () => State;
  dispatch: (event: Event) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createStore<State, Event>(
  reduce: (state: State, event: Event) => State,
  initialState: State,
): Store<State, Event> {
  let state = initialState;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    dispatch: (event) => {
      state = reduce(state, event);
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
