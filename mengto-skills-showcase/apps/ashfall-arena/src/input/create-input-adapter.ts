import type { GameIntent } from "../simulation/types";

type EdgeIntent =
  | "attackPressed"
  | "dodgePressed"
  | "lockPressed"
  | "healPressed"
  | "switchWeaponPressed"
  | "pausePressed";
type HeldIntent = "guardHeld";
export type InputDeviceMode = "keyboard-mouse" | "touch" | "gamepad";

const EMPTY_INTENT: GameIntent = {
  moveX: 0,
  moveY: 0,
  attackPressed: false,
  guardHeld: false,
  dodgePressed: false,
  lockPressed: false,
  healPressed: false,
  switchWeaponPressed: false,
  pausePressed: false,
};

export class InputAccumulator {
  private moveX = 0;
  private moveY = 0;
  private guardHeld = false;
  private readonly edges = new Set<EdgeIntent>();

  setMove(x: number, y: number): void {
    const safeX = Number.isFinite(x) ? x : 0;
    const safeY = Number.isFinite(y) ? y : 0;
    const length = Math.hypot(safeX, safeY);
    const scale = length > 1 ? 1 / length : 1;
    this.moveX = safeX * scale;
    this.moveY = safeY * scale;
  }

  setHeld(intent: HeldIntent, held: boolean): void {
    if (intent === "guardHeld") this.guardHeld = held;
  }

  press(intent: EdgeIntent): void {
    this.edges.add(intent);
  }

  sample(): GameIntent {
    const snapshot = this.peek();
    this.edges.clear();
    return snapshot;
  }

  peek(): GameIntent {
    return {
      moveX: this.moveX,
      moveY: this.moveY,
      attackPressed: this.edges.has("attackPressed"),
      guardHeld: this.guardHeld,
      dodgePressed: this.edges.has("dodgePressed"),
      lockPressed: this.edges.has("lockPressed"),
      healPressed: this.edges.has("healPressed"),
      switchWeaponPressed: this.edges.has("switchWeaponPressed"),
      pausePressed: this.edges.has("pausePressed"),
    };
  }

  clear(): void {
    this.moveX = 0;
    this.moveY = 0;
    this.guardHeld = false;
    this.edges.clear();
  }
}

export interface GamepadLike {
  axes: ArrayLike<number>;
  buttons: ArrayLike<{ pressed: boolean; value: number }>;
}

const buttonDown = (gamepad: GamepadLike, index: number) => {
  const button = gamepad.buttons[index];
  return Boolean(button?.pressed || (button?.value ?? 0) > 0.5);
};

export function mapStandardGamepad(gamepad: GamepadLike): GameIntent {
  const rawX = gamepad.axes[0] ?? 0;
  const rawY = -(gamepad.axes[1] ?? 0);
  const deadZone = 0.16;
  const moveX = Math.abs(rawX) >= deadZone ? rawX : 0;
  const moveY = Math.abs(rawY) >= deadZone ? rawY : 0;
  const length = Math.hypot(moveX, moveY);
  const scale = length > 1 ? 1 / length : 1;

  return {
    moveX: moveX * scale,
    moveY: moveY * scale,
    attackPressed: buttonDown(gamepad, 0),
    guardHeld: buttonDown(gamepad, 6),
    dodgePressed: buttonDown(gamepad, 1),
    lockPressed: buttonDown(gamepad, 10),
    healPressed: buttonDown(gamepad, 3),
    switchWeaponPressed:
      buttonDown(gamepad, 14) || buttonDown(gamepad, 15),
    pausePressed: buttonDown(gamepad, 9),
  };
}

export class GamepadInputTracker {
  private previous = { ...EMPTY_INTENT };

  update(gamepad: GamepadLike): GameIntent {
    const mapped = mapStandardGamepad(gamepad);
    const next = {
      ...mapped,
      attackPressed:
        mapped.attackPressed && !this.previous.attackPressed,
      dodgePressed: mapped.dodgePressed && !this.previous.dodgePressed,
      lockPressed: mapped.lockPressed && !this.previous.lockPressed,
      healPressed: mapped.healPressed && !this.previous.healPressed,
      switchWeaponPressed:
        mapped.switchWeaponPressed && !this.previous.switchWeaponPressed,
      pausePressed: mapped.pausePressed && !this.previous.pausePressed,
    };
    this.previous = mapped;
    return next;
  }

  disconnect(): GameIntent {
    this.previous = { ...EMPTY_INTENT };
    return { ...EMPTY_INTENT };
  }
}

interface OwnedDeviceState {
  moveX: number;
  moveY: number;
  guardHeld: boolean;
}

const createOwnedDeviceState = (): OwnedDeviceState => ({
  moveX: 0,
  moveY: 0,
  guardHeld: false,
});

export class InputDeviceOwnership {
  private deviceMode: InputDeviceMode = "keyboard-mouse";
  private readonly stateByDevice: Record<InputDeviceMode, OwnedDeviceState> = {
    "keyboard-mouse": createOwnedDeviceState(),
    touch: createOwnedDeviceState(),
    gamepad: createOwnedDeviceState(),
  };

  activate(device: InputDeviceMode): OwnedDeviceState {
    this.deviceMode = device;
    return this.getActiveState();
  }

  setMove(
    device: InputDeviceMode,
    moveX: number,
    moveY: number,
  ): OwnedDeviceState {
    const state = this.stateByDevice[device];
    state.moveX = moveX;
    state.moveY = moveY;
    return this.getActiveState();
  }

  setGuard(device: InputDeviceMode, held: boolean): OwnedDeviceState {
    this.stateByDevice[device].guardHeld = held;
    return this.getActiveState();
  }

  getDeviceMode(): InputDeviceMode {
    return this.deviceMode;
  }

  getActiveState(): OwnedDeviceState {
    return { ...this.stateByDevice[this.deviceMode] };
  }

  clear(): void {
    for (const state of Object.values(this.stateByDevice)) {
      state.moveX = 0;
      state.moveY = 0;
      state.guardHeld = false;
    }
  }
}

export interface InputAdapter {
  sample(): GameIntent;
  getDeviceMode(): InputDeviceMode;
  getDiagnostics(): GameIntent;
  getLifecycleDiagnostics(): {
    readonly disposed: boolean;
    readonly listenerRegistrations: number;
  };
  clear(): void;
  dispose(): void;
}

export function createInputAdapter(
  canvas: HTMLCanvasElement,
  touchHost: HTMLElement = document.body,
): InputAdapter {
  const accumulator = new InputAccumulator();
  const deviceOwnership = new InputDeviceOwnership();
  const keys = new Set<string>();
  let disposed = false;
  let deviceMode = deviceOwnership.getDeviceMode();
  let touchMove = { x: 0, y: 0 };
  let activeStickPointer: number | null = null;
  let guardPointerId: number | null = null;
  let sawGamepad = false;
  let gamepadNeedsNeutral = false;
  const gamepadTracker = new GamepadInputTracker();

  const applyActiveState = (state: OwnedDeviceState) => {
    accumulator.setMove(state.moveX, state.moveY);
    accumulator.setHeld("guardHeld", state.guardHeld);
  };
  const setMode = (mode: InputDeviceMode) => {
    deviceMode = mode;
    applyActiveState(deviceOwnership.activate(mode));
    document.documentElement.dataset.inputMode = mode;
  };
  document.documentElement.dataset.inputMode = deviceMode;

  const setSourceMove = (
    source: InputDeviceMode,
    moveX: number,
    moveY: number,
  ) => {
    applyActiveState(deviceOwnership.setMove(source, moveX, moveY));
  };
  const setSourceGuard = (source: InputDeviceMode, held: boolean) => {
    applyActiveState(deviceOwnership.setGuard(source, held));
  };

  const updateKeyboardMove = () => {
    if (activeStickPointer !== null) return;
    setSourceMove(
      "keyboard-mouse",
      Number(keys.has("KeyD")) - Number(keys.has("KeyA")),
      Number(keys.has("KeyW")) - Number(keys.has("KeyS")),
    );
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const edges: Partial<Record<string, EdgeIntent>> = {
      Space: "dodgePressed",
      KeyQ: "lockPressed",
      KeyE: "healPressed",
      Digit1: "switchWeaponPressed",
      Digit2: "switchWeaponPressed",
      Escape: "pausePressed",
    };
    const edge = edges[event.code];
    const movement =
      event.code === "KeyW" ||
      event.code === "KeyA" ||
      event.code === "KeyS" ||
      event.code === "KeyD";
    const menuNavigation =
      event.code === "Enter" ||
      event.code === "Tab" ||
      event.code === "ArrowUp" ||
      event.code === "ArrowDown";
    if (!movement && !edge && !menuNavigation) return;
    setMode("keyboard-mouse");
    if (movement) {
      keys.add(event.code);
      updateKeyboardMove();
    }
    if (event.repeat) return;
    if (edge) {
      accumulator.press(edge);
      event.preventDefault();
    }
  };
  const onKeyUp = (event: KeyboardEvent) => {
    if (!keys.has(event.code)) return;
    keys.delete(event.code);
    updateKeyboardMove();
  };
  const onCanvasPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    if (event.button !== 0 && event.button !== 2) return;
    setMode("keyboard-mouse");
    if (event.button === 0) accumulator.press("attackPressed");
    if (event.button === 2) {
      guardPointerId = event.pointerId;
      setSourceGuard("keyboard-mouse", true);
    }
  };
  const releasePointerGuard = (event: PointerEvent) => {
    if (guardPointerId !== event.pointerId) return;
    guardPointerId = null;
    setSourceGuard("keyboard-mouse", false);
  };
  const preventCanvasContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };
  const clear = () => {
    if (sawGamepad) gamepadNeedsNeutral = true;
    keys.clear();
    activeStickPointer = null;
    guardPointerId = null;
    touchMove = { x: 0, y: 0 };
    gamepadTracker.disconnect();
    deviceOwnership.clear();
    accumulator.clear();
  };
  const onVisibility = () => {
    if (document.visibilityState !== "visible") clear();
  };
  const onGamepadConnected = () => {
    sawGamepad = true;
  };
  const onGamepadDisconnected = () => {
    gamepadTracker.disconnect();
    setSourceMove("gamepad", 0, 0);
    setSourceGuard("gamepad", false);
    sawGamepad = false;
    gamepadNeedsNeutral = false;
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", clear);
  window.addEventListener("gamepadconnected", onGamepadConnected);
  window.addEventListener("gamepaddisconnected", onGamepadDisconnected);
  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("pointerdown", onCanvasPointerDown);
  canvas.addEventListener("pointercancel", clear);
  canvas.addEventListener("contextmenu", preventCanvasContextMenu);
  window.addEventListener("pointerup", releasePointerGuard);
  window.addEventListener("pointercancel", releasePointerGuard);

  const controls = document.createElement("section");
  controls.className = "touch-controls";
  controls.setAttribute("aria-label", "触控操作");
  controls.innerHTML = `
    <div class="touch-stick" role="application" aria-label="移动摇杆">
      <span class="touch-stick__knob" aria-hidden="true"></span>
    </div>
    <div class="touch-actions">
      <button type="button" data-touch-action="attackPressed" aria-label="攻击">A</button>
      <button type="button" data-touch-held="guardHeld" aria-label="格挡">Y</button>
      <button type="button" data-touch-action="dodgePressed" aria-label="闪避">B</button>
      <button type="button" data-touch-action="lockPressed" aria-label="目标锁定">锁</button>
      <button type="button" data-touch-action="switchWeaponPressed" aria-label="切换武器">武</button>
      <button type="button" data-touch-action="healPressed" aria-label="治疗">药</button>
      <button type="button" data-touch-action="pausePressed" aria-label="暂停">Ⅱ</button>
    </div>`;
  touchHost.append(controls);

  const stick = controls.querySelector<HTMLElement>(".touch-stick")!;
  const knob = controls.querySelector<HTMLElement>(".touch-stick__knob")!;
  const updateStick = (event: PointerEvent) => {
    const rect = stick.getBoundingClientRect();
    const maxRadius = Math.max(1, rect.width * 0.34);
    let x = event.clientX - (rect.left + rect.width / 2);
    let y = event.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(x, y);
    if (length > maxRadius) {
      x *= maxRadius / length;
      y *= maxRadius / length;
    }
    touchMove = { x: x / maxRadius, y: -y / maxRadius };
    knob.style.transform = `translate(${x}px, ${y}px)`;
    setSourceMove("touch", touchMove.x, touchMove.y);
  };
  const onStickDown = (event: PointerEvent) => {
    setMode("touch");
    activeStickPointer = event.pointerId;
    stick.setPointerCapture(event.pointerId);
    updateStick(event);
    event.preventDefault();
  };
  const onStickMove = (event: PointerEvent) => {
    if (activeStickPointer !== event.pointerId) return;
    updateStick(event);
    event.preventDefault();
  };
  const releaseStick = (event: PointerEvent) => {
    if (activeStickPointer !== event.pointerId) return;
    activeStickPointer = null;
    touchMove = { x: 0, y: 0 };
    knob.style.transform = "translate(0px, 0px)";
    setSourceMove("touch", 0, 0);
    updateKeyboardMove();
  };
  const cancelStick = (event: PointerEvent) => {
    if (activeStickPointer !== event.pointerId) return;
    releaseStick(event);
    clear();
  };
  stick.addEventListener("pointerdown", onStickDown);
  stick.addEventListener("pointermove", onStickMove);
  stick.addEventListener("pointerup", releaseStick);
  stick.addEventListener("pointercancel", cancelStick);

  const touchButtons = [
    ...controls.querySelectorAll<HTMLButtonElement>("button"),
  ];
  const listenerRegistrations = 15 + touchButtons.length * 3;
  const onTouchButtonDown = (event: PointerEvent) => {
    const button = event.currentTarget as HTMLButtonElement;
    setMode("touch");
    const edge = button.dataset.touchAction as EdgeIntent | undefined;
    const held = button.dataset.touchHeld as HeldIntent | undefined;
    if (edge) accumulator.press(edge);
    if (held) setSourceGuard("touch", true);
    button.dataset.pressed = "true";
    event.preventDefault();
  };
  const onTouchButtonUp = (event: PointerEvent) => {
    const button = event.currentTarget as HTMLButtonElement;
    const held = button.dataset.touchHeld as HeldIntent | undefined;
    if (held) setSourceGuard("touch", false);
    delete button.dataset.pressed;
  };
  const onTouchButtonCancel = (event: PointerEvent) => {
    const button = event.currentTarget as HTMLButtonElement;
    delete button.dataset.pressed;
    clear();
  };
  touchButtons.forEach((button) => {
    button.addEventListener("pointerdown", onTouchButtonDown);
    button.addEventListener("pointerup", onTouchButtonUp);
    button.addEventListener("pointercancel", onTouchButtonCancel);
  });

  const pollGamepad = () => {
    const pads =
      typeof navigator.getGamepads === "function"
        ? navigator.getGamepads()
        : [];
    const pad = [...pads].find((candidate) => candidate?.mapping === "standard");
    if (!pad) {
      if (sawGamepad) {
        gamepadTracker.disconnect();
        setSourceMove("gamepad", 0, 0);
        setSourceGuard("gamepad", false);
        sawGamepad = false;
        gamepadNeedsNeutral = false;
      }
      return;
    }
    sawGamepad = true;
    const raw = mapStandardGamepad(pad);
    const mapped = gamepadTracker.update(pad);
    const meaningful =
      Math.abs(raw.moveX) > 0 ||
      Math.abs(raw.moveY) > 0 ||
      raw.guardHeld ||
      raw.attackPressed ||
      raw.dodgePressed ||
      raw.lockPressed ||
      raw.healPressed ||
      raw.switchWeaponPressed ||
      raw.pausePressed;
    if (gamepadNeedsNeutral) {
      setSourceMove("gamepad", 0, 0);
      setSourceGuard("gamepad", false);
      gamepadTracker.disconnect();
      if (!meaningful) gamepadNeedsNeutral = false;
      return;
    }
    setSourceMove("gamepad", mapped.moveX, mapped.moveY);
    setSourceGuard("gamepad", mapped.guardHeld);
    if (meaningful) setMode("gamepad");
    const edges: EdgeIntent[] = [
      "attackPressed",
      "dodgePressed",
      "lockPressed",
      "healPressed",
      "switchWeaponPressed",
      "pausePressed",
    ];
    for (const edge of edges) {
      if (mapped[edge]) accumulator.press(edge);
    }
  };

  return {
    sample() {
      if (disposed) return { ...EMPTY_INTENT };
      pollGamepad();
      return accumulator.sample();
    },
    getDeviceMode: () => deviceMode,
    getDiagnostics: () => accumulator.peek(),
    getLifecycleDiagnostics: () => ({
      disposed,
      listenerRegistrations: disposed ? 0 : listenerRegistrations,
    }),
    clear,
    dispose() {
      if (disposed) return;
      disposed = true;
      clear();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clear);
      window.removeEventListener("gamepadconnected", onGamepadConnected);
      window.removeEventListener("gamepaddisconnected", onGamepadDisconnected);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onCanvasPointerDown);
      canvas.removeEventListener("pointercancel", clear);
      canvas.removeEventListener("contextmenu", preventCanvasContextMenu);
      window.removeEventListener("pointerup", releasePointerGuard);
      window.removeEventListener("pointercancel", releasePointerGuard);
      stick.removeEventListener("pointerdown", onStickDown);
      stick.removeEventListener("pointermove", onStickMove);
      stick.removeEventListener("pointerup", releaseStick);
      stick.removeEventListener("pointercancel", cancelStick);
      touchButtons.forEach((button) => {
        button.removeEventListener("pointerdown", onTouchButtonDown);
        button.removeEventListener("pointerup", onTouchButtonUp);
        button.removeEventListener("pointercancel", onTouchButtonCancel);
      });
      controls.remove();
    },
  };
}
