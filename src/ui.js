const SOUND_CONTROL_STATES = Object.freeze({
  locked: Object.freeze({
    icon: '🔈',
    label: '开启声音',
    pressed: false,
    busy: false,
    disabled: false,
  }),
  loading: Object.freeze({
    icon: '…',
    label: '正在加载声音',
    pressed: false,
    busy: true,
    disabled: true,
  }),
  playing: Object.freeze({
    icon: '🔊',
    label: '关闭声音',
    pressed: false,
    busy: false,
    disabled: false,
  }),
  muted: Object.freeze({
    icon: '🔇',
    label: '开启声音',
    pressed: true,
    busy: false,
    disabled: false,
  }),
  error: Object.freeze({
    icon: '⚠',
    label: '重试声音',
    pressed: false,
    busy: false,
    disabled: false,
  }),
});

/**
 * @param {AudioFeedbackSnapshot} snapshot
 * @returns {'locked'|'loading'|'playing'|'muted'|'error'}
 */
export function deriveSoundState(snapshot) {
  if (snapshot.muted) return 'muted';
  if (
    snapshot.contextState === 'unavailable'
    || snapshot.assetState === 'error'
    || snapshot.musicState.playback === 'error'
  ) return 'error';
  if (snapshot.musicState.playback === 'loading') return 'loading';
  if (snapshot.musicState.playback === 'playing') return 'playing';
  return 'locked';
}

export function createGameUi({
  shell,
  title,
  missionHud,
  missionStep,
  missionTitle,
  missionClue,
  objective,
  subtitle,
  approachPrompt,
  interaction,
  tutorialHint,
  compass,
  compassLabel,
  compassDistance,
  marker,
  dangerState,
  completionToast,
  muteToggle,
}) {
  let subtitleTimer;
  let completionTimer;
  let completionActive = false;

  function setText(element, value) {
    const text = String(value);
    if (element.textContent !== text) element.textContent = text;
  }

  function setHidden(element, value) {
    const hidden = Boolean(value);
    if (element.hidden !== hidden) element.hidden = hidden;
  }

  function setDataset(element, name, value) {
    const text = String(value);
    if (element.dataset[name] !== text) element.dataset[name] = text;
  }

  function setStyle(element, name, value) {
    const text = String(value);
    if (element.style.getPropertyValue(name) !== text) {
      element.style.setProperty(name, text);
    }
  }

  shell.dataset.uiPhase = 'intro';
  title.setAttribute('aria-hidden', 'false');
  interaction.hidden = true;

  function completeIntro() {
    shell.dataset.uiPhase = 'playing';
    title.setAttribute('aria-hidden', 'true');
  }

  function setObjective(text) {
    setText(objective, text.replace(/^目标：/, ''));
  }

  function showSubtitle(text, duration = 4200) {
    clearTimeout(subtitleTimer);
    subtitle.textContent = text;
    subtitle.dataset.visible = 'true';
    subtitleTimer = setTimeout(() => {
      subtitle.dataset.visible = 'false';
    }, duration);
  }

  function showInteraction(label) {
    setHidden(interaction, !label);
    setText(interaction.querySelector('span'), label ?? '');
  }

  function renderMission(definition) {
    if (completionActive) return;
    setText(missionStep, `任务 ${definition.step}/${definition.total}`);
    setText(missionTitle, definition.title);
    setText(missionClue, definition.clue);
    setObjective(definition.objective);
    setDataset(missionHud, 'state', 'active');
  }

  function renderGuidance(definition, snapshot, screenMarker) {
    const visible = Boolean(snapshot.targetPosition);
    setHidden(compass, completionActive || !visible);
    setHidden(marker, completionActive || !visible || !screenMarker);
    setHidden(approachPrompt, completionActive || snapshot.proximity !== 'approach');
    setHidden(
      interaction,
      completionActive || snapshot.proximity !== 'interact' || !definition.actionLabel,
    );
    if (!visible) return;
    setText(compassLabel, definition.title);
    setText(compassDistance, snapshot.distanceLabel);
    setStyle(compass, '--bearing', `${snapshot.relativeAngle}rad`);
    if (screenMarker) {
      setStyle(
        marker,
        'transform',
        `translate3d(${screenMarker.x}px, ${screenMarker.y}px, 0)`,
      );
      setDataset(marker, 'edge', screenMarker.edge);
    }
    setText(approachPrompt, `靠近：${definition.title}`);
    setText(interaction.querySelector('span'), definition.actionLabel ?? '');
  }

  function renderDanger(snapshot) {
    setDataset(shell, 'danger', snapshot.mode);
    setHidden(dangerState, snapshot.mode === 'safe');
    setText(dangerState, snapshot.label);
    setStyle(shell, '--danger-intensity', snapshot.intensity.toFixed(3));
  }

  function showCompletion(definition) {
    completionActive = true;
    missionStep.textContent = `任务 ${definition.step}/${definition.total}`;
    missionTitle.textContent = definition.title;
    missionClue.textContent = definition.clue;
    completionToast.textContent = `✓ ${definition.title}`;
    completionToast.hidden = false;
    missionHud.dataset.state = 'complete';
    clearTimeout(completionTimer);
    completionTimer = setTimeout(() => {
      completionActive = false;
      completionToast.hidden = true;
      missionHud.dataset.state = 'active';
    }, 800);
  }

  function showTutorial(tutorial) {
    tutorialHint.hidden = !tutorial;
    tutorialHint.textContent = tutorial?.text ?? '';
  }

  function renderSoundState(state) {
    const definition = SOUND_CONTROL_STATES[state];
    setDataset(muteToggle, 'audioState', state);
    muteToggle.setAttribute('aria-label', definition.label);
    muteToggle.setAttribute('title', definition.label);
    muteToggle.setAttribute('aria-pressed', String(definition.pressed));
    muteToggle.setAttribute('aria-busy', String(definition.busy));
    muteToggle.disabled = definition.disabled;
    setText(muteToggle, definition.icon);
  }

  function onSoundToggle(handler) {
    muteToggle.addEventListener('click', handler);
  }

  function setMuted(muted) {
    renderSoundState(muted ? 'muted' : 'playing');
  }

  function onMute(handler) {
    onSoundToggle(handler);
  }

  const introTimer = setTimeout(completeIntro, 2400);

  return {
    completeIntro() {
      clearTimeout(introTimer);
      completeIntro();
    },
    setObjective,
    showSubtitle,
    showInteraction,
    renderMission,
    renderGuidance,
    renderDanger,
    showCompletion,
    showTutorial,
    renderSoundState,
    onSoundToggle,
    setMuted,
    onMute,
    get transitionActive() { return completionActive; },
  };
}
