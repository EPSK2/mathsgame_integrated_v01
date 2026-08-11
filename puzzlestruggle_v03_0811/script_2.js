(() => {
  const SETTINGS_KEY = "ps_settings";
  const STAGE_DURATION_MS = 1000;
  const FIRST_STAGE = "player-count";
  const PREVIOUS_STAGE = {
    challenge: "player-count",
    "battle-mode": "challenge",
    difficulty: "battle-mode",
  };

  const flowState = {
    playerCount: null,
    operationMode: null,
    battleMode: null,
  };

  let activeStageName = FIRST_STAGE;
  let menuBgm = null;

  function saveSettings(settings) {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage write failures.
    }
  }

  function buildSettings(operationMode, difficultyLimit) {
    return {
      operationMode,
      addMaxSum: difficultyLimit,
      subMaxMinuend: difficultyLimit,
      addAutoMode: true,
      subAutoMode: true,
    };
  }

  function updateBackButton() {
    const backButton = document.getElementById("menu2-back-button");
    if (!backButton) {
      return;
    }

    backButton.hidden = activeStageName === FIRST_STAGE;
  }

  function showStage(stageName, { animate = false, direction = "forward" } = {}) {
    const stages = document.querySelectorAll(".menu2-stage");
    const currentStage = document.querySelector(".menu2-stage.is-active");
    const nextStage = document.querySelector(`.menu2-stage[data-stage="${stageName}"]`);

    if (!nextStage) {
      return;
    }

    activeStageName = stageName;
    updateBackButton();

    if (!animate || !currentStage || currentStage === nextStage) {
      stages.forEach((stage) => {
        stage.classList.remove("is-active", "is-entering", "is-exiting", "is-entering-back", "is-exiting-back");
      });
      nextStage.classList.add("is-active");
      return;
    }

    const nextEnterClass = direction === "backward" ? "is-entering-back" : "is-entering";
    const currentExitClass = direction === "backward" ? "is-exiting-back" : "is-exiting";

    currentStage.classList.remove("is-active");
    currentStage.classList.remove("is-entering", "is-exiting", "is-entering-back", "is-exiting-back");
    nextStage.classList.remove("is-entering", "is-exiting", "is-entering-back", "is-exiting-back");
    currentStage.classList.add(currentExitClass);
    nextStage.classList.add(nextEnterClass);

    window.clearTimeout(showStage.timeoutId);
    showStage.timeoutId = window.setTimeout(() => {
      stages.forEach((stage) => {
        stage.classList.remove("is-active", "is-entering", "is-exiting", "is-entering-back", "is-exiting-back");
      });
      nextStage.classList.add("is-active");
    }, STAGE_DURATION_MS);
  }

  function goToGame(url, operationMode, difficultyLimit) {
    const settings = buildSettings(operationMode, difficultyLimit);
    saveSettings(settings);
    window.location.href = url;
  }

  function onPlayerCountClick(event) {
    playMenuBgm();

    const button = event.currentTarget;
    const playerCount = button.dataset.playerCount;
    if (!playerCount) {
      return;
    }

    flowState.playerCount = playerCount;
    showStage("challenge", { animate: true });
  }

  function onOperationClick(event) {
    playMenuBgm();

    const button = event.currentTarget;
    const operationMode = button.dataset.operationMode;
    if (!operationMode) {
      return;
    }

    flowState.operationMode = operationMode;

    if (flowState.playerCount === "1") {
      goToGame("./index.html", operationMode, 10);
      return;
    }

    showStage("battle-mode", { animate: true });
  }

  function onBattleModeClick(event) {
    playMenuBgm();

    const button = event.currentTarget;
    const battleMode = button.dataset.battleMode;
    if (!battleMode) {
      return;
    }

    flowState.battleMode = battleMode;
    showStage("difficulty", { animate: true });
  }

  function onDifficultyClick(event) {
    playMenuBgm();

    const button = event.currentTarget;
    const difficulty = Number(button.dataset.difficulty || 10);
    const operationMode = flowState.operationMode || "add";
    const battleMode = flowState.battleMode || "2p";
    const targetUrl = battleMode === "2p-pass" ? "./index.html?mode=2p-pass" : "./index.html?mode=2p";

    goToGame(targetUrl, operationMode, difficulty);
  }

  function onBackClick() {
    playMenuBgm();

    const previousStage = PREVIOUS_STAGE[activeStageName];
    if (!previousStage) {
      return;
    }

    if (activeStageName === "battle-mode") {
      flowState.battleMode = null;
    }

    showStage(previousStage, { animate: true, direction: "backward" });
  }

  function playMenuBgm() {
    if (!(menuBgm instanceof HTMLAudioElement)) {
      return;
    }

    const playPromise = menuBgm.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        // Browser may still block playback until allowed.
      });
    }
  }

  function attachEvents() {
    document.querySelectorAll(".menu2-button[data-player-count]").forEach((button) => {
      button.addEventListener("click", onPlayerCountClick);
    });

    document.querySelectorAll(".menu2-button[data-operation-mode]").forEach((button) => {
      button.addEventListener("click", onOperationClick);
    });

    document.querySelectorAll(".menu2-button[data-battle-mode]").forEach((button) => {
      button.addEventListener("click", onBattleModeClick);
    });

    document.querySelectorAll(".menu2-button[data-difficulty]").forEach((button) => {
      button.addEventListener("click", onDifficultyClick);
    });

    const backButton = document.getElementById("menu2-back-button");
    if (backButton) {
      backButton.addEventListener("click", onBackClick);
    }
  }

  function initMenuBgm() {
    menuBgm = document.getElementById("menu2-bgm");
    if (!(menuBgm instanceof HTMLAudioElement)) {
      return;
    }

    menuBgm.volume = 0.5;
    menuBgm.loop = true;

    playMenuBgm();

    const unlockAndPlay = () => {
      playMenuBgm();
      document.removeEventListener("pointerdown", unlockAndPlay, true);
      document.removeEventListener("keydown", unlockAndPlay, true);
    };

    document.addEventListener("pointerdown", unlockAndPlay, true);
    document.addEventListener("keydown", unlockAndPlay, true);
  }

  function init() {
    attachEvents();
    initMenuBgm();
    showStage(FIRST_STAGE);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
