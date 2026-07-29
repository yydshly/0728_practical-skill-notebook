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

  function setMuted(muted) {
    muteToggle.setAttribute('aria-pressed', String(muted));
    muteToggle.setAttribute('aria-label', muted ? '开启音效' : '关闭音效');
    muteToggle.textContent = muted ? '🔇' : '🔊';
  }

  function onMute(handler) {
    muteToggle.addEventListener('click', handler);
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
    setMuted,
    onMute,
    get transitionActive() { return completionActive; },
  };
}
