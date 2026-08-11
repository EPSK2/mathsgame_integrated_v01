(() => {
  const SETTINGS_KEY = "ps_settings";

  const MODES = {
    TURN: "turn",
    RACE: "race",
  };

  const OPERATION_MODES = {
    ADD: "add", // addition only
    SUB: "sub", // subtraction only
    MIXED: "mixed", // randomly choose addition or subtraction per question
  };

  // When true, the background image will also move horizontally with the leaves.
  // Only the X-axis is affected; Y parallax remains as before.
  const BACKGROUND_FOLLOWS_X = true;

  const WORLD = Object.freeze({

    arenaWidth: 360,
    arenaHeight: 560,
    bearAnchorX: 180,
    bearAnchorY: 448,
    visibleSteps: 3,
    stepGap: 110,
    stepOffsetsX: [-42, 0, 42],
    forwardStepDistance: 24,
    recyclePadding: 60,
    stepWidths: {
      small: 78,
      medium: 96,
      large: 118,
    },
    bearWidths: {
      small: 74,
      medium: 84,
      large: 94,
    },
  });

  class SpriteAnimator {
    constructor(options) {
      this.element = options.element;
      this.frameWidth = options.frameWidth;
      this.frameHeight = options.frameHeight;
      this.columns = options.columns;
      this.imageUrl = options.imageUrl;
      this.loop = Boolean(options.loop);
      this._frames = [];
      this._frameDurationMs = 120;
      this._currentFrameIndex = 0;
      this._accumulator = 0;
      this._lastTimestamp = null;
      this._rafId = null;
      this._isRunning = false;
      this._onComplete = null;

      if (this.element && this.imageUrl) {
        this.element.style.backgroundImage = `url("${this.imageUrl}")`;
      }
      if (this.element) {
        this.element.style.width = `${this.frameWidth}px`;
        this.element.style.height = `${this.frameHeight}px`;
        this.element.style.backgroundRepeat = "no-repeat";
      }
    }

    play(frameIndices, frameDurationMs = 120, options = {}) {
      if (!this.element || !Array.isArray(frameIndices) || frameIndices.length === 0) {
        return Promise.resolve();
      }

      this.stop();

      this._frames = frameIndices.slice();
      this._frameDurationMs = frameDurationMs;
      this.loop = Boolean(options.loop);
      this._currentFrameIndex = 0;
      this._accumulator = 0;
      this._lastTimestamp = null;
      this._isRunning = true;

      // Ensure element is visible while animating.
      if (options.autoShow !== false) {
        this.element.style.display = "block";
      }

      this._applyFrame(this._frames[0]);

      return new Promise((resolve) => {
        this._onComplete = resolve;
        this._rafId = window.requestAnimationFrame(this._tick.bind(this));
      });
    }

    stop() {
      if (this._rafId != null) {
        window.cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
      if (this._isRunning && this._onComplete) {
        this._onComplete();
      }
      this._isRunning = false;
      this._onComplete = null;
      this._lastTimestamp = null;
      this._accumulator = 0;
    }

    _tick(timestamp) {
      if (!this._isRunning) return;

      if (this._lastTimestamp == null) {
        this._lastTimestamp = timestamp;
      }
      const delta = timestamp - this._lastTimestamp;
      this._lastTimestamp = timestamp;
      this._accumulator += delta;

      let advanced = false;

      while (this._accumulator >= this._frameDurationMs && this._isRunning) {
        this._accumulator -= this._frameDurationMs;
        this._currentFrameIndex += 1;
        if (this._currentFrameIndex >= this._frames.length) {
          if (this.loop) {
            this._currentFrameIndex = 0;
          } else {
            this.stop();
            return;
          }
        }
        this._applyFrame(this._frames[this._currentFrameIndex]);
        advanced = true;
      }

      if (!advanced) {
        // Ensure current frame is drawn even if no frame boundary crossed.
        this._applyFrame(this._frames[this._currentFrameIndex]);
      }

      this._rafId = window.requestAnimationFrame(this._tick.bind(this));
    }

    _applyFrame(frameIndex) {
      if (!this.element) return;
      const col = frameIndex % this.columns;
      const row = Math.floor(frameIndex / this.columns);
      const x = -col * this.frameWidth;
      const y = -row * this.frameHeight;
      this.element.style.backgroundPosition = `${x}px ${y}px`;
    }
  }

  const savedSettings = loadSettings();

  let currentSettings = { ...savedSettings };

  const state = {

    mode: savedSettings.mode,
    operationMode: savedSettings.operationMode,
    addMaxSum: savedSettings.addMaxSum,
    subMaxMinuend: savedSettings.subMaxMinuend,
    // Kept for backwards-compatibility in some calculations (uses addition difficulty)
    maxSum: savedSettings.addMaxSum,

    totalStepsToWin: 10,
    totalRaceQuestions: 10,
    timerRunning: false,
    raceStartTimeMs: null,
    timerIntervalId: null,
    countdownIntervalId: null,
    npcAttemptTimeoutId: null,
    pendingResetFrameId: null,
    gameOver: false,
    hasGameplayStarted: false,
    inputEnabled: true,
    answerDigits: "",

    // Turn mode
    turnQuestion: null,
    questionResolved: false,

    // Race mode
    raceQuestions: [],
    playerQuestionIndex: 0,
    npcQuestionIndex: 0,

    // Movement and score
    playerSteps: 0,
    npcSteps: 0,
    npcAttemptCount: 0,
  };

  const modeButtons = document.querySelectorAll(".mode-selector .toggle-button");
  const difficultyButtons = document.querySelectorAll(".difficulty-selector .toggle-button");
    const stepsCountEl = document.getElementById("steps-count");
    const npcStatusEl = document.getElementById("npc-status");
  const timerDisplayEl = document.getElementById("timer-display");
  const questionAEl = document.getElementById("question-a");
  const questionOpEl = document.getElementById("question-op");
  const questionBEl = document.getElementById("question-b");
  const answerDisplayEl = document.getElementById("answer-display");

  const keypadButtons = document.querySelectorAll(".keypad .key[data-digit]");
  const clearButton = document.querySelector(".clear-button");
  const submitButton = document.querySelector(".submit-button");
  const feedbackEl = document.getElementById("feedback");

  // River progress flags
  const riverPlayerFlagEl = document.querySelector(".progress-flag-good");
  const riverNpcFlagEl = document.querySelector(".progress-flag-bad");
  const riverPlayerColumnImageEl = document.querySelector(".river-column-left .river-column-image");
  const riverNpcColumnImageEl = document.querySelector(".river-column-right .river-column-image");

  const progress = {
    player: 0,
    npc: 0,
  };


  const countdownOverlayEl = document.getElementById("countdown-overlay");
  const countdownValueEl = document.getElementById("countdown-value");

  const finishOverlay = document.getElementById("finish-overlay");
  const finishTitleEl = document.getElementById("finish-title");
  const finishMessageEl = document.getElementById("finish-message");
  const playAgainButton = document.getElementById("play-again-button");

    const lanes = {
    player: createLane(
      document.querySelector(".jump-arena-player"),
      document.querySelector(".path-player"),
      document.querySelector(".bear-anchor-player"),
      document.querySelector(".character-player"),
      document.querySelectorAll(".path-player .step")
    ),
    npc: createLane(
      document.querySelector(".jump-arena-npc"),
      document.querySelector(".path-npc"),
      document.querySelector(".bear-anchor-npc"),
      document.querySelector(".character-npc"),
      document.querySelectorAll(".path-npc .step")
    ),
  };

  const playerSpriteEl = document.querySelector(".character-player-sprite");
  const npcSpriteEl = document.querySelector(".character-npc-sprite");

    const spriteAnimators = {
    player: playerSpriteEl
      ? new SpriteAnimator({
          element: playerSpriteEl,
          frameWidth: 256,
          frameHeight: 256,
          columns: 4,
          imageUrl: "./bear-mario_jump-v1.png",
          loop: false,
        })
      : null,
    npc: npcSpriteEl
      ? new SpriteAnimator({
          element: npcSpriteEl,
          frameWidth: 256,
          frameHeight: 256,
          columns: 4,
          imageUrl: "./bad_bear-mario_jump_4-v1.png",
          loop: false,
        })
      : null,
  };



        function createLane(arenaEl, pathEl, bearAnchorEl, bearEl, stepsEls) {
    return {
      arenaEl,
      pathEl,
      bearAnchorEl,
      bearEl,
      stepsEls,
      centers: [],
      currentPelletIndex: 0,
      bearX: WORLD.bearAnchorX,
      bearY: WORLD.bearAnchorY,
    };
  }


  function laneReady(lane) {
    return Boolean(
      lane &&
        lane.arenaEl &&
        lane.pathEl &&
        lane.bearAnchorEl &&
        lane.bearEl &&
        lane.stepsEls.length
    );
  }

    function init() {
    syncSettingsUiFromState();
    attachEventListeners();
    requestAnimationFrame(() => {
      cacheAllLaneCenters();
      resetGame();
    });
  }


  function attachEventListeners() {
        modeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const selectedMode = btn.dataset.mode;
        if (!selectedMode || selectedMode === state.mode) return;
        state.mode = selectedMode;
        persistSettings({ mode: selectedMode });
        modeButtons.forEach((b) => {
          b.classList.toggle("active", b.dataset.mode === selectedMode);
        });
        resetGame();
      });
    });

    difficultyButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const maxSum = Number(btn.dataset.maxSum || 10);
        if (maxSum === state.addMaxSum) return;
        state.addMaxSum = maxSum;
        state.maxSum = maxSum;
        persistSettings({ addMaxSum: maxSum });
        difficultyButtons.forEach((b) => {
          b.classList.toggle("active", Number(b.dataset.maxSum) === maxSum);
        });
        resetGame();
      });
    });


    keypadButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!state.inputEnabled || state.gameOver) return;
        const digit = btn.dataset.digit;
        if (!digit) return;
        if (state.answerDigits.length >= 2) return;
        state.answerDigits += digit;
        updateAnswerDisplay();
        clearFeedback();
      });
    });

    clearButton.addEventListener("click", () => {
      if (!state.inputEnabled || state.gameOver) return;
      state.answerDigits = "";
      updateAnswerDisplay();
      clearFeedback();
    });

    submitButton.addEventListener("click", handleSubmitAnswer);

    window.addEventListener("keydown", (event) => {
      // Space: normal hop
      if (event.code === "Space") {
        event.preventDefault();
        if (state.gameOver) return;
        triggerHop(lanes.player.bearEl);
        return;
      }

      // Shift + 7: debug trigger of Mario pose animation (no mirror by default)
      if (event.code === "Digit7" && event.shiftKey) {
        event.preventDefault();
        playPlayerPoseAnimation(false);
        return;
      }
    });


    playAgainButton.addEventListener("click", () => {
      hideFinishOverlay();
      resetGame();
    });
  }

  function cancelPendingResetFrame() {
    if (state.pendingResetFrameId != null) {
      window.cancelAnimationFrame(state.pendingResetFrameId);
      state.pendingResetFrameId = null;
    }
  }

  function queueLaneResetAlignment(onReady) {
    cancelPendingResetFrame();
    state.pendingResetFrameId = window.requestAnimationFrame(() => {
      state.pendingResetFrameId = window.requestAnimationFrame(() => {
        state.pendingResetFrameId = null;
        cacheAllLaneCenters();
        updateAllStepVisuals();
        realignLanes();
        if (typeof onReady === "function") {
          onReady();
        }
      });
    });
  }

  function resetGame() {
    hideFinishOverlay();
    clearFeedback();
    stopNpcAttempts();
    stopTimer();
    stopCountdown();
    cancelPendingResetFrame();

    state.gameOver = false;
    state.hasGameplayStarted = false;
    state.inputEnabled = true;
    state.answerDigits = "";
    state.playerSteps = 0;
    state.npcSteps = 0;
    state.npcAttemptCount = 0;
    state.questionResolved = false;
    state.turnQuestion = null;
    state.raceQuestions = [];
    state.playerQuestionIndex = 0;
    state.npcQuestionIndex = 0;

  // Reset world motion; lane geometry is recached after layout settles.
    resetLaneMotion(lanes.player);
    resetLaneMotion(lanes.npc);


    // Reset river progress flags.
    progress.player = 0;
    progress.npc = 0;
    if (riverPlayerFlagEl) {
      riverPlayerFlagEl.style.transform = "translate(-25%, 0) scale(1)";
    }
    if (riverNpcFlagEl) {
      riverNpcFlagEl.style.transform = "translate(-25%, 0) scale(1)";
    }


    timerDisplayEl.textContent = state.mode === MODES.RACE ? "0.0 s" : "-";
    updateStepsStatus();
    updateAnswerDisplay();

    queueLaneResetAlignment(() => {
      if (state.mode === MODES.RACE) {
        startRaceMode();
        return;
      }

      startTurnRoundCountdown();
    });
  }

    function startRaceMode() {
    state.hasGameplayStarted = true;
    realignLanes();
    setInputEnabled(true);
    state.raceQuestions = Array.from({ length: state.totalRaceQuestions }, () =>
      createQuestion()
    );
    updateDisplayedQuestion();
    npcStatusEl.textContent = "Thinking...";
    scheduleNpcAttempt();
  }


  function startTurnRoundCountdown() {
    state.inputEnabled = false;
    setInputEnabled(false);
    state.answerDigits = "";
    updateAnswerDisplay();
    questionAEl.textContent = "?";
    questionBEl.textContent = "?";
    npcStatusEl.textContent = "Waiting for countdown...";

    showCountdown(3, () => {
      if (state.gameOver) return;
            state.hasGameplayStarted = true;
      realignLanes();
      state.turnQuestion = createQuestion();

      state.questionResolved = false;
      state.npcAttemptCount = 0;
      updateDisplayedQuestion();
      state.inputEnabled = true;
      setInputEnabled(true);
      npcStatusEl.textContent = "Thinking...";
      scheduleNpcAttempt();
    });
  }

  function showCountdown(seconds, onDone) {
    stopCountdown();
    countdownOverlayEl.hidden = false;
    countdownValueEl.textContent = String(seconds);

    let remaining = seconds;
    state.countdownIntervalId = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        stopCountdown();
        onDone();
        return;
      }
      countdownValueEl.textContent = String(remaining);
    }, 1000);
  }

  function stopCountdown() {
    if (state.countdownIntervalId != null) {
      window.clearInterval(state.countdownIntervalId);
      state.countdownIntervalId = null;
    }
    countdownOverlayEl.hidden = true;
  }

  function setInputEnabled(enabled) {
    submitButton.disabled = !enabled;
    clearButton.disabled = !enabled;
    keypadButtons.forEach((btn) => {
      btn.disabled = !enabled;
    });
  }

    function updateDisplayedQuestion() {
    const question = getCurrentPlayerQuestion();
    if (!question) {
      questionAEl.textContent = "-";
      questionBEl.textContent = "-";
      if (questionOpEl) {
        questionOpEl.textContent = "+";
      }
      return;
    }

    questionAEl.textContent = String(question.a);
    questionBEl.textContent = String(question.b);
    if (questionOpEl) {
      questionOpEl.textContent = question.op || "+";
    }
  }


  function getCurrentPlayerQuestion() {
    if (state.mode === MODES.TURN) {
      return state.turnQuestion;
    }

    if (state.playerQuestionIndex >= state.raceQuestions.length) {
      return null;
    }

    return state.raceQuestions[state.playerQuestionIndex];
  }

  function getCurrentNpcQuestion() {
    if (state.mode === MODES.TURN) {
      return state.turnQuestion;
    }

    if (state.npcQuestionIndex >= state.raceQuestions.length) {
      return null;
    }

    return state.raceQuestions[state.npcQuestionIndex];
  }

  function handleSubmitAnswer() {
    if (!state.inputEnabled || state.gameOver) return;

    const playerQuestion = getCurrentPlayerQuestion();
    if (!playerQuestion) {
      showFeedback("No question left on your track.", false);
      return;
    }

    if (!state.answerDigits) {
      showFeedback("Tap numbers to make your answer.", false);
      return;
    }

    const answer = Number(state.answerDigits);
    if (Number.isNaN(answer)) {
      showFeedback("That is not a valid number.", false);
      return;
    }

    if (answer === playerQuestion.sum) {
      resolvePlayerCorrect();
    } else {
      showFeedback("Not correct yet. Try again.", false);
    }
  }

        function resolvePlayerCorrect() {
    if (state.mode === MODES.TURN) {
      if (state.questionResolved) return;
      state.questionResolved = true;
      stopNpcAttempts();
      state.playerSteps = Math.min(state.playerSteps + 1, state.totalStepsToWin);

      // Decide sprite flip based on where the upcoming leaf is relative to the bear.
      const upcomingSide = getUpcomingLeafSide(lanes.player);
      const shouldMirror = upcomingSide === "left"; // mirror when leaf is on the left

      animateLaneAdvance(lanes.player, state.playerSteps);
      advanceProgressFlag("player");
      showFeedback("Correct. You jump to the next pellet.", true);

      if (upcomingSide) {
        playPlayerPoseAnimation(shouldMirror);
      }

      npcStatusEl.textContent = "Lost this question.";
      updateStepsStatus();
      updateAllStepVisuals();


      if (state.playerSteps >= state.totalStepsToWin) {
        finishTurnMode();
        return;
      }

      startTurnRoundCountdown();
      return;
    }

    if (state.playerQuestionIndex >= state.totalRaceQuestions) return;

        state.playerQuestionIndex += 1;
    state.playerSteps = Math.min(state.playerSteps + 1, state.totalStepsToWin);

    const upcomingSide = getUpcomingLeafSide(lanes.player);
    const shouldMirror = upcomingSide === "left";

    animateLaneAdvance(lanes.player, state.playerSteps);
    advanceProgressFlag("player");
    showFeedback("Correct. You clear your next race question.", true);

    if (upcomingSide) {
      playPlayerPoseAnimation(shouldMirror);
    }



    if (!state.timerRunning) {
      startTimer();
    }

    state.answerDigits = "";
    state.npcAttemptCount = 0;
    updateAnswerDisplay();
    updateDisplayedQuestion();
    updateStepsStatus();
    updateAllStepVisuals();

    if (state.playerQuestionIndex >= state.totalRaceQuestions) {
      finishRaceMode("player");
    }
  }

        function resolveNpcCorrect() {
    if (state.mode === MODES.TURN) {
      if (state.questionResolved) return;
      state.questionResolved = true;
      stopNpcAttempts();
      state.npcSteps = Math.min(state.npcSteps + 1, state.totalStepsToWin);
      animateLaneAdvance(lanes.npc, state.npcSteps);
      advanceProgressFlag("npc");

      const upcomingNpcSide = getUpcomingLeafSide(lanes.npc);
      const npcShouldMirror = upcomingNpcSide === "left";
      if (upcomingNpcSide) {
        playNpcPoseAnimation(npcShouldMirror);
      }

      showFeedback("NPC solved this one first.", false);
      npcStatusEl.textContent = "Correct.";
      updateStepsStatus();
      updateAllStepVisuals();


      if (state.npcSteps >= state.totalStepsToWin) {
        finishTurnMode();
        return;
      }

      startTurnRoundCountdown();
      return;
    }

    if (state.npcQuestionIndex >= state.totalRaceQuestions) return;

        state.npcQuestionIndex += 1;
    state.npcSteps = Math.min(state.npcSteps + 1, state.totalStepsToWin);
    animateLaneAdvance(lanes.npc, state.npcSteps);
    advanceProgressFlag("npc");

    const upcomingNpcSide = getUpcomingLeafSide(lanes.npc);
    const npcShouldMirror = upcomingNpcSide === "left";
    if (upcomingNpcSide) {
      playNpcPoseAnimation(npcShouldMirror);
    }

    npcStatusEl.textContent = "Correct. Moving to next race question.";


    if (!state.timerRunning) {
      startTimer();
    }

    state.npcAttemptCount = 0;
    updateStepsStatus();
    updateAllStepVisuals();

    if (state.npcQuestionIndex >= state.totalRaceQuestions) {
      finishRaceMode("npc");
      return;
    }

    scheduleNpcAttempt();
  }


  function scheduleNpcAttempt() {
    stopNpcAttempts();

    if (state.gameOver) return;
    if (state.mode === MODES.TURN && (!state.inputEnabled || state.questionResolved)) return;

    const npcQuestion = getCurrentNpcQuestion();
    if (!npcQuestion) return;

    const delayMs = getNpcDelayMs();
    state.npcAttemptTimeoutId = window.setTimeout(() => {
      npcAttempt();
    }, delayMs);
  }

  function npcAttempt() {
    if (state.gameOver) return;

    if (state.mode === MODES.TURN) {
      if (!state.inputEnabled || state.questionResolved || !state.turnQuestion) return;
    }

    const npcQuestion = getCurrentNpcQuestion();
    if (!npcQuestion) return;

    state.npcAttemptCount += 1;

    if (npcGetsCorrectAnswer()) {
      resolveNpcCorrect();
      return;
    }

    npcStatusEl.textContent = "Missed. Retrying...";
    scheduleNpcAttempt();
  }

    function getNpcDelayMs() {
      const base = state.mode === MODES.RACE ? 3060 : 3780;
      const difficultyPenalty = state.addMaxSum > 10 ? 280 : 0;
      const attemptPenalty = state.npcAttemptCount * 360;
      const jitter = randomInt(-180, 280);
      return Math.max(450, base + difficultyPenalty + attemptPenalty + jitter);
    }


    function npcGetsCorrectAnswer() {
      const baseAccuracy = state.addMaxSum > 10 ? 0.64 : 0.78;
      const attemptBonus = Math.min(0.22, state.npcAttemptCount * 0.07);
      return Math.random() < baseAccuracy + attemptBonus;
    }


    function stopNpcAttempts() {
    if (state.npcAttemptTimeoutId != null) {
      window.clearTimeout(state.npcAttemptTimeoutId);
      state.npcAttemptTimeoutId = null;
    }
  }

    // --- WORLD / LEAF MAP TRANSFORM HELPERS ---
  function setStepTier(step, tier) {
    step.tier = tier;
    step.width = WORLD.stepWidths[tier];
  }

  function initializeLaneWorld(lane) {
    if (!laneReady(lane)) return;

    lane.bearX = WORLD.bearAnchorX;
    lane.bearY = WORLD.bearAnchorY;
    lane.currentPelletIndex = 0;
    lane.centers = Array.from({ length: WORLD.visibleSteps }, (_, index) => ({
      x: WORLD.bearAnchorX + WORLD.stepOffsetsX[index],
      y: WORLD.bearAnchorY - WORLD.stepGap * (index + 1),
      tier: "small",
      width: WORLD.stepWidths.small,
    }));

    lockLaneWorldToBear(lane);
    applySizeTierToLane(lane);
    renderLane(lane);
  }

  function moveLaneWorldDown(lane, stepDistance) {
    if (!laneReady(lane)) return;

    lane.centers.forEach((step) => {
      step.y += stepDistance;
    });
  }

  function findNextTargetPelletIndex(lane) {
    if (!laneReady(lane) || !lane.centers.length) return null;

    let targetIndex = null;
    let maxY = -Infinity;

    lane.centers.forEach((step, index) => {
      if (step.y < lane.bearY && step.y > maxY) {
        maxY = step.y;
        targetIndex = index;
      }
    });

    return targetIndex;
  }

    function findUpcomingPelletIndex(lane) {
    if (!laneReady(lane) || !lane.centers.length) return null;

    let targetIndex = null;
    let maxY = -Infinity;

    lane.centers.forEach((step, index) => {
      if (index === lane.currentPelletIndex) return;
      if (step.y < lane.bearY && step.y > maxY) {
        maxY = step.y;
        targetIndex = index;
      }
    });

    return targetIndex;
  }

  function getUpcomingLeafSide(lane) {
    if (!laneReady(lane) || !lane.centers.length) return null;
    const idx = findUpcomingPelletIndex(lane);
    if (idx == null) return null;
    const step = lane.centers[idx];
    if (!step) return null;
    const dx = step.x - lane.bearX;
    if (Math.abs(dx) < 1) return "center";
    return dx > 0 ? "right" : "left";
  }

  function lockLaneWorldToBear(lane) {

    if (!laneReady(lane) || !lane.centers.length) return;

    const targetIndex = findNextTargetPelletIndex(lane);
    if (targetIndex == null) return;

    const targetStep = lane.centers[targetIndex];
    const dx = lane.bearX - targetStep.x;
    const dy = lane.bearY - targetStep.y;

    lane.centers.forEach((step) => {
      step.x += dx;
      step.y += dy;
    });

    lane.currentPelletIndex = targetIndex;
  }

  function recycleLaneLeaves(lane) {
    if (!laneReady(lane) || !lane.centers.length) return;

    lane.centers.forEach((step) => {
      if (step.y <= WORLD.arenaHeight + WORLD.recyclePadding) {
        return;
      }

      const topMostY = Math.min(...lane.centers.map((candidate) => candidate.y));
      const offset = WORLD.stepOffsetsX[randomInt(0, WORLD.stepOffsetsX.length - 1)] || 0;
      step.x = WORLD.bearAnchorX + offset;
      step.y = topMostY - WORLD.stepGap;
    });
  }

  function applySizeTierToLane(lane) {
    if (!laneReady(lane) || !lane.centers.length) return;

    const ranked = lane.centers
      .map((step, index) => ({ index, worldY: step.y }))
      .sort((a, b) => a.worldY - b.worldY);

    ranked.forEach((entry, position) => {
      if (position === ranked.length - 1) {
        setStepTier(lane.centers[entry.index], "large");
      } else if (position === ranked.length - 2) {
        setStepTier(lane.centers[entry.index], "medium");
      } else {
        setStepTier(lane.centers[entry.index], "small");
      }
    });
  }

  function renderLane(lane) {
    if (!laneReady(lane)) return;

    const upcomingPelletIndex = state.hasGameplayStarted ? findUpcomingPelletIndex(lane) : null;

    lane.arenaEl.style.setProperty("--scene-shift-y", "0px");
    lane.arenaEl.style.setProperty(
      "--scene-shift-x",
      BACKGROUND_FOLLOWS_X ? "0px" : "0px"
    );

    lane.stepsEls.forEach((stepEl, index) => {
      const step = lane.centers[index];
      if (!step) {
        stepEl.classList.add("inactive");
        return;
      }

      const shouldShowStep =
        index === lane.currentPelletIndex ||
        (state.hasGameplayStarted && index === upcomingPelletIndex);

      if (!shouldShowStep) {
        stepEl.classList.add("inactive");
        return;
      }

      stepEl.classList.remove("inactive");
      stepEl.style.left = `${step.x}px`;
      stepEl.style.top = `${step.y}px`;
      stepEl.style.width = `${step.width}px`;
    });

    lane.bearAnchorEl.style.left = `${lane.bearX}px`;
    lane.bearAnchorEl.style.top = `${lane.bearY}px`;

    const activeStep = lane.centers[Math.min(lane.currentPelletIndex, lane.centers.length - 1)];
    const tier = activeStep ? activeStep.tier : "medium";
    lane.bearEl.style.width = `${WORLD.bearWidths[tier]}px`;
  }


  // --- JUMP / ANIMATION INTEGRATION ---
  function animateLaneAdvance(lane, stepsWon) {


    if (!laneReady(lane)) return;

    // Visual hop: bear is anchored; only its local transform changes.
    triggerHop(lane.bearEl);

      // World forward drift: move leaf map DOWN toward viewer.
    moveLaneWorldDown(lane, WORLD.forwardStepDistance);

    // Target lock: snap the next pellet under the bear's feet.
    lockLaneWorldToBear(lane);

    // Keep leaf distribution sparse by recycling off-screen leaves.
    recycleLaneLeaves(lane);

    // Apply discrete size tiers so the bottom-most pad is large.
    applySizeTierToLane(lane);

    renderLane(lane);
  }




                function cacheAllLaneCenters() {
    Object.values(lanes).forEach((lane) => {
      if (!laneReady(lane)) return;
      initializeLaneWorld(lane);

      lane.stepsEls.forEach((stepEl, index) => {
        if (index >= WORLD.visibleSteps) {
          stepEl.classList.add("inactive");
        }
      });
    });
  }




    function realignLanes() {
      renderLane(lanes.player);
      renderLane(lanes.npc);
  }

        function resetLaneMotion(lane) {
    if (!laneReady(lane)) return;
    initializeLaneWorld(lane);
  }


  function advanceProgressFlag(who) {
    const totalQuestions = state.mode === MODES.RACE ? state.totalRaceQuestions : state.totalStepsToWin;
    if (!totalQuestions) return;

    const flagEl = who === "player" ? riverPlayerFlagEl : riverNpcFlagEl;
    const columnImageEl = who === "player" ? riverPlayerColumnImageEl : riverNpcColumnImageEl;
    if (!flagEl || !columnImageEl) return;

    const rect = columnImageEl.getBoundingClientRect();
    const trackHeight = rect.height;
    if (!trackHeight) return;

    const current = progress[who] || 0;
    const step = 1 / totalQuestions;
    const next = Math.min(1, current + step);
    progress[who] = next;

    const offsetY = -next * trackHeight;

    // Animate: grow to 2x while moving, then shrink back to 1x.
    flagEl.style.transition = "transform 0.3s ease-out";
    flagEl.style.transform = `translate(-25%, ${offsetY}px) scale(2)`;

    window.setTimeout(() => {
      flagEl.style.transition = "transform 0.25s ease-in";
      flagEl.style.transform = `translate(-25%, ${offsetY}px) scale(1)`;
    }, 300);
  }





  function triggerHop(characterEl) {
    if (!characterEl) return;
    characterEl.classList.remove("jumping");
    void characterEl.offsetWidth;
    characterEl.classList.add("jumping");
  }

  function updateAllStepVisuals() {
    updateLaneStepVisual(lanes.player.stepsEls, state.playerSteps);
    updateLaneStepVisual(lanes.npc.stepsEls, state.npcSteps);
  }

  function updateLaneStepVisual(stepEls, stepsTaken) {
    stepEls.forEach((step) => {
      const idx = Number(step.dataset.index || 0);
      step.classList.toggle("completed", idx <= stepsTaken);
    });
  }

  function updateStepsStatus() {
    if (state.mode === MODES.RACE) {
      const p = Math.min(state.playerQuestionIndex + 1, state.totalRaceQuestions);
      const n = Math.min(state.npcQuestionIndex + 1, state.totalRaceQuestions);
      stepsCountEl.textContent = `You ${state.playerSteps} / NPC ${state.npcSteps} (You Q${p}, NPC Q${n})`;
      return;
    }

    stepsCountEl.textContent = `You ${state.playerSteps} / NPC ${state.npcSteps}`;
  }

  function updateAnswerDisplay() {
    answerDisplayEl.textContent = state.answerDigits || "?";
  }

  function showFeedback(message, isCorrect) {
    feedbackEl.textContent = message;
    feedbackEl.classList.remove("feedback--correct", "feedback--incorrect");
    feedbackEl.classList.add(isCorrect ? "feedback--correct" : "feedback--incorrect");
  }

  function clearFeedback() {
    feedbackEl.textContent = "";
    feedbackEl.classList.remove("feedback--correct", "feedback--incorrect");
  }

  function finishTurnMode() {
    state.gameOver = true;
    state.inputEnabled = false;
    setInputEnabled(false);
    stopNpcAttempts();
    stopCountdown();

    if (state.playerSteps > state.npcSteps) {
      finishTitleEl.textContent = "You Win";
      finishMessageEl.textContent = "You reached the top first.";
    } else if (state.playerSteps < state.npcSteps) {
      finishTitleEl.textContent = "NPC Wins";
      finishMessageEl.textContent = "NPC reached the top first.";
    } else {
      finishTitleEl.textContent = "Draw";
      finishMessageEl.textContent = "Both reached together.";
    }

    npcStatusEl.textContent = "Match over.";
    showFinishOverlay();
  }

  function finishRaceMode(winner) {
    state.gameOver = true;
    state.inputEnabled = false;
    setInputEnabled(false);
    stopNpcAttempts();
    stopTimer();

    const elapsedMs = state.raceStartTimeMs ? performance.now() - state.raceStartTimeMs : 0;
    const seconds = elapsedMs / 1000;

    if (winner === "player") {
      finishTitleEl.textContent = "You Win the Race";
    } else if (winner === "npc") {
      finishTitleEl.textContent = "NPC Wins the Race";
    } else {
      finishTitleEl.textContent = "Race Draw";
    }

    finishMessageEl.textContent = `Score You ${state.playerSteps} - NPC ${state.npcSteps}. Time ${seconds.toFixed(1)} s.`;
    npcStatusEl.textContent = "Race complete.";
    showFinishOverlay();
  }

  function startTimer() {
    if (state.timerRunning) return;
    state.timerRunning = true;
    state.raceStartTimeMs = performance.now();

    state.timerIntervalId = window.setInterval(() => {
      const elapsedMs = performance.now() - state.raceStartTimeMs;
      const seconds = elapsedMs / 1000;
      timerDisplayEl.textContent = `${seconds.toFixed(1)} s`;
    }, 100);
  }

  function stopTimer() {
    if (!state.timerRunning) return;
    state.timerRunning = false;
    if (state.timerIntervalId != null) {
      window.clearInterval(state.timerIntervalId);
      state.timerIntervalId = null;
    }
  }

    function showFinishOverlay() {
    finishOverlay.hidden = false;
  }

  function hideFinishOverlay() {
    finishOverlay.hidden = true;
  }

  // --- SETTINGS PERSISTENCE BETWEEN MENU AND GAME ---
  function loadSettings() {
    const defaults = {
      mode: MODES.TURN,
      operationMode: OPERATION_MODES.ADD,
      addMaxSum: 10,
      subMaxMinuend: 10,
    };

    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      return { ...defaults, ...parsed };
    } catch (e) {
      return defaults;
    }
  }

  function persistSettings(patch) {
    currentSettings = { ...currentSettings, ...patch };
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(currentSettings));
    } catch (e) {
      // Ignore storage errors.
    }
  }

  function syncSettingsUiFromState() {
    // Reflect saved mode and difficulty in the in-game toggles.
    modeButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === state.mode);
    });

    difficultyButtons.forEach((btn) => {
      const maxSum = Number(btn.dataset.maxSum || 10);
      btn.classList.toggle("active", maxSum === state.addMaxSum);
    });
  }

  // --- QUESTION GENERATION (ADDITION / SUBTRACTION / MIXED) ---
  function createQuestion() {
    const opMode = state.operationMode || OPERATION_MODES.ADD;

    let chosenMode = opMode;
    if (opMode === OPERATION_MODES.MIXED) {
      chosenMode = Math.random() < 0.5 ? OPERATION_MODES.ADD : OPERATION_MODES.SUB;
    }

    if (chosenMode === OPERATION_MODES.SUB) {
      return createSubtractionQuestion(state.subMaxMinuend);
    }

    // Default to addition.
    return createAdditionQuestion(state.addMaxSum);
  }

  function createAdditionQuestion(maxSum) {
    let a = 0;
    let b = 0;
    let sum = 0;
    do {
      a = randomInt(0, 9);
      b = randomInt(0, 9);
      sum = a + b;
    } while (sum > maxSum || sum === 0);

    return { a, b, sum, op: "+" };
  }

    function createSubtractionQuestion(maxMinuend) {
    // Build subtraction as the inverse of single-digit addition:
    // choose digits x and y (0-9), let minuend = x + y (<= maxMinuend),
    // question is: minuend - x = y.
    let x = 0;
    let y = 0;
    let minuend = 0;

    do {
      x = randomInt(0, 9);
      y = randomInt(0, 9);
      minuend = x + y;
    } while (minuend === 0 || minuend > maxMinuend || y === 0);

    const subtrahend = x;
    const difference = y;

    return {
      a: minuend,
      b: subtrahend,
      sum: difference,
      op: "-",
    };
  }

  function playPlayerPoseAnimation(mirrorHorizontally) {
    if (!spriteAnimators.player || !playerSpriteEl) return;

    const baseBear = document.querySelector(".character-player");
    if (baseBear) {
      baseBear.style.visibility = "hidden";
    }

    const baseScale = 0.875;
    const scaleX = mirrorHorizontally ? -baseScale : baseScale;
    playerSpriteEl.style.transform = `translate(-50%, calc(-100% + 28px)) scale(${scaleX}, ${baseScale})`;
    playerSpriteEl.style.display = "block";

    // Example sequence for "turn and pose". Adjust as needed.
    const sequence = [12, 14, 0, 1, 2, 3];

    spriteAnimators.player.play(sequence, 120, { loop: false }).then(() => {
      if (baseBear) {
        baseBear.style.visibility = "";
      }
      playerSpriteEl.style.display = "none";
    });
  }


  function playNpcPoseAnimation(mirrorHorizontally) {
    if (!spriteAnimators.npc || !npcSpriteEl) return;

    const baseBear = document.querySelector(".character-npc");
    if (baseBear) {
      baseBear.style.visibility = "hidden";
    }

    const baseScale = 0.7;
    const scaleX = mirrorHorizontally ? -baseScale : baseScale;
    npcSpriteEl.style.transform = `translate(-50%, calc(-100% + 40px)) scale(${scaleX}, ${baseScale})`;
    npcSpriteEl.style.display = "block";

    // Use all 16 frames (0–15) for now.
    const sequence = [6, 8, 10, 4, 15];

    spriteAnimators.npc.play(sequence, 120, { loop: false }).then(() => {
      if (baseBear) {
        baseBear.style.visibility = "";
      }
      npcSpriteEl.style.display = "none";
    });
  }

  // Expose helpers for manual triggering / debugging.
  window.playPlayerPoseAnimation = playPlayerPoseAnimation;
  window.playNpcPoseAnimation = playNpcPoseAnimation;


  function randomInt(min, maxInclusive) {

    return Math.floor(Math.random() * (maxInclusive - min + 1)) + min;
  }


  init();

})();
