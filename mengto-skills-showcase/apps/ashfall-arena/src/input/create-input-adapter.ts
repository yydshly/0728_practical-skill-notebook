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
    const snapshot: GameIntent = {
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
    this.edges.clear();
    return snapshot;
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

export interface InputAdapter {
  sample(): GameIntent;
  getDeviceMode(): InputDeviceMode;
  clear(): void;
  dispose(): void;
}

export function createInputAdapter(
  canvas: HTMLCanvasElement,
  touchHost: HTMLElement = document.body,
): InputAdapter {
  const accumulator = new InputAccumulator();
  const keys = new Set<string>();
  let disposed = false;
  let deviceMode: InputDeviceMode = "keyboard-mouse";
  let touchMove = { x: 0, y: 0 };
  let activeStickPointer: number | null = null;
  let sawGamepad = false;
  let previousGamepad = { ...EMPTY_INTENT };

  const setMode = (mode: InputDeviceMode) => {
    deviceMode = mode;
    document.documentElement.dataset.inputMode = mode;
  };

  const updateKeyboardMove = () => {
    if (activeStickPointer !== null) return;
    accumulator.setMove(
      Number(keys.has("KeyD")) - Number(keys.has("KeyA")),
      Number(keys.has("KeyW")) - Number(keys.has("KeyS")),
    );
  };

  const onKeyDown = (event: KeyboardEvent) => {
    setMode("keyboard-mouse");
    keys.add(event.code);
    updateKeyboardMove();
    if (event.repeat) return;
    const edges: Partial<Record<string, EdgeIntent>> = {
      Space: "dodgePressed",
      KeyQ: "lockPressed",
      KeyE: "healPressed",
      Digit1: "switchWeaponPressed",
      Digit2: "switchWeaponPressed",
      Escape: "pausePressed",
    };
    const edge = edges[event.code];
    if (edge) {
      accumulator.press(edge);
      event.preventDefault();
    }
  };
  const onKeyUp = (event: KeyboardEvent) => {
    keys.delete(event.code);
    updateKeyboardMove();
  };
  const onCanvasPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    setMode("keyboard-mouse");
    if (event.button === 0) accumulator.press("attackPressed");
    if (event.button === 2) accumulator.setHeld("guardHeld", true);
  };
  const onCanvasPointerUp = (event: PointerEvent) => {
    if (event.button === 2) accumulator.setHeld("guardHeld", false);
  };
  const preventCanvasContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };
  const clear = () => {
    keys.clear();
    activeStickPointer = null;
    touchMove = { x: 0, y: 0 };
    previousGamepad = { ...EMPTY_INTENT };
    accumulator.clear();
  };
  const onVisibility = () => {
    if (document.visibilityState !== "visible") clear();
  };
  const onGamepadConnected = () => {
    sawGamepad = true;
  };
  const onGamepadDisconnected = () => {
    sawGamepad = false;
    clear();
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", clear);
  window.addEventListener("gamepadconnected", onGamepadConnected);
  window.addEventListener("gamepaddisconnected", onGamepadDisconnected);
  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("pointerdown", onCanvasPointerDown);
  canvas.addEventListener("pointerup", onCanvasPointerUp);
  canvas.addEventListener("pointercancel", clear);
  canvas.addEventListener("contextmenu", preventCanvasContextMenu);

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
    accumulator.setMove(touchMove.x, touchMove.y);
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
  const onTouchButtonDown = (event: PointerEvent) => {
    const button = event.currentTarget as HTMLButtonElement;
    setMode("touch");
    const edge = button.dataset.touchAction as EdgeIntent | undefined;
    const held = button.dataset.touchHeld as HeldIntent | undefined;
    if (edge) accumulator.press(edge);
    if (held) accumulator.setHeld(held, true);
    button.dataset.pressed = "true";
    event.preventDefault();
  };
  const onTouchButtonUp = (event: PointerEvent) => {
    const button = event.currentTarget as HTMLButtonElement;
    const held = button.dataset.touchHeld as HeldIntent | undefined;
    if (held) accumulator.setHeld(held, false);
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
        previousGamepad = { ...EMPTY_INTENT };
        accumulator.setHeld("guardHeld", false);
      }
      return;
    }
    sawGamepad = true;
    const mapped = mapStandardGamepad(pad);
    const meaningful =
      Math.abs(mapped.moveX) > 0 ||
      Math.abs(mapped.moveY) > 0 ||
      mapped.guardHeld ||
      mapped.attackPressed ||
      mapped.dodgePressed ||
      mapped.lockPressed ||
      mapped.healPressed ||
      mapped.switchWeaponPressed ||
      mapped.pausePressed;
    if (meaningful) setMode("gamepad");
    if (Math.abs(mapped.moveX) > 0 || Math.abs(mapped.moveY) > 0) {
      accumulator.setMove(mapped.moveX, mapped.moveY);
    }
    accumulator.setHeld("guardHeld", mapped.guardHeld);
    const edges: EdgeIntent[] = [
      "attackPressed",
      "dodgePressed",
      "lockPressed",
      "healPressed",
      "switchWeaponPressed",
      "pausePressed",
    ];
    for (const edge of edges) {
      if (mapped[edge] && !previousGamepad[edge]) accumulator.press(edge);
    }
    previousGamepad = mapped;
  };

  return {
    sample() {
      if (disposed) return { ...EMPTY_INTENT };
      pollGamepad();
      return accumulator.sample();
    },
    getDeviceMode: () => deviceMode,
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
      canvas.removeEventListener("pointerup", onCanvasPointerUp);
      canvas.removeEventListener("pointercancel", clear);
      canvas.removeEventListener("contextmenu", preventCanvasContextMenu);
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
