import type { AudioSettings } from "../feedback/create-audio";
import type { InputDeviceMode } from "../input/create-input-adapter";
import type {
  AttackResolvedEvent,
  EnemyKind,
  EnemyMoveId,
  GameEvent,
  GameState,
} from "../simulation/types";
import type { UpgradeId } from "../simulation/inventory";

const ACTION_LABELS: Record<GameState["player"]["action"], string> = {
  idle: "待机",
  move: "移动",
  attack: "攻击",
  guard: "格挡",
  dodge: "闪避",
  hit: "受击",
  dead: "倒下",
};

const ENEMY_LABELS: Record<EnemyKind, string> = {
  "glass-crawler": "琉璃爬兽",
  "ash-warden": "灰烬守望者",
  "bell-elite": "钟甲精英",
  "bell-sovereign": "钟鸣君主",
};

const PHASE_LABELS = {
  training: "训练阶段",
  "wave-one": "第一波",
  elite: "精英战",
  boss: "首领战",
  complete: "挑战完成",
} as const;

const MOVE_LABELS: Record<EnemyMoveId, string> = {
  "crawler-lunge": "爬兽突进",
  "warden-bolt": "灰烬飞矢",
  "elite-sweep": "钟甲横扫",
  "sovereign-sweep": "君主横扫",
  "sovereign-shockwave": "王庭冲击波",
  "sovereign-summon": "君主召唤",
};

export const formatPhaseLabel = (phase: string): string =>
  (PHASE_LABELS as Record<string, string>)[phase] ?? "未知阶段";

export const formatEnemyLabel = (kind: string): string =>
  (ENEMY_LABELS as Record<string, string>)[kind] ?? "未知敌人";

export const formatMoveLabel = (moveId: string): string =>
  (MOVE_LABELS as Record<string, string>)[moveId] ?? "未知招式";

export const formatAttackResolutionCaption = (
  result: AttackResolvedEvent["result"],
): string =>
  result === "hit"
    ? "命中：攻击已结算"
    : result === "interrupted"
      ? "攻击被打断"
      : "落空：未命中目标";

export const formatTelegraphLabel = (
  kind: string,
  moveId: string,
): string =>
  `${formatEnemyLabel(kind)} · ${formatMoveLabel(moveId)}`;

const ATTACK_LABELS = {
  "oathblade-light-1": "誓约刃一式",
  "oathblade-light-2": "誓约刃二式",
  "ember-bow-shot": "余烬箭",
} as const;

const DEVICE_LABELS: Record<InputDeviceMode, string> = {
  "keyboard-mouse": "键鼠：WASD 移动，鼠标攻击/格挡",
  touch: "触控：左侧摇杆移动，右侧按钮战斗",
  gamepad: "手柄：左摇杆移动，南键攻击，菜单键暂停",
};

const query = <T extends Element>(
  root: ParentNode,
  selector: string,
): T => {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing HUD element: ${selector}`);
  return element;
};

const setText = (element: Element, value: string) => {
  if (element.textContent !== value) element.textContent = value;
};

const setDialogOpen = (
  dialog: HTMLDialogElement,
  shouldOpen: boolean,
): boolean => {
  if (shouldOpen && !dialog.open) {
    dialog.showModal();
    return false;
  }
  if (!shouldOpen && dialog.open) {
    dialog.close();
    return true;
  }
  return false;
};

export interface HudCallbacks {
  onUpgrade(upgradeId: UpgradeId): void;
  onRetry(): void;
  onNewRun(): void;
  onResume(): void;
  onAudioSettings(settings: Partial<AudioSettings>): void;
}

export interface HudRenderOptions {
  readonly deviceMode: InputDeviceMode;
  readonly telegraphs: readonly {
    readonly enemyKind: string;
    readonly moveId: string;
  }[];
  readonly damageFlashActive: boolean;
}

export interface HudController {
  render(state: Readonly<GameState>, options: HudRenderOptions): void;
  consume(events: readonly GameEvent[], state: Readonly<GameState>): void;
  updatePresentation(deltaSeconds: number, paused: boolean): void;
  setSaveNotice(message: string): void;
  activateFocusedAction(): boolean;
  moveDialogFocus(direction: -1 | 1): boolean;
  hasOpenDialog(): boolean;
  consumeFocusGameRequest(): boolean;
  getLifecycleDiagnostics(): {
    readonly disposed: boolean;
    readonly listenerRegistrations: number;
  };
  dispose(): void;
}

export function createHudController(
  root: HTMLElement,
  callbacks: HudCallbacks,
  initialAudioSettings: AudioSettings,
): HudController {
  const health = query<HTMLElement>(root, "[data-health]");
  const stamina = query<HTMLElement>(root, "[data-stamina]");
  const healthMeter = query<HTMLElement>(root, "[data-health-meter]");
  const staminaMeter = query<HTMLElement>(root, "[data-stamina-meter]");
  const weapon = query<HTMLElement>(root, "[data-weapon]");
  const action = query<HTMLElement>(root, "[data-action]");
  const healing = query<HTMLElement>(root, "[data-healing]");
  const souls = query<HTMLElement>(root, "[data-souls]");
  const upgrade = query<HTMLElement>(root, "[data-upgrade]");
  const objectiveTitle = query<HTMLElement>(root, ".objective-card h2");
  const arenaStatus = query<HTMLElement>(root, ".arena-status");
  const targetPanel = query<HTMLElement>(root, "[data-target-panel]");
  const targetName = query<HTMLElement>(root, "[data-target-name]");
  const targetHealth = query<HTMLElement>(root, "[data-target-health]");
  const targetMeter = query<HTMLElement>(root, "[data-target-meter]");
  const telegraphBanner = query<HTMLElement>(
    root,
    "[data-enemy-telegraph]",
  );
  const devicePrompt = query<HTMLElement>(root, "[data-device-prompt]");
  const feedbackCaption = query<HTMLElement>(
    root,
    "[data-feedback-caption]",
  );
  const damageFlash = query<HTMLElement>(root, "[data-damage-flash]");
  const saveNotice = query<HTMLElement>(root, "[data-save-notice]");
  const upgradeModal = query<HTMLDialogElement>(
    root,
    "[data-upgrade-modal]",
  );
  const pauseModal = query<HTMLDialogElement>(root, "[data-pause-modal]");
  const defeatModal = query<HTMLDialogElement>(root, "[data-defeat-modal]");
  const completeModal = query<HTMLDialogElement>(
    root,
    "[data-complete-modal]",
  );
  const dialogs = [
    upgradeModal,
    pauseModal,
    defeatModal,
    completeModal,
  ] as const;
  const upgradeButtons = [
    ...upgradeModal.querySelectorAll<HTMLButtonElement>("[data-upgrade-id]"),
  ];
  const retryButton = query<HTMLButtonElement>(root, "[data-retry]");
  const resumeButton = query<HTMLButtonElement>(root, "[data-resume]");
  const newRunButtons = [
    ...root.querySelectorAll<HTMLButtonElement>("[data-new-run]"),
  ];
  const mute = query<HTMLInputElement>(root, "[data-audio-mute]");
  const master = query<HTMLInputElement>(root, "[data-audio-master]");
  const effects = query<HTMLInputElement>(root, "[data-audio-effects]");
  const ambience = query<HTMLInputElement>(root, "[data-audio-ambience]");

  mute.checked = initialAudioSettings.muted;
  master.value = String(initialAudioSettings.master);
  effects.value = String(initialAudioSettings.effects);
  ambience.value = String(initialAudioSettings.ambience);

  let captionRemaining = 0;
  let captionPriority = Number.POSITIVE_INFINITY;
  let focusedStatus: GameState["status"] | "paused" | null = null;
  let focusGameRequested = false;
  let disposed = false;

  const onUpgradeClick = (event: Event) => {
    callbacks.onUpgrade(
      (event.currentTarget as HTMLButtonElement).dataset
        .upgradeId as UpgradeId,
    );
  };
  const onRetry = () => callbacks.onRetry();
  const onResume = () => callbacks.onResume();
  const onNewRun = () => callbacks.onNewRun();
  const onMute = () => callbacks.onAudioSettings({ muted: mute.checked });
  const onMaster = () =>
    callbacks.onAudioSettings({ master: Number(master.value) });
  const onEffects = () =>
    callbacks.onAudioSettings({ effects: Number(effects.value) });
  const onAmbience = () =>
    callbacks.onAudioSettings({ ambience: Number(ambience.value) });
  const preventDialogCancel = (event: Event) => event.preventDefault();
  const trapDialogFocus = (event: KeyboardEvent) => {
    if (event.key !== "Tab") return;
    const dialog = event.currentTarget as HTMLDialogElement;
    const controls = [
      ...dialog.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
    ];
    if (controls.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const index = controls.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    if (event.shiftKey && index <= 0) {
      event.preventDefault();
      controls.at(-1)!.focus();
    } else if (!event.shiftKey && index === controls.length - 1) {
      event.preventDefault();
      controls[0]!.focus();
    }
  };

  for (const button of upgradeButtons) {
    button.addEventListener("click", onUpgradeClick);
  }
  retryButton.addEventListener("click", onRetry);
  resumeButton.addEventListener("click", onResume);
  for (const button of newRunButtons) {
    button.addEventListener("click", onNewRun);
  }
  mute.addEventListener("change", onMute);
  master.addEventListener("input", onMaster);
  effects.addEventListener("input", onEffects);
  ambience.addEventListener("input", onAmbience);
  for (const dialog of dialogs) {
    dialog.addEventListener("cancel", preventDialogCancel);
    dialog.addEventListener("keydown", trapDialogFocus);
  }

  const setCaption = (
    value: string,
    duration = 1.25,
    priority = Number.POSITIVE_INFINITY,
  ) => {
    if (value.length === 0) {
      setText(feedbackCaption, "");
      feedbackCaption.hidden = true;
      captionRemaining = 0;
      captionPriority = Number.POSITIVE_INFINITY;
      return;
    }
    setText(feedbackCaption, value);
    feedbackCaption.hidden = false;
    captionRemaining = duration;
    captionPriority = priority;
  };

  const consume = (
    events: readonly GameEvent[],
    state: Readonly<GameState>,
  ) => {
    const requestCaption = (
      value: string,
      duration: number,
      priority: number,
    ) => {
      if (captionRemaining > 0 && priority > captionPriority) return;
      setCaption(value, duration, priority);
    };
    for (const event of events) {
      if (
        event.type === "action-started" &&
        event.actorId === state.player.id
      ) {
        requestCaption(
          event.actionId === "dodge"
            ? "闪避起步"
            : `攻击起手：${ATTACK_LABELS[event.actionId]}`,
          0.75,
          3,
        );
      } else if (
        event.type === "attack-resolved" &&
        event.actorId === state.player.id
      ) {
        requestCaption(
          formatAttackResolutionCaption(event.result),
          event.result === "hit"
            ? 0.8
            : event.result === "interrupted"
              ? 1.15
              : 1,
          event.result === "interrupted"
            ? 1
            : event.result === "hit"
              ? 2
              : 3,
        );
      } else if (
        event.type === "damage" &&
        event.targetId === state.player.id
      ) {
        requestCaption(
          event.guardBroken
            ? `格挡崩解：承受 ${event.amount} 点伤害`
            : event.guarded
            ? `格挡成功：承受 ${event.amount} 点伤害`
            : `受击：生命减少 ${event.amount}`,
          1.25,
          1,
        );
      } else if (event.type === "enemy-telegraph") {
        requestCaption(
          `敌人预警：${formatTelegraphLabel(
            state.enemies[event.enemyId]?.kind ?? "",
            event.moveId,
          )}`,
          1.1,
          2,
        );
      } else if (event.type === "boss-phase") {
        requestCaption(`首领进入第 ${event.phase} 阶段`, 1.8, 0);
      } else if (event.type === "drop") {
        requestCaption("战利品已落地", 0.9, 3);
      } else if (event.type === "upgrade-offered") {
        requestCaption("第一波完成：请选择升级", 1.8, 0);
      } else if (event.type === "encounter-complete") {
        requestCaption("竞技场挑战完成", 2.2, 0);
      } else if (event.type === "healed") {
        requestCaption(`治疗：恢复 ${event.amount} 点生命`, 1, 1);
      }
    }
  };

  const render = (
    state: Readonly<GameState>,
    options: HudRenderOptions,
  ) => {
    setText(health, `${state.player.health} / ${state.player.maxHealth}`);
    setText(
      stamina,
      `${Math.round(state.player.stamina)} / ${state.player.maxStamina}`,
    );
    setText(
      weapon,
      state.player.weaponId === "oathblade" ? "誓约刃" : "余烬弓",
    );
    setText(action, ACTION_LABELS[state.player.action]);
    setText(healing, `治疗瓶 × ${state.player.healingCharges}`);
    setText(souls, `灵魂 ${state.player.souls}`);
    setText(
      upgrade,
      state.player.upgradeId === null
        ? "升级：未选择"
        : state.player.upgradeId === "vitality"
          ? "升级：活力"
          : "升级：力量",
    );
    weapon.dataset.weaponId = state.player.weaponId;
    action.dataset.actionId = state.player.action;
    const healthPercent =
      100 * state.player.health / state.player.maxHealth;
    const staminaPercent =
      100 * state.player.stamina / state.player.maxStamina;
    healthMeter.style.width = `${healthPercent}%`;
    staminaMeter.style.width = `${staminaPercent}%`;
    healthMeter.parentElement?.setAttribute(
      "aria-valuenow",
      String(state.player.health),
    );
    healthMeter.parentElement?.setAttribute(
      "aria-valuemax",
      String(state.player.maxHealth),
    );
    staminaMeter.parentElement?.setAttribute(
      "aria-valuenow",
      String(Math.round(state.player.stamina)),
    );

    const objectiveLabels: Record<
      GameState["encounter"]["phase"],
      string
    > = {
      training: state.encounter.trainingSpawned
        ? "完成攻击与格挡训练"
        : "进入第一个琥珀训练环",
      "wave-one":
        state.status === "upgrade"
          ? "选择升级后进入精英战"
          : "击败第一波敌人",
      elite: "击败钟甲精英并开启王庭闸门",
      boss: "击败钟鸣君主",
      complete: "竞技场挑战完成",
    };
    setText(objectiveTitle, objectiveLabels[state.encounter.phase]);
    setText(
      arenaStatus,
      `${formatPhaseLabel(state.encounter.phase)} · 闸门${
        state.encounter.gateOpen ? "开启" : "关闭"
      }`,
    );

    const target =
      state.player.lockTargetId === null
        ? null
        : state.enemies[state.player.lockTargetId] ?? null;
    targetPanel.hidden = target === null;
    if (target) {
      setText(targetName, formatEnemyLabel(target.kind));
      setText(targetHealth, `${target.health} / ${target.maxHealth}`);
      targetMeter.style.width =
        `${100 * target.health / target.maxHealth}%`;
      targetMeter.parentElement?.setAttribute(
        "aria-valuenow",
        String(target.health),
      );
      targetMeter.parentElement?.setAttribute(
        "aria-valuemax",
        String(target.maxHealth),
      );
    }

    telegraphBanner.hidden = options.telegraphs.length === 0;
    setText(
      telegraphBanner,
      options.telegraphs.length === 0
        ? ""
        : `敌人正在蓄力：${options.telegraphs
            .map(({ enemyKind, moveId }) =>
              formatTelegraphLabel(enemyKind, moveId)
            )
            .join("、")}`,
    );
    setText(devicePrompt, DEVICE_LABELS[options.deviceMode]);
    damageFlash.hidden = !options.damageFlashActive;
    document.documentElement.dataset.paused =
      state.paused ? "true" : "false";

    let closedModal = false;
    closedModal =
      setDialogOpen(
        upgradeModal,
        state.status === "upgrade",
      ) || closedModal;
    closedModal =
      setDialogOpen(
        pauseModal,
        state.status === "playing" && state.paused,
      ) || closedModal;
    closedModal =
      setDialogOpen(
        defeatModal,
        state.status === "defeated",
      ) || closedModal;
    closedModal =
      setDialogOpen(
        completeModal,
        state.status === "complete",
      ) || closedModal;

    const focusKey =
      state.status === "playing" && state.paused
        ? "paused"
        : state.status;
    if (focusedStatus !== focusKey) {
      focusedStatus = focusKey;
      if (focusKey === "upgrade") upgradeButtons[0]?.focus();
      if (focusKey === "paused") resumeButton.focus();
      if (focusKey === "defeated") retryButton.focus();
      if (focusKey === "complete") completeModal.focus();
    }
    if (
      state.status === "playing" &&
      !state.paused &&
      closedModal
    ) {
      focusGameRequested = true;
    }
  };

  const openDialog = () => dialogs.find((dialog) => dialog.open) ?? null;
  const listenerRegistrations =
    upgradeButtons.length +
    2 +
    newRunButtons.length +
    4 +
    dialogs.length * 2;

  return {
    render,
    consume,
    updatePresentation(deltaSeconds, paused) {
      if (paused || captionRemaining <= 0) return;
      captionRemaining = Math.max(0, captionRemaining - deltaSeconds);
      if (captionRemaining === 0) setCaption("");
    },
    setSaveNotice(message) {
      setText(saveNotice, message);
      saveNotice.hidden = message.length === 0;
    },
    activateFocusedAction() {
      const dialog = openDialog();
      if (!dialog) return false;
      const focused = document.activeElement;
      if (
        focused instanceof HTMLButtonElement &&
        dialog.contains(focused)
      ) {
        focused.click();
        return true;
      }
      const first = dialog.querySelector<HTMLButtonElement>(
        "button:not(:disabled)",
      );
      first?.click();
      return first !== null;
    },
    moveDialogFocus(direction) {
      const dialog = openDialog();
      if (!dialog) return false;
      const controls = [
        ...dialog.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)",
        ),
      ];
      if (controls.length === 0) return false;
      const current = controls.indexOf(
        document.activeElement as HTMLButtonElement,
      );
      const index =
        current < 0
          ? 0
          : (current + direction + controls.length) % controls.length;
      controls[index]!.focus();
      return true;
    },
    hasOpenDialog: () => openDialog() !== null,
    consumeFocusGameRequest() {
      const requested = focusGameRequested;
      focusGameRequested = false;
      return requested;
    },
    getLifecycleDiagnostics: () => ({
      disposed,
      listenerRegistrations: disposed ? 0 : listenerRegistrations,
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const button of upgradeButtons) {
        button.removeEventListener("click", onUpgradeClick);
      }
      retryButton.removeEventListener("click", onRetry);
      resumeButton.removeEventListener("click", onResume);
      for (const button of newRunButtons) {
        button.removeEventListener("click", onNewRun);
      }
      mute.removeEventListener("change", onMute);
      master.removeEventListener("input", onMaster);
      effects.removeEventListener("input", onEffects);
      ambience.removeEventListener("input", onAmbience);
      for (const dialog of dialogs) {
        dialog.removeEventListener("cancel", preventDialogCancel);
        dialog.removeEventListener("keydown", trapDialogFocus);
        if (dialog.open) dialog.close();
      }
    },
  };
}
