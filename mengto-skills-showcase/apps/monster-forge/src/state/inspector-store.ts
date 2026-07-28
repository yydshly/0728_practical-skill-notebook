import {
  monsters,
  type InspectorOverlayName,
  type InspectorState,
  type MonsterActionName,
  type MonsterDefinition,
} from "@showcase/game-assets";

type InspectorListener = (state: InspectorState) => void;

export interface InspectorStore {
  getState(): InspectorState;
  select(id: string): void;
  setAction(action: MonsterActionName): void;
  setPaused(paused: boolean): void;
  toggleOverlay(name: InspectorOverlayName): void;
  subscribe(listener: InspectorListener): () => void;
}

const monsterById: ReadonlyMap<string, MonsterDefinition> = new Map(monsters.map((monster) => [monster.id, monster]));

const getMonster = (id: string) => {
  const monster = monsterById.get(id);
  if (!monster) throw new Error(`Unknown monster: ${id}`);
  return monster;
};

const createSnapshot = (state: InspectorState): InspectorState =>
  Object.freeze({
    ...state,
    overlays: Object.freeze({ ...state.overlays }),
  });

const initialState = (selectedId: string): InspectorState =>
  createSnapshot({
    selectedId,
    action: "Idle",
    paused: false,
    overlays: { skeleton: false, colliders: false, sockets: false },
  });

export function createInspectorStore(initialSelectedId: string): InspectorStore {
  getMonster(initialSelectedId);
  let state = initialState(initialSelectedId);
  const listeners = new Set<InspectorListener>();

  const publish = (nextState: InspectorState) => {
    state = createSnapshot(nextState);
    for (const listener of listeners) listener(state);
  };

  return {
    getState: () => state,
    select: (id) => {
      getMonster(id);
      if (state.selectedId !== id) publish(initialState(id));
    },
    setAction: (action) => {
      const monster = getMonster(state.selectedId);
      if (!monster.actions.includes(action)) throw new Error(`Unknown action: ${action}`);
      if (state.action !== action) publish({ ...state, action });
    },
    setPaused: (paused) => {
      if (typeof paused !== "boolean") throw new Error("paused must be a boolean");
      if (state.paused !== paused) publish({ ...state, paused });
    },
    toggleOverlay: (name) => {
      if (!(name in state.overlays)) throw new Error(`Unknown overlay: ${String(name)}`);
      publish({ ...state, overlays: { ...state.overlays, [name]: !state.overlays[name] } });
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
