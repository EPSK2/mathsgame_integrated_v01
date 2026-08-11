(() => {
  const DEFAULT_STEPS = 10;
  const ROUND_DURATION_MS = 60000;
  const FIRST_WINDOW_MS = 30000;
  const SETTINGS_KEY = "ps_settings";
  const SCORE_HISTORY_KEY = "mathgame_human_score_history";
  const RECENT_THREE_KEY = "mathgame_recent_3_array";
  const STARTUP_COUNTDOWN_SECONDS = 3;
  const BEAR_JUMP_ANIMATION_MS = 820;
  const BEAR_CONFUSED_ANIMATION_MS = 1500;
  const LEFT_BEAR_STAND_SRC = "./good_bear_1_stand.png";
  const LEFT_BEAR_JUMP_SRC = "./good_bear_1_jump.png";
  const RIGHT_BEAR_STAND_SRC = "./bad_bear_stand.png";
  const RIGHT_BEAR_JUMP_SRC = "./bad_bear_jump.png";
  const RIGHT_BEAR_MULTIPLAYER_STAND_SRC = "./good_bear_2_stand.png";
  const RIGHT_BEAR_MULTIPLAYER_JUMP_SRC = "./good_bear_2_jump.png";
  const RIGHT_HEAD_MULTIPLAYER_SRC = "./good_head.png";
  const TIMER_CUE_30S = "chime_30s.mp3";
  const TIMER_CUE_10S = "chime_10s.mp3";
  const TIMER_CUE_5S = "countdown_5s.mp3";
  const TIMER_CUE_0S = "end_0s.mp3";
  const IN_GAME_MUSIC = "Challenge_Lap_loop.mp3";
  const IN_GAME_MUSIC_VOLUME = 0.1;
  const IN_GAME_MUSIC_FADE_OUT_MS = 1000;
  const END_MUSIC_HUMAN_WIN = "Gold_Medal_Run.mp3";
  const END_MUSIC_HUMAN_LOSE = "The_Bouncy_Backfire_loop.mp3";
  const END_MUSIC_2P = "Final_Boss_Farewell_loop.mp3";
  const END_MUSIC_FADE_IN_MS = 1000;
  const END_RANK_REVEAL_MS = 5000;
  const END_MUSIC_START_MS = 6000;
  const QUESTION_SLIDE_DURATION_MS = 150;
  const QUESTION_ORB_FLIGHT_MS = 1000;
  const TWO_PLAYER_QUESTION_GROUP_SIZE = 5;
  const DEFAULT_RECENT_THREE = [3, 4, 5];
  const LEFT_FIRE_SPRITESHEET_URL = "./good_fire.png";
  const RIGHT_FIRE_SPRITESHEET_URL = "./bad_fire.png";
  const RIGHT_FIRE_SPRITESHEET_URL_MULTIPLAYER = "./good_2_fire.png";
  const FIRE_FRAME_WIDTH = 725;
  const FIRE_FRAME_HEIGHT = 1204;
  const FIRE_FRAME_COLUMNS = 7;
  const FIRE_FRAME_DURATION_MS = 80;
  const FIRE_SCALE_MULTIPLIER = 2.5;
  const LEFT_FIRE_FRAMES = [9, 10, 11, 10];
  const RIGHT_FIRE_FRAMES = [9, 10, 11, 10];
  const END_OVERLAY_FADE_MS = 4000;
  const PASS_TURN_DURATION_MS = 60000;
  const PASS_TURN_TRANSITION_COUNTDOWN_SECONDS = 3;
  const END_FACE_BEAR_SRC = "./good_bear_face_front.png";
  const END_FACE_BEAR_SRC_RIGHT_MULTIPLAYER = "./good_bear_2_face_front.png";
  const END_FACE_BEAR_SRC_BAD = "./bad_bear_face_front.png";
  const END_FIRST_BEAR_SRC = "./good_bear_front-jump.png";
  const END_FIRST_BEAR_SRC_RIGHT_MULTIPLAYER = "./good_bear_2_front-jump.png";
  const END_SECOND_BEAR_SRC = "./good_bear_front-clapping_hands.png";
  const END_SECOND_BEAR_SRC_RIGHT_MULTIPLAYER = "./good_bear_2_front-clapping_hands.png";
  const END_SINGLE_WIN_BEAR_SRC_BAD = "./bad_bear_front-evil_laugh.png";
  const END_SINGLE_LOSE_BEAR_SRC_GOOD = "./bear_front-deep_breath.png";
  const END_SINGLE_LOSE_BEAR_SRC_BAD = "./bad_bear-sad.png";
  const END_DOUBLE_CELEBRATION_BEAR_SRC = "./bear_double_celebration.png";
  const END_BEAR_SPRITE_COLUMNS = 4;
  const END_BEAR_SPRITE_ROWS = 4;
  const END_DOUBLE_CELEBRATION_COLUMNS = 5;
  const END_DOUBLE_CELEBRATION_ROWS = 2;
  const END_BEAR_FRAME_DURATION_MS = 120;
  const END_SCORE_COUNT_MS = 3000;
  const WINNER_CONFETTI_INTERVAL_MS = 220;
  // Edit these arrays to choose which spritesheet frames loop for each rank.
  const END_FIRST_BEAR_LOOP_FRAMES = [0, 1, 2, 3];
  const END_SECOND_BEAR_LOOP_FRAMES = [0, 1, 2, 3];
  const END_DOUBLE_CELEBRATION_LOOP_FRAMES = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 6, 7, 8];
  // 1P-specific loops for the dedicated bad-win and good-lose spritesheets.
  const END_SINGLE_WIN_BAD_LOOP_FRAMES = [8, 9, 10, 10, 11, 12, 11, 10, 10, 9];
  const END_SINGLE_LOSE_GOOD_LOOP_FRAMES = [4, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 12];
  const END_SINGLE_LOSE_BAD_LOOP_FRAMES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const ui = {
    leftTrack: document.getElementById("left-progress-track"),
    rightTrack: document.getElementById("right-progress-track"),
    leftFill: document.getElementById("left-progress-fill"),
    rightFill: document.getElementById("right-progress-fill"),
    goodFlag: document.getElementById("progress-good-flag"),
    badFlag: document.getElementById("progress-bad-flag"),
    leftParticles: document.querySelector('[data-particle-layer="left"]'),
    rightParticles: document.querySelector('[data-particle-layer="right"]'),
    leftQuestionBox: document.querySelector('.ui-left-layout .ui-question-box'),
    rightQuestionBox: document.querySelector('.ui-right-layout .ui-question-box'),
    leftQuestion: document.getElementById("left-question"),
    rightQuestion: document.getElementById("right-question"),
    leftAnswer: document.getElementById("left-answer"),
    rightAnswer: document.getElementById("right-answer"),
    leftScoreBox: document.getElementById("left-score-box"),
    rightScoreBox: document.getElementById("right-score-box"),
    timerValue: document.getElementById("round-timer"),
    startupCountdown: document.getElementById("startup-countdown"),
    startupCountdownValue: document.getElementById("startup-countdown-value"),
    keys: document.querySelectorAll(".key"),
    leftKeys: document.querySelectorAll('.key[data-side="left"]'),
    rightKeys: document.querySelectorAll('.key[data-side="right"]'),
    leftPanelBox: document.querySelector('.ui-left-layout .ui-panel-box'),
    rightPanelBox: document.querySelector('.ui-right-layout .ui-panel-box'),
    leftBearColumn: document.querySelector('.ui-left-layout .ui-bear-column'),
    rightBearColumn: document.querySelector('.ui-right-layout .ui-bear-column'),
    leftBear: document.querySelector('.ui-left-layout .ui-bear-stand'),
    rightBear: document.querySelector('.ui-right-layout .ui-bear-stand'),
    rightRoundHead: document.querySelector('.ui-round-badge-bad .ui-round-head'),
    endOverlay: document.getElementById("end-overlay"),
    endBearRow: document.querySelector(".ui-end-bear-row"),
    endActionRestartButton: document.getElementById("end-action-restart"),
    endActionHomeButton: document.getElementById("end-action-home"),
    passTurnOverlay: document.getElementById("pass-turn-overlay"),
    passTurnContinueButton: document.getElementById("pass-turn-continue"),
  };

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

  const fireFx = {
    left: {
      side: "left",
      element: null,
      animator: null,
      trackingRafId: null,
      isRunning: false,
      frameSequence: LEFT_FIRE_FRAMES.slice(),
      imageUrl: LEFT_FIRE_SPRITESHEET_URL,
    },
    right: {
      side: "right",
      element: null,
      animator: null,
      trackingRafId: null,
      isRunning: false,
      frameSequence: RIGHT_FIRE_FRAMES.slice(),
      imageUrl: RIGHT_FIRE_SPRITESHEET_URL,
    },
  };

  function loadSettings() {
    const defaults = {
      operationMode: "add",
      addMaxSum: 10,
      subMaxMinuend: 10,
      addAutoMode: false,
      subAutoMode: false,
    };

    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      if (!raw) {
        return defaults;
      }

      const parsed = JSON.parse(raw);
      return { ...defaults, ...parsed };
    } catch {
      return defaults;
    }
  }

  function loadGameMode() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      const rawMode = String(params.get("mode") || "").toLowerCase();
      if (rawMode === "2p-pass" || rawMode === "pass-and-play" || rawMode === "two-player-pass") {
        return "2p-pass";
      }

      return rawMode === "2p" || rawMode === "two-player" ? "2p" : "single";
    } catch {
      return "single";
    }
  }

  const initialSettings = loadSettings();
  const initialGameMode = loadGameMode();

  function applyOperationModeClasses() {
    if (!document.body) {
      return;
    }

    document.body.classList.remove("mode-add", "mode-sub", "mode-mixed", "mode-single-op", "mode-multiplayer");

    if (state.isTwoPlayer) {
      document.body.classList.add("mode-multiplayer");
    }

    if (state.operationMode === "mixed") {
      document.body.classList.add("mode-mixed");
      return;
    }

    if (state.operationMode === "sub") {
      document.body.classList.add("mode-sub");
    } else {
      document.body.classList.add("mode-add");
    }

    if (!state.isTwoPlayer) {
      document.body.classList.add("mode-single-op");
    }
  }

  function getRightBearStandSrc() {
    return state.isTwoPlayer ? RIGHT_BEAR_MULTIPLAYER_STAND_SRC : RIGHT_BEAR_STAND_SRC;
  }

  function getRightBearJumpSrc() {
    return state.isTwoPlayer ? RIGHT_BEAR_MULTIPLAYER_JUMP_SRC : RIGHT_BEAR_JUMP_SRC;
  }

  function applyMultiplayerSideAssets() {
    fireFx.right.imageUrl = state.isTwoPlayer ? RIGHT_FIRE_SPRITESHEET_URL_MULTIPLAYER : RIGHT_FIRE_SPRITESHEET_URL;

    if (ui.rightRoundHead) {
      ui.rightRoundHead.src = state.isTwoPlayer ? RIGHT_HEAD_MULTIPLAYER_SRC : "./bad_head.png";
      ui.rightRoundHead.alt = state.isTwoPlayer ? "Right good side head" : "Bad side head";
    }

    if (ui.rightBear) {
      ui.rightBear.src = getRightBearStandSrc();
    }
  }

  function createAdditionQuestion(maxSum) {
    const boundedMaxSum = Math.max(0, Math.min(18, Number(maxSum) || 0));
    const sum = randomInt(0, boundedMaxSum);
    const firstAddend = randomInt(Math.max(0, sum - 9), Math.min(9, sum));
    const secondAddend = sum - firstAddend;

    return {
      a: firstAddend,
      b: secondAddend,
      sum,
    };
  }

  function createSubtractionQuestion(maxMinuend) {
    const cappedMinuend = Math.max(1, Math.min(18, Number(maxMinuend) || 0));
    const minuend = randomInt(1, cappedMinuend);
    const minimumAnswer = Math.max(0, minuend - 9);
    const answer = randomInt(minimumAnswer, Math.min(9, minuend));
    const subtrahend = minuend - answer;

    return {
      minuend,
      subtrahend,
      answer,
    };
  }

  function createQuestion(operation) {
    if (operation === "sub") {
      return createSubtractionQuestion(getOperationDifficultyLimit("sub"));
    }

    return createAdditionQuestion(getOperationDifficultyLimit("add"));
  }

  function createQuestionForMode() {
    if (state.operationMode === "mixed") {
      return createQuestion(Math.random() < 0.5 ? "add" : "sub");
    }

    return createQuestion(state.operationMode);
  }

  function formatQuestion(question) {
    if (!question) {
      return "";
    }

    if (question.sum != null) {
      return `${question.a} + ${question.b} =`;
    }

    return `${question.minuend} - ${question.subtrahend} =`;
  }

  function getQuestionOperation(question) {
    if (!question) {
      return "add";
    }

    return question.sum != null ? "add" : "sub";
  }

  function isAutoModeEnabledForOperation(operation) {
    return operation === "sub" ? state.subAutoMode : state.addAutoMode;
  }

  function getAutoRuntimeForOperation(operation) {
    return operation === "sub" ? state.autoDifficultyRuntime.sub : state.autoDifficultyRuntime.add;
  }

  function getOperationDifficultyLimit(operation) {
    if (!isAutoModeEnabledForOperation(operation)) {
      return operation === "sub" ? state.subMaxMinuend : state.addMaxSum;
    }

    const runtime = getAutoRuntimeForOperation(operation);
    if (!runtime.decisionMade) {
      return 10;
    }

    return runtime.hardModeEnabled ? 18 : 10;
  }

  function invalidateFutureQuestions() {
    const maxResolvedIndex = Math.max(state.leftQuestionIndex, state.rightQuestionIndex);
    if (state.isTwoPlayer) {
      state.leftQuestionDeck = state.leftQuestionDeck.slice(0, maxResolvedIndex + 1);
      state.rightQuestionDeck = state.rightQuestionDeck.slice(0, maxResolvedIndex + 1);
      return;
    }

    state.questionDeck = state.questionDeck.slice(0, maxResolvedIndex + 1);
  }

  function maybeFinalizeAutoDifficultyForOperation(operation) {
    const runtime = getAutoRuntimeForOperation(operation);
    if (runtime.decisionMade || runtime.resolvedCount < 3) {
      return;
    }

    runtime.decisionMade = true;
    if (runtime.firstTryCorrectCount >= 3) {
      runtime.hardModeEnabled = true;
    } else if (runtime.firstTryCorrectCount === 2) {
      runtime.hardModeEnabled = Math.random() < 0.5;
    } else {
      runtime.hardModeEnabled = false;
    }

    invalidateFutureQuestions();
  }

  function recordHumanResolutionForAutoMode(question, attemptsTaken) {
    if (!question) {
      return;
    }

    const operation = getQuestionOperation(question);
    if (!isAutoModeEnabledForOperation(operation)) {
      return;
    }

    const runtime = getAutoRuntimeForOperation(operation);
    if (runtime.decisionMade || runtime.resolvedCount >= 3) {
      return;
    }

    runtime.resolvedCount += 1;
    if (attemptsTaken === 1) {
      runtime.firstTryCorrectCount += 1;
    }

    maybeFinalizeAutoDifficultyForOperation(operation);
  }

  function areQuestionsEqual(first, second) {
    if (!first || !second) {
      return false;
    }

    const firstIsAddition = first.sum != null;
    const secondIsAddition = second.sum != null;

    if (firstIsAddition !== secondIsAddition) {
      return false;
    }

    if (firstIsAddition) {
      return first.a === second.a && first.b === second.b;
    }

    return first.minuend === second.minuend && first.subtrahend === second.subtrahend;
  }

  function createDistinctQuestion(previousQuestion) {
    if (!previousQuestion) {
      return createQuestionForMode();
    }

    const maxAttempts = 40;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const nextQuestion = createQuestionForMode();
      if (!areQuestionsEqual(nextQuestion, previousQuestion)) {
        return nextQuestion;
      }
    }

    return createQuestionForMode();
  }

  function createDistinctQuestionAvoiding(previousQuestion, excludedQuestion) {
    const maxAttempts = 120;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const nextQuestion = createQuestionForMode();
      const differsFromPrevious = !previousQuestion || !areQuestionsEqual(nextQuestion, previousQuestion);
      const differsFromExcluded = !excludedQuestion || !areQuestionsEqual(nextQuestion, excludedQuestion);
      if (differsFromPrevious && differsFromExcluded) {
        return nextQuestion;
      }
    }

    return createQuestionForMode();
  }

  function appendTwoPlayerQuestionGroup() {
    let previousLeftQuestion = state.leftQuestionDeck[state.leftQuestionDeck.length - 1] || null;
    let previousRightQuestion = state.rightQuestionDeck[state.rightQuestionDeck.length - 1] || null;

    for (let slot = 0; slot < TWO_PLAYER_QUESTION_GROUP_SIZE; slot += 1) {
      let leftQuestion = createDistinctQuestion(previousLeftQuestion);
      let rightQuestion = createDistinctQuestion(previousRightQuestion);

      if (areQuestionsEqual(leftQuestion, rightQuestion)) {
        rightQuestion = createDistinctQuestionAvoiding(previousRightQuestion, leftQuestion);
      }

      if (areQuestionsEqual(leftQuestion, rightQuestion)) {
        leftQuestion = createDistinctQuestionAvoiding(previousLeftQuestion, rightQuestion);
      }

      state.leftQuestionDeck.push(leftQuestion);
      state.rightQuestionDeck.push(rightQuestion);
      previousLeftQuestion = leftQuestion;
      previousRightQuestion = rightQuestion;
    }
  }

  function getTwoPlayerQuestionAt(side, index) {
    while (state.leftQuestionDeck.length <= index || state.rightQuestionDeck.length <= index) {
      appendTwoPlayerQuestionGroup();
    }

    return side === "right" ? state.rightQuestionDeck[index] : state.leftQuestionDeck[index];
  }

  function getQuestionAt(index) {
    while (state.questionDeck.length <= index) {
      const previousQuestion = state.questionDeck[state.questionDeck.length - 1] || null;
      state.questionDeck.push(createDistinctQuestion(previousQuestion));
    }

    return state.questionDeck[index];
  }

  const state = {
    roundToken: 0,
    gameMode: initialGameMode,
    isTwoPlayer: initialGameMode === "2p" || initialGameMode === "2p-pass",
    isPassAndPlay: initialGameMode === "2p-pass",
    operationMode: initialSettings.operationMode,
    addMaxSum: initialSettings.addMaxSum,
    subMaxMinuend: initialSettings.subMaxMinuend,
    addAutoMode: Boolean(initialSettings.addAutoMode),
    subAutoMode: Boolean(initialSettings.subAutoMode),
    leftInput: "",
    rightInput: "",
    leftScore: 0,
    rightScore: 0,
    questionDeck: [],
    leftQuestionDeck: [],
    rightQuestionDeck: [],
    leftQuestionIndex: 0,
    rightQuestionIndex: 0,
    leftQuestion: null,
    rightQuestion: null,
    leftQuestionAnimating: false,
    rightQuestionAnimating: false,
    requiredSteps: DEFAULT_STEPS,
    dynamicAdjusted: false,
    kFirst30: 0,
    frozenProgressAt30: 0,
    aLastThree: 0,
    leftBarWasFull: false,
    rightBarWasFull: false,
    leftFullThreshold: null,
    rightFullThreshold: null,
    leftParticleTimerId: null,
    rightParticleTimerId: null,
    leftBearJumpTimerId: null,
    rightBearJumpTimerId: null,
    leftBearConfusedTimerId: null,
    rightBearConfusedTimerId: null,
    timers: [],
    timerIntervalId: null,
    timerAlertTimeoutId: null,
    timerAlertSecond: null,
    roundEndsAtMs: 0,
    timerCuePlayedSeconds: new Set(),
    leftQuestionAttemptCount: 0,
    rightQuestionAttemptCount: 0,
    autoDifficultyRuntime: {
      add: {
        resolvedCount: 0,
        firstTryCorrectCount: 0,
        decisionMade: false,
        hardModeEnabled: false,
      },
      sub: {
        resolvedCount: 0,
        firstTryCorrectCount: 0,
        decisionMade: false,
        hardModeEnabled: false,
      },
    },
    roundEnded: false,
    endOverlayRevealTimerId: null,
    endOverlayRanksTimerId: null,
    endOverlayMusicTimerId: null,
    endMusic: null,
    endMusicFadeTimerId: null,
    inGameMusic: null,
    inGameMusicFadeTimerId: null,
    endBearLoopIntervalIds: {
      left: null,
      right: null,
    },
    endConfettiIntervalIds: {
      left: null,
      right: null,
    },
    passTurnOverlayVisible: false,
    activePassSide: "left",
    passPendingNextSide: "right",
    passTimeRemainingMs: {
      left: PASS_TURN_DURATION_MS,
      right: PASS_TURN_DURATION_MS,
    },
    passTurnTickLastMs: 0,
    passTimerCuePlayedSeconds: {
      left: new Set(),
      right: new Set(),
    },
    passTimerAlertPlayedSeconds: {
      left: new Set(),
      right: new Set(),
    },
    passTurnTransitionCountdownIntervalId: null,
    passTurnOverlayDelayTimerId: null,
    leftBearJumpEndsAtMs: 0,
    rightBearJumpEndsAtMs: 0,
    leftBearConfusedEndsAtMs: 0,
    rightBearConfusedEndsAtMs: 0,
    endScoreCountRafIds: {
      left: null,
      right: null,
    },

    left: {
      scoreHistory: loadScoreHistory(),
      recentThreeArray: loadRecentThreeArray(),
    },
  };

  function stopEndMusic() {
    if (state.endMusicFadeTimerId != null) {
      window.clearInterval(state.endMusicFadeTimerId);
      state.endMusicFadeTimerId = null;
    }

    if (!state.endMusic) {
      return;
    }

    state.endMusic.pause();
    state.endMusic.currentTime = 0;
    state.endMusic = null;
  }

  function playEndMusicLoop(fileName, options = {}) {
    stopEndMusic();

    const fadeInMs = Math.max(0, Number(options.fadeInMs) || 0);

    const audio = new Audio(fileName);
    audio.loop = true;
    audio.volume = fadeInMs > 0 ? 0 : 1;
    audio.play().catch(() => {
      // Ignore autoplay restrictions until the user interacts.
    });
    state.endMusic = audio;

    if (fadeInMs <= 0) {
      return;
    }

    const fadeStartAt = Date.now();
    state.endMusicFadeTimerId = window.setInterval(() => {
      if (state.endMusic !== audio) {
        window.clearInterval(state.endMusicFadeTimerId);
        state.endMusicFadeTimerId = null;
        return;
      }

      const elapsed = Date.now() - fadeStartAt;
      const progress = Math.max(0, Math.min(1, elapsed / fadeInMs));
      audio.volume = progress;

      if (progress >= 1) {
        window.clearInterval(state.endMusicFadeTimerId);
        state.endMusicFadeTimerId = null;
      }
    }, 100);
  }

  function stopInGameMusic() {
    if (state.inGameMusicFadeTimerId != null) {
      window.clearInterval(state.inGameMusicFadeTimerId);
      state.inGameMusicFadeTimerId = null;
    }

    if (!state.inGameMusic) {
      return;
    }

    state.inGameMusic.pause();
    state.inGameMusic.currentTime = 0;
    state.inGameMusic = null;
  }

  function playInGameMusicLoop() {
    stopInGameMusic();

    const audio = new Audio(IN_GAME_MUSIC);
    audio.loop = true;
    audio.volume = IN_GAME_MUSIC_VOLUME;
    audio.play().catch(() => {
      // Ignore autoplay restrictions until the user interacts.
    });

    state.inGameMusic = audio;
  }

  function fadeOutInGameMusic(durationMs = IN_GAME_MUSIC_FADE_OUT_MS) {
    if (state.inGameMusicFadeTimerId != null) {
      window.clearInterval(state.inGameMusicFadeTimerId);
      state.inGameMusicFadeTimerId = null;
    }

    const audio = state.inGameMusic;
    if (!audio) {
      return;
    }

    const fadeDurationMs = Math.max(0, Number(durationMs) || 0);
    if (fadeDurationMs <= 0) {
      stopInGameMusic();
      return;
    }

    const startVolume = Math.max(0, Math.min(1, Number(audio.volume) || 0));
    const fadeStartAt = Date.now();

    state.inGameMusicFadeTimerId = window.setInterval(() => {
      if (state.inGameMusic !== audio) {
        window.clearInterval(state.inGameMusicFadeTimerId);
        state.inGameMusicFadeTimerId = null;
        return;
      }

      const elapsed = Date.now() - fadeStartAt;
      const progress = Math.max(0, Math.min(1, elapsed / fadeDurationMs));
      audio.volume = startVolume * (1 - progress);

      if (progress >= 1) {
        window.clearInterval(state.inGameMusicFadeTimerId);
        state.inGameMusicFadeTimerId = null;
        stopInGameMusic();
      }
    }, 60);
  }

  function ensureEndBearLayout() {
    if (!ui.endBearRow) {
      return;
    }

    const existingSlots = ui.endBearRow.querySelectorAll(".ui-end-bear-slot");
    if (existingSlots.length >= 2) {
      return;
    }

    const bears = Array.from(ui.endBearRow.querySelectorAll(".ui-end-bear"));
    if (bears.length < 2) {
      return;
    }

    ui.endBearRow.innerHTML = "";

    bears.forEach((bear, index) => {
      const side = index === 0 ? "left" : "right";
      const slot = document.createElement("div");
      slot.className = "ui-end-bear-slot";
      slot.dataset.side = side;

      const rank = document.createElement("div");
      rank.className = "ui-end-rank-text";
      rank.dataset.side = side;
      rank.setAttribute("aria-live", "polite");

      const score = document.createElement("div");
      score.className = "ui-end-score-text";
      score.dataset.side = side;
      score.textContent = "0";

      slot.appendChild(bear);
      slot.appendChild(score);
      slot.appendChild(rank);
      ui.endBearRow.appendChild(slot);
    });
  }

  function getEndScoreElement(side) {
    if (!ui.endBearRow) {
      return null;
    }

    return ui.endBearRow.querySelector(`.ui-end-score-text[data-side="${side}"]`);
  }

  function setEndScoreText(side, value) {
    const scoreEl = getEndScoreElement(side);
    if (!scoreEl) {
      return;
    }

    scoreEl.textContent = String(Math.max(0, Math.floor(Number(value) || 0)));
  }

  function clearEndScoreEmphasis() {
    if (!ui.endBearRow) {
      return;
    }

    ["left", "right"].forEach((side) => {
      const scoreEl = getEndScoreElement(side);
      if (!scoreEl) {
        return;
      }

      scoreEl.classList.remove("is-emphasized", "is-glow-yellow", "is-glow-white");
    });
  }

  function clearEndScoreCountAnimation(side) {
    const rafId = state.endScoreCountRafIds[side];
    if (rafId == null) {
      return;
    }

    window.cancelAnimationFrame(rafId);
    state.endScoreCountRafIds[side] = null;
  }

  function clearAllEndScoreCountAnimations() {
    clearEndScoreCountAnimation("left");
    clearEndScoreCountAnimation("right");
    clearEndScoreEmphasis();
  }

  function animateEndScoreCount(side, targetScore, durationMs = END_SCORE_COUNT_MS, onComplete = null) {
    clearEndScoreCountAnimation(side);

    const safeTarget = Math.max(0, Math.floor(Number(targetScore) || 0));
    if (durationMs <= 0 || safeTarget <= 0) {
      setEndScoreText(side, safeTarget);
      if (typeof onComplete === "function") {
        onComplete();
      }
      return;
    }

    const startAtMs = performance.now();

    const tick = (nowMs) => {
      const elapsedMs = nowMs - startAtMs;
      const progress = Math.max(0, Math.min(1, elapsedMs / durationMs));
      const nextValue = Math.min(safeTarget, Math.floor(safeTarget * progress));
      setEndScoreText(side, nextValue);

      if (progress >= 1) {
        setEndScoreText(side, safeTarget);
        state.endScoreCountRafIds[side] = null;
        if (typeof onComplete === "function") {
          onComplete();
        }
        return;
      }

      state.endScoreCountRafIds[side] = window.requestAnimationFrame(tick);
    };

    setEndScoreText(side, 0);
    state.endScoreCountRafIds[side] = window.requestAnimationFrame(tick);
  }

  function applyEndScoreEmphasis(side, rankResult) {
    const scoreEl = getEndScoreElement(side);
    if (!scoreEl || !rankResult) {
      return;
    }

    scoreEl.classList.add("is-emphasized");
    scoreEl.classList.remove("is-glow-yellow", "is-glow-white");

    const suppressGlow = !state.isTwoPlayer && rankResult.firstSide === "right";
    if (suppressGlow) {
      return;
    }

    const isFirstPlace = rankResult.tie || rankResult.firstSide === side;
    scoreEl.classList.add(isFirstPlace ? "is-glow-yellow" : "is-glow-white");
  }

  function startEndScoreCountUp(rankResult) {
    animateEndScoreCount("left", state.leftScore, END_SCORE_COUNT_MS, () => {
      applyEndScoreEmphasis("left", rankResult);
    });
    animateEndScoreCount("right", state.rightScore, END_SCORE_COUNT_MS, () => {
      applyEndScoreEmphasis("right", rankResult);
    });
  }

  function updateEndRanks() {
    ensureEndBearLayout();

    if (!ui.endBearRow) {
      return;
    }

    const leftRank = ui.endBearRow.querySelector('.ui-end-rank-text[data-side="left"]');
    const rightRank = ui.endBearRow.querySelector('.ui-end-rank-text[data-side="right"]');
    if (!leftRank || !rightRank) {
      return;
    }

    if (state.isTwoPlayer && state.leftScore === state.rightScore) {
      leftRank.textContent = "第一名";
      leftRank.classList.add("is-first");
      leftRank.classList.remove("is-second");

      rightRank.textContent = "第一名";
      rightRank.classList.add("is-first");
      rightRank.classList.remove("is-second");

      return {
        tie: true,
        firstSide: "left",
        secondSide: "right",
      };
    }

    const leftWins = state.leftScore >= state.rightScore;

    if (leftWins) {
      leftRank.textContent = "第一名";
      leftRank.classList.add("is-first");
      leftRank.classList.remove("is-second");

      rightRank.textContent = "第二名";
      rightRank.classList.add("is-second");
      rightRank.classList.remove("is-first");
      return {
        firstSide: "left",
        secondSide: "right",
      };
    }

    rightRank.textContent = "第一名";
    rightRank.classList.add("is-first");
    rightRank.classList.remove("is-second");

    leftRank.textContent = "第二名";
    leftRank.classList.add("is-second");
    leftRank.classList.remove("is-first");

    return {
      firstSide: "right",
      secondSide: "left",
    };
  }

  function getEndBearBySide(side) {
    if (!ui.endBearRow) {
      return null;
    }

    return ui.endBearRow.querySelector(`.ui-end-bear-slot[data-side="${side}"] .ui-end-bear`);
  }

  function clearEndBearLoop(side) {
    const timerId = state.endBearLoopIntervalIds[side];
    if (timerId == null) {
      return;
    }

    window.clearInterval(timerId);
    state.endBearLoopIntervalIds[side] = null;
  }

  function clearAllEndBearLoops() {
    clearEndBearLoop("left");
    clearEndBearLoop("right");
  }

  function ensureEndConfettiLayers() {
    if (!ui.endOverlay) {
      return;
    }

    ["left", "right"].forEach((side) => {
      let layer = ui.endOverlay.querySelector(`.ui-end-confetti-layer[data-side="${side}"]`);
      if (layer) {
        return;
      }

      layer = document.createElement("div");
      layer.className = "ui-end-confetti-layer";
      layer.dataset.side = side;
      layer.setAttribute("aria-hidden", "true");
      ui.endOverlay.appendChild(layer);
    });
  }

  function getEndConfettiLayer(side) {
    if (!ui.endOverlay) {
      return null;
    }

    return ui.endOverlay.querySelector(`.ui-end-confetti-layer[data-side="${side}"]`);
  }

  function spawnWinnerConfetti(side, count = 14) {
    const layer = getEndConfettiLayer(side);
    if (!layer) {
      return;
    }

    for (let index = 0; index < count; index += 1) {
      const piece = document.createElement("span");
      piece.className = "ui-winner-confetti";

      const hue = Math.floor(Math.random() * 360);
      const saturation = 86 + Math.floor(Math.random() * 12);
      const lightness = 52 + Math.floor(Math.random() * 18);
      const rotation = Math.floor(Math.random() * 360);
      const startXPercent = 2 + Math.random() * 96;
      const driftX = (Math.random() - 0.5) * 22;
      const pieceWidth = 0.2 + Math.random() * 0.35;
      const pieceLength = 0.7 + Math.random() * 2.1;
      const duration = 1.8 + Math.random() * 2.2;
      const delay = Math.random() * 0.3;

      piece.style.setProperty("--start-x", `${startXPercent}%`);
      piece.style.setProperty("--drift-x", `${driftX}vw`);
      piece.style.setProperty("--piece-width", `${pieceWidth}rem`);
      piece.style.setProperty("--piece-length", `${pieceLength}rem`);
      piece.style.setProperty("--spin-start", `${rotation}deg`);
      piece.style.setProperty("--duration", `${duration}s`);
      piece.style.setProperty("--delay", `${delay}s`);
      piece.style.background = `hsl(${hue} ${saturation}% ${lightness}%)`;

      piece.addEventListener("animationend", () => {
        piece.remove();
      });

      layer.appendChild(piece);
    }
  }

  function stopWinnerConfetti(side) {
    const intervalId = state.endConfettiIntervalIds[side];
    if (intervalId != null) {
      window.clearInterval(intervalId);
      state.endConfettiIntervalIds[side] = null;
    }

    const layer = getEndConfettiLayer(side);
    if (layer) {
      layer.innerHTML = "";
    }
  }

  function stopAllWinnerConfetti() {
    stopWinnerConfetti("left");
    stopWinnerConfetti("right");
  }

  function startWinnerConfetti(side) {
    stopWinnerConfetti(side);
    spawnWinnerConfetti(side, 24);
    state.endConfettiIntervalIds[side] = window.setInterval(() => {
      spawnWinnerConfetti(side, 10);
    }, WINNER_CONFETTI_INTERVAL_MS);
  }

  function startWinnerConfettiForResult(rankResult) {
    stopAllWinnerConfetti();
    if (!rankResult) {
      return;
    }

    if (rankResult.tie) {
      startWinnerConfetti("left");
      startWinnerConfetti("right");
      return;
    }

    startWinnerConfetti(rankResult.firstSide === "right" ? "right" : "left");
  }

  function setEndBearFlipForSide(bearElement, side) {
    if (!bearElement) {
      return;
    }

    bearElement.classList.remove("is-flipped-right");
  }

  function setEndBearStaticSprite(side, imageUrl) {
    const bear = getEndBearBySide(side);
    if (!bear) {
      return;
    }

    clearEndBearLoop(side);
    bear.classList.remove("is-animated-sprite");
    bear.dataset.spriteColumns = "";
    bear.dataset.spriteFrame = "";
    bear.style.backgroundImage = `url("${imageUrl}")`;
    bear.style.backgroundRepeat = "no-repeat";
    bear.style.backgroundPosition = "center center";
    bear.style.backgroundSize = "contain";
  }

  function setEndBearSpriteFrame(bear, frameIndex, columns = END_BEAR_SPRITE_COLUMNS) {
    const col = frameIndex % columns;
    const row = Math.floor(frameIndex / columns);
    bear.style.backgroundPosition = `calc(-1 * ${col} * var(--end-bear-render-size)) calc(-1 * ${row} * var(--end-bear-render-size))`;
  }

  function startEndBearSpriteLoop(side, imageUrl, frameSequence, columns = END_BEAR_SPRITE_COLUMNS, rows = END_BEAR_SPRITE_ROWS) {
    const bear = getEndBearBySide(side);
    if (!bear || !Array.isArray(frameSequence) || frameSequence.length === 0) {
      return;
    }

    clearEndBearLoop(side);
    bear.classList.add("is-animated-sprite");

    bear.dataset.spriteColumns = String(columns);
    bear.style.backgroundImage = `url("${imageUrl}")`;
    bear.style.backgroundRepeat = "no-repeat";
    const rowCount = Math.max(1, rows);
    bear.style.backgroundSize = `calc(${columns} * var(--end-bear-render-size)) calc(${rowCount} * var(--end-bear-render-size))`;

    let frameCursor = 0;
    setEndBearSpriteFrame(bear, frameSequence[frameCursor], columns);

    state.endBearLoopIntervalIds[side] = window.setInterval(() => {
      frameCursor = (frameCursor + 1) % frameSequence.length;
      setEndBearSpriteFrame(bear, frameSequence[frameCursor], columns);
    }, END_BEAR_FRAME_DURATION_MS);
  }

  function startEndBearSharedSpriteLoop(imageUrl, frameSequence, columns = END_DOUBLE_CELEBRATION_COLUMNS, rows = END_DOUBLE_CELEBRATION_ROWS) {
    const leftBear = getEndBearBySide("left");
    const rightBear = getEndBearBySide("right");
    if (!leftBear || !rightBear || !Array.isArray(frameSequence) || frameSequence.length === 0) {
      return;
    }

    clearAllEndBearLoops();

    [leftBear, rightBear].forEach((bear) => {
      bear.classList.remove("is-animated-sprite");
      bear.dataset.spriteColumns = "";
      bear.dataset.spriteFrame = "";
      bear.style.backgroundImage = "";
      bear.style.backgroundRepeat = "";
      bear.style.backgroundSize = "contain";
      bear.style.backgroundPosition = "center center";
    });

    const centeredSprite = document.createElement("div");
    centeredSprite.className = "ui-end-tie-celebration";
    centeredSprite.setAttribute("aria-hidden", "true");
    centeredSprite.dataset.spriteColumns = String(columns);
    centeredSprite.style.backgroundImage = `url("${imageUrl}")`;
    centeredSprite.style.backgroundRepeat = "no-repeat";
    const rowCount = Math.max(1, rows);
    centeredSprite.style.backgroundSize = `calc(${columns} * var(--end-bear-render-size)) calc(${rowCount} * var(--end-bear-render-size))`;

    const existingCelebration = ui.endOverlay.querySelector(".ui-end-tie-celebration");
    if (existingCelebration) {
      existingCelebration.remove();
    }

    ui.endOverlay.appendChild(centeredSprite);

    let frameCursor = 0;
    const applyFrame = () => {
      const frameIndex = frameSequence[frameCursor];
      const col = frameIndex % columns;
      const row = Math.floor(frameIndex / columns);
      centeredSprite.style.backgroundPosition = `calc(-1 * ${col} * var(--end-bear-render-size)) calc(-1 * ${row} * var(--end-bear-render-size))`;
      frameCursor = (frameCursor + 1) % frameSequence.length;
    };

    applyFrame();
    const sharedTimerId = window.setInterval(applyFrame, END_BEAR_FRAME_DURATION_MS);
    state.endBearLoopIntervalIds.left = sharedTimerId;
    state.endBearLoopIntervalIds.right = sharedTimerId;
  }

  function applyDefaultEndResultBears() {
    const leftBear = getEndBearBySide("left");
    const rightBear = getEndBearBySide("right");
    if (!leftBear || !rightBear) {
      return;
    }

    const leftStaticSrc = leftBear.dataset.staticSrc || LEFT_BEAR_STAND_SRC;
    const rightStaticSrc = rightBear.dataset.staticSrc || RIGHT_BEAR_STAND_SRC;

    setEndBearStaticSprite("left", leftStaticSrc);
    setEndBearStaticSprite("right", rightStaticSrc);
    leftBear.classList.remove("is-flipped-right");
    rightBear.classList.remove("is-flipped-right");
  }

  function applyMultiplayerEndFaceBears() {
    setEndBearStaticSprite("left", END_FACE_BEAR_SRC);
    setEndBearStaticSprite("right", END_FACE_BEAR_SRC_RIGHT_MULTIPLAYER);

    const leftBear = getEndBearBySide("left");
    const rightBear = getEndBearBySide("right");
    if (leftBear) {
      leftBear.classList.remove("is-flipped-right");
    }
    if (rightBear) {
      rightBear.classList.remove("is-flipped-right");
    }
  }

  function applySinglePlayerEndFaceBears() {
    setEndBearStaticSprite("left", END_FACE_BEAR_SRC);
    setEndBearStaticSprite("right", END_FACE_BEAR_SRC_BAD);

    const leftBear = getEndBearBySide("left");
    const rightBear = getEndBearBySide("right");
    if (leftBear) {
      leftBear.classList.remove("is-flipped-right");
    }
    if (rightBear) {
      rightBear.classList.remove("is-flipped-right");
    }
  }

  function applyMultiplayerRankBears(rankResult) {
    if (!rankResult) {
      return;
    }

    if (rankResult.tie) {
      const leftBear = getEndBearBySide("left");
      const rightBear = getEndBearBySide("right");
      if (!leftBear || !rightBear) {
        return;
      }

      setEndBearFlipForSide(leftBear, "left");
      setEndBearFlipForSide(rightBear, "right");
      startEndBearSharedSpriteLoop(END_DOUBLE_CELEBRATION_BEAR_SRC, END_DOUBLE_CELEBRATION_LOOP_FRAMES, END_DOUBLE_CELEBRATION_COLUMNS, END_DOUBLE_CELEBRATION_ROWS);
      return;
    }

    const firstSide = rankResult.firstSide;
    const secondSide = rankResult.secondSide;
    const firstBear = getEndBearBySide(firstSide);
    const secondBear = getEndBearBySide(secondSide);
    if (!firstBear || !secondBear) {
      return;
    }

    setEndBearFlipForSide(firstBear, firstSide);
    setEndBearFlipForSide(secondBear, secondSide);
    const firstSpriteSrc = firstSide === "right" ? END_FIRST_BEAR_SRC_RIGHT_MULTIPLAYER : END_FIRST_BEAR_SRC;
    const secondSpriteSrc = secondSide === "right" ? END_SECOND_BEAR_SRC_RIGHT_MULTIPLAYER : END_SECOND_BEAR_SRC;
    startEndBearSpriteLoop(firstSide, firstSpriteSrc, END_FIRST_BEAR_LOOP_FRAMES);
    startEndBearSpriteLoop(secondSide, secondSpriteSrc, END_SECOND_BEAR_LOOP_FRAMES);
  }

  function applySinglePlayerRankBears(rankResult) {
    if (!rankResult) {
      return;
    }

    if (rankResult.tie) {
      const leftBear = getEndBearBySide("left");
      const rightBear = getEndBearBySide("right");
      if (!leftBear || !rightBear) {
        return;
      }

      setEndBearFlipForSide(leftBear, "left");
      setEndBearFlipForSide(rightBear, "right");
      return;
    }

    const winnerSide = rankResult.firstSide;
    const loserSide = rankResult.secondSide;
    const winnerBear = getEndBearBySide(winnerSide);
    const loserBear = getEndBearBySide(loserSide);
    if (!winnerBear || !loserBear) {
      return;
    }

    setEndBearFlipForSide(winnerBear, winnerSide);
    setEndBearFlipForSide(loserBear, loserSide);

    if (winnerSide === "right") {
      startEndBearSpriteLoop("right", END_SINGLE_WIN_BEAR_SRC_BAD, END_SINGLE_WIN_BAD_LOOP_FRAMES);
      startEndBearSpriteLoop("left", END_SINGLE_LOSE_BEAR_SRC_GOOD, END_SINGLE_LOSE_GOOD_LOOP_FRAMES);
      return;
    }

    startEndBearSpriteLoop("left", END_FIRST_BEAR_SRC, END_FIRST_BEAR_LOOP_FRAMES);
    startEndBearSpriteLoop("right", END_SINGLE_LOSE_BEAR_SRC_BAD, END_SINGLE_LOSE_BAD_LOOP_FRAMES);
  }

  function playEndMusicForResult() {
    if (state.isTwoPlayer) {
      playEndMusicLoop(END_MUSIC_2P, { fadeInMs: END_MUSIC_FADE_IN_MS });
      return;
    }

    if (state.leftScore >= state.rightScore) {
      playEndMusicLoop(END_MUSIC_HUMAN_WIN, { fadeInMs: END_MUSIC_FADE_IN_MS });
      return;
    }

    playEndMusicLoop(END_MUSIC_HUMAN_LOSE, { fadeInMs: END_MUSIC_FADE_IN_MS });
  }

  function getOtherSide(side) {
    return side === "left" ? "right" : "left";
  }

  function getPassRemainingMs(side) {
    return side === "right" ? state.passTimeRemainingMs.right : state.passTimeRemainingMs.left;
  }

  function setPassRemainingMs(side, value) {
    const nextValue = Math.max(0, Number(value) || 0);
    if (side === "right") {
      state.passTimeRemainingMs.right = nextValue;
      return;
    }

    state.passTimeRemainingMs.left = nextValue;
  }

  function setSideNumpadEnabled(side, enabled) {
    const keyCollection = side === "right" ? ui.rightKeys : ui.leftKeys;
    keyCollection.forEach((button) => {
      button.disabled = !enabled;
      button.setAttribute("aria-disabled", enabled ? "false" : "true");
    });
  }

  function syncPassTurnInputState() {
    if (!state.isPassAndPlay) {
      if (ui.leftQuestionBox) {
        ui.leftQuestionBox.hidden = false;
      }
      if (ui.rightQuestionBox) {
        ui.rightQuestionBox.hidden = false;
      }
      if (ui.leftPanelBox) {
        ui.leftPanelBox.hidden = false;
      }
      if (ui.rightPanelBox) {
        ui.rightPanelBox.hidden = false;
      }
      return;
    }

    const allowLeft = !state.passTurnOverlayVisible && state.activePassSide === "left";
    const allowRight = !state.passTurnOverlayVisible && state.activePassSide === "right";

    if (ui.leftQuestionBox) {
      ui.leftQuestionBox.hidden = !allowLeft;
    }
    if (ui.rightQuestionBox) {
      ui.rightQuestionBox.hidden = !allowRight;
    }

    if (ui.leftPanelBox) {
      ui.leftPanelBox.hidden = !allowLeft;
    }
    if (ui.rightPanelBox) {
      ui.rightPanelBox.hidden = !allowRight;
    }

    setSideNumpadEnabled("left", allowLeft);
    setSideNumpadEnabled("right", allowRight);
  }

  function showPassTurnOverlay() {
    if (!state.isPassAndPlay || !ui.passTurnOverlay) {
      return;
    }

    state.passTurnOverlayVisible = true;
    ui.passTurnOverlay.hidden = false;
    ui.passTurnOverlay.classList.remove("is-active");
    void ui.passTurnOverlay.offsetWidth;
    ui.passTurnOverlay.classList.add("is-active");
    syncPassTurnInputState();
    startPassTurnTransitionCountdown();
  }

  function clearPendingPassTurnOverlayDelay() {
    if (state.passTurnOverlayDelayTimerId != null) {
      window.clearTimeout(state.passTurnOverlayDelayTimerId);
      state.passTurnOverlayDelayTimerId = null;
    }
  }

  function getBearJumpRemainingMs(side) {
    const endsAtMs = side === "right" ? state.rightBearJumpEndsAtMs : state.leftBearJumpEndsAtMs;
    return Math.max(0, (Number(endsAtMs) || 0) - Date.now());
  }

  function showPassTurnOverlayAfterSideAnimation(side) {
    clearPendingPassTurnOverlayDelay();

    const waitMs = Math.max(getBearJumpRemainingMs(side), getBearConfusionRemainingMs(side));
    if (waitMs <= 0) {
      showPassTurnOverlay();
      return;
    }

    state.passTurnOverlayDelayTimerId = window.setTimeout(() => {
      state.passTurnOverlayDelayTimerId = null;
      if (!state.roundEnded) {
        showPassTurnOverlay();
      }
    }, waitMs);
  }

  function hidePassTurnOverlay() {
    if (!ui.passTurnOverlay) {
      return;
    }

    clearPassTurnTransitionCountdown();
  clearPendingPassTurnOverlayDelay();

    state.passTurnOverlayVisible = false;
    ui.passTurnOverlay.classList.remove("is-active");
    ui.passTurnOverlay.hidden = true;
    syncPassTurnInputState();
  }

  function renderPassTurnTransitionCountdown(secondsRemaining) {
    if (!ui.passTurnContinueButton) {
      return;
    }

    ui.passTurnContinueButton.textContent = String(secondsRemaining);
    ui.passTurnContinueButton.disabled = true;
    ui.passTurnContinueButton.setAttribute("aria-disabled", "true");
    ui.passTurnContinueButton.setAttribute("aria-label", `Turn starts in ${secondsRemaining}`);
    ui.passTurnContinueButton.style.fontSize = "75vh";
    ui.passTurnContinueButton.style.lineHeight = "0.85";
    ui.passTurnContinueButton.style.padding = "0";
    ui.passTurnContinueButton.style.background = "transparent";
    ui.passTurnContinueButton.style.border = "none";
    ui.passTurnContinueButton.style.boxShadow = "none";
    ui.passTurnContinueButton.style.cursor = "default";
    ui.passTurnContinueButton.style.pointerEvents = "none";
  }

  function clearPassTurnTransitionCountdown() {
    if (state.passTurnTransitionCountdownIntervalId != null) {
      window.clearInterval(state.passTurnTransitionCountdownIntervalId);
      state.passTurnTransitionCountdownIntervalId = null;
    }
  }

  function completePassTurnTransition() {
    if (!state.isPassAndPlay || state.roundEnded) {
      return;
    }

    if (!canContinuePassRound()) {
      finishRound();
      return;
    }

    hidePassTurnOverlay();
    applyPassTurnSwitch(state.passPendingNextSide);
  }

  function startPassTurnTransitionCountdown() {
    if (!state.isPassAndPlay || state.roundEnded || !state.passTurnOverlayVisible) {
      return;
    }

    clearPassTurnTransitionCountdown();

    let secondsRemaining = PASS_TURN_TRANSITION_COUNTDOWN_SECONDS;
    renderPassTurnTransitionCountdown(secondsRemaining);

    state.passTurnTransitionCountdownIntervalId = window.setInterval(() => {
      if (state.roundEnded || !state.passTurnOverlayVisible) {
        clearPassTurnTransitionCountdown();
        return;
      }

      secondsRemaining -= 1;
      if (secondsRemaining <= 0) {
        clearPassTurnTransitionCountdown();
        completePassTurnTransition();
        return;
      }

      renderPassTurnTransitionCountdown(secondsRemaining);
    }, 1000);
  }

  function canContinuePassRound() {
    return getPassRemainingMs("left") > 0 || getPassRemainingMs("right") > 0;
  }

  function applyPassTurnSwitch(nextSide) {
    state.activePassSide = nextSide;
    state.passTurnTickLastMs = Date.now();
    renderTimer(Math.ceil(getPassRemainingMs(state.activePassSide) / 1000));
    syncPassTurnInputState();
  }

  function playPassTimerCueOnce(side, secondsRemaining) {
    const cueSet = side === "right" ? state.passTimerCuePlayedSeconds.right : state.passTimerCuePlayedSeconds.left;
    if (cueSet.has(secondsRemaining)) {
      return;
    }

    if (secondsRemaining === 30) {
      playSound(TIMER_CUE_30S);
    } else if (secondsRemaining === 10) {
      playSound(TIMER_CUE_10S);
    } else if (secondsRemaining >= 1 && secondsRemaining <= 5) {
      playSound(TIMER_CUE_5S);
    } else if (secondsRemaining === 0) {
      playSound(TIMER_CUE_0S);
    } else {
      return;
    }

    cueSet.add(secondsRemaining);
  }

  function playTimerUrgencyAnimation(secondsRemaining) {
    if (!ui.timerValue) {
      return;
    }

    const isUrgent = secondsRemaining === 30 || secondsRemaining === 10 || (secondsRemaining >= 1 && secondsRemaining <= 5);
    if (!isUrgent) {
      return;
    }

    if (state.timerAlertTimeoutId != null) {
      window.clearTimeout(state.timerAlertTimeoutId);
    }

    ui.timerValue.classList.remove("is-urgent");
    void ui.timerValue.offsetWidth;
    ui.timerValue.classList.add("is-urgent");
    state.timerAlertTimeoutId = window.setTimeout(() => {
      ui.timerValue.classList.remove("is-urgent");
      state.timerAlertTimeoutId = null;
    }, 1000);
  }

  function playPassTimerUrgencyOnce(side, secondsRemaining) {
    const alertSet = side === "right" ? state.passTimerAlertPlayedSeconds.right : state.passTimerAlertPlayedSeconds.left;
    if (alertSet.has(secondsRemaining)) {
      return;
    }

    playTimerUrgencyAnimation(secondsRemaining);
    alertSet.add(secondsRemaining);
  }

  function advancePassTurnAfterAttempt(side) {
    if (!state.isPassAndPlay || state.roundEnded) {
      return;
    }

    const preferredNextSide = getOtherSide(side);
    const preferredHasTime = getPassRemainingMs(preferredNextSide) > 0;
    const currentHasTime = getPassRemainingMs(side) > 0;

    if (!preferredHasTime && currentHasTime) {
      return;
    }

    if (!preferredHasTime && !currentHasTime) {
      finishRound();
      return;
    }

    state.passPendingNextSide = preferredHasTime ? preferredNextSide : side;
    showPassTurnOverlayAfterSideAnimation(side);
  }

  function onPassTurnContinue(event) {
    event.preventDefault();
    event.stopPropagation();

    completePassTurnTransition();
  }

  function onEndActionRestart(event) {
    event.preventDefault();
    event.stopPropagation();

    hideEndOverlay();
    runStartupCountdown();
  }

  function onEndActionHome(event) {
    event.preventDefault();
    event.stopPropagation();

    window.location.href = "./menu_2.html";
  }

  window.clearHistoricalData = clearHistoricalData;

  function randomInt(min, maxInclusive) {
    return Math.floor(Math.random() * (maxInclusive - min + 1)) + min;
  }

  function getFireContext(side) {
    return side === "right" ? fireFx.right : fireFx.left;
  }

  function getBearElement(side) {
    return side === "right" ? ui.rightBear : ui.leftBear;
  }

  function getBearColumnElement(side) {
    return side === "right" ? ui.rightBearColumn : ui.leftBearColumn;
  }

  function initFireOverlayForSide(side) {
    const fx = getFireContext(side);
    const bearEl = getBearElement(side);
    const bearColumnEl = getBearColumnElement(side);
    if (!fx || !bearEl || !bearColumnEl || fx.element) {
      return;
    }

    if (!bearColumnEl.style.position) {
      bearColumnEl.style.position = "relative";
    }

    bearEl.style.position = "relative";
    bearEl.style.zIndex = "2";

    const fireEl = document.createElement("div");
    fireEl.className = `ui-fire-overlay ui-fire-overlay-${side}`;
    fireEl.setAttribute("aria-hidden", "true");
    fireEl.style.position = "absolute";
    fireEl.style.left = "0";
    fireEl.style.bottom = "0";
    fireEl.style.zIndex = "1";
    fireEl.style.pointerEvents = "none";
    fireEl.style.opacity = "0.92";
    fireEl.style.transform = "translate(-50%, 0) scale(0)";
    fireEl.style.transformOrigin = "center bottom";
    fireEl.style.willChange = "left, bottom, transform";
    fireEl.style.display = "none";

    bearColumnEl.appendChild(fireEl);

    fx.element = fireEl;
    fx.animator = new SpriteAnimator({
      element: fireEl,
      frameWidth: FIRE_FRAME_WIDTH,
      frameHeight: FIRE_FRAME_HEIGHT,
      columns: FIRE_FRAME_COLUMNS,
      imageUrl: fx.imageUrl,
      loop: true,
    });
  }

  function initFireOverlays() {
    initFireOverlayForSide("left");
    initFireOverlayForSide("right");
  }

  function positionFireOverlayOnBear(side) {
    const fx = getFireContext(side);
    const bearEl = getBearElement(side);
    const bearColumnEl = getBearColumnElement(side);
    if (!fx || !fx.element || !bearEl || !bearColumnEl) {
      return;
    }

    const bearRect = bearEl.getBoundingClientRect();
    const columnRect = bearColumnEl.getBoundingClientRect();
    if (!bearRect.width || !bearRect.height || !columnRect.width || !columnRect.height) {
      return;
    }

    const centerX = bearRect.left + bearRect.width / 2 - columnRect.left;
    const bottomOffset = columnRect.bottom - bearRect.bottom;
    const baseScale = Math.max(0.01, Math.min(bearRect.width / FIRE_FRAME_WIDTH, bearRect.height / FIRE_FRAME_HEIGHT));
    const scale = baseScale * FIRE_SCALE_MULTIPLIER;

    fx.element.style.left = `${centerX}px`;
    fx.element.style.bottom = `${Math.max(0, bottomOffset)}px`;
    fx.element.style.transform = `translate(-50%, 0) scale(${scale})`;
  }

  function fireTrackingTick(side) {
    const fx = getFireContext(side);
    if (!fx || !fx.isRunning) {
      return;
    }

    positionFireOverlayOnBear(side);
    fx.trackingRafId = window.requestAnimationFrame(() => {
      fireTrackingTick(side);
    });
  }

  function startFireEffect(side) {
    const fx = getFireContext(side);
    if (!fx || !fx.element || !fx.animator || fx.isRunning) {
      return;
    }

    fx.isRunning = true;
    fx.element.style.display = "block";
    positionFireOverlayOnBear(side);

    fx.animator.play(fx.frameSequence, FIRE_FRAME_DURATION_MS, { loop: true, autoShow: true });
    fx.trackingRafId = window.requestAnimationFrame(() => {
      fireTrackingTick(side);
    });
  }

  function stopFireEffect(side) {
    const fx = getFireContext(side);
    if (!fx) {
      return;
    }

    fx.isRunning = false;

    if (fx.trackingRafId != null) {
      window.cancelAnimationFrame(fx.trackingRafId);
      fx.trackingRafId = null;
    }

    if (fx.animator) {
      fx.animator.stop();
    }

    if (fx.element) {
      fx.element.style.display = "none";
    }
  }

  function stopAllFireEffects() {
    stopFireEffect("left");
    stopFireEffect("right");
  }

  function syncFireEffectWithScore() {
    if (state.leftScore >= DEFAULT_STEPS) {
      startFireEffect("left");
    } else {
      stopFireEffect("left");
    }

    if (state.rightScore >= DEFAULT_STEPS) {
      startFireEffect("right");
    } else {
      stopFireEffect("right");
    }
  }

  function renderQuestions(animate = false) {
    renderQuestionCard("left", animate);
    renderQuestionCard("right", animate);
    scheduleQuestionTypographyFit();
  }

  function renderAnswers() {
    ui.leftAnswer.textContent = state.leftInput || "?";
    ui.rightAnswer.textContent = state.isTwoPlayer ? (state.rightInput || "?") : "?";
  }

  function renderQuestionCard(side, animate) {
    const questionEl = side === "left" ? ui.leftQuestion : ui.rightQuestion;
    const questionBox = side === "left" ? ui.leftQuestionBox : ui.rightQuestionBox;
    const question = side === "left" ? state.leftQuestion : state.rightQuestion;
    const nextText = formatQuestion(question);

    if (!questionEl || !questionBox) {
      return;
    }

    if (!animate || !questionBox.dataset.ready) {
      questionBox.classList.remove("is-orb-launch-source");
      questionEl.textContent = nextText;
      questionBox.dataset.ready = "true";
      scheduleQuestionTypographyFit();
      return;
    }

    if (questionEl.textContent === nextText) {
      const animatingKey = side === "left" ? "leftQuestionAnimating" : "rightQuestionAnimating";
      questionBox.classList.remove("is-orb-launch-source");
      state[animatingKey] = false;
      return;
    }

    const enterClass = side === "left" ? "is-sliding-in-left" : "is-sliding-in-right";
    const enterOffset = side === "left" ? "-120vw" : "120vw";
    const animatingKey = side === "left" ? "leftQuestionAnimating" : "rightQuestionAnimating";

    questionBox.classList.remove(
      "is-sliding-out-left",
      "is-sliding-out-right",
      "is-sliding-in-left",
      "is-sliding-in-right",
      "is-orb-launch-source"
    );
    void questionBox.offsetWidth;

    state[animatingKey] = true;
    questionEl.textContent = nextText;
    questionBox.style.transition = "none";
    questionBox.style.transform = `translateX(${enterOffset})`;
    questionBox.style.opacity = "0";
    void questionBox.offsetWidth;
    questionBox.style.transition = "";
    questionBox.classList.add(enterClass);
    questionBox.style.transform = "translateX(0)";
    questionBox.style.opacity = "1";

    window.setTimeout(() => {
      questionBox.classList.remove(enterClass);
      questionBox.style.transition = "";
      questionBox.style.transform = "";
      questionBox.style.opacity = "";
      state[animatingKey] = false;
      scheduleQuestionTypographyFit();
    }, QUESTION_SLIDE_DURATION_MS);
  }

  function animateQuestionOrbToFlag(side) {
    const questionBox = side === "left" ? ui.leftQuestionBox : ui.rightQuestionBox;
    const flag = side === "left" ? ui.goodFlag : ui.badFlag;
    if (!questionBox || !flag) {
      return Promise.resolve();
    }

    const sourceRect = questionBox.getBoundingClientRect();
    const targetRect = flag.getBoundingClientRect();
    if (!sourceRect.width || !sourceRect.height || !targetRect.width || !targetRect.height) {
      return Promise.resolve();
    }

    const orb = document.createElement("div");
    orb.className = `ui-question-orb ui-question-orb-${side}`;
    orb.style.left = `${sourceRect.left + sourceRect.width / 2}px`;
    orb.style.top = `${sourceRect.top + sourceRect.height / 2}px`;
    orb.style.width = `${sourceRect.width}px`;
    orb.style.height = `${sourceRect.height}px`;

    questionBox.classList.add("is-orb-launch-source");
    document.body.appendChild(orb);
    void orb.offsetWidth;

    orb.classList.add("is-flying");
    orb.style.left = `${targetRect.left + targetRect.width / 2}px`;
    orb.style.top = `${targetRect.top + targetRect.height / 2}px`;

    return new Promise((resolve) => {
      window.setTimeout(() => {
        orb.remove();
        resolve();
      }, QUESTION_ORB_FLIGHT_MS);
    });
  }

  let questionTypographyFrameId = null;
  let questionTypographyObserver = null;

  const ANSWER_RESERVE_SAMPLE = "88";
  const QUESTION_TO_ANSWER_GAP_SAFETY_PX = 2;
  const TYPOGRAPHY_VERTICAL_SAFETY_BUFFER_PX = 2;

  function parsePixelValue(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function getReservedAnswerWidthPx(answerEl, fontSizePx) {
    const answerStyles = window.getComputedStyle(answerEl);
    const paddingX = parsePixelValue(answerStyles.paddingLeft) + parsePixelValue(answerStyles.paddingRight);
    const borderX = parsePixelValue(answerStyles.borderLeftWidth) + parsePixelValue(answerStyles.borderRightWidth);

    const previousWidth = answerEl.style.width;
    const previousMinWidth = answerEl.style.minWidth;
    const previousMaxWidth = answerEl.style.maxWidth;
    const previousFontSize = answerEl.style.fontSize;
    const previousText = answerEl.textContent;

    // Measure intrinsic text width without the currently assigned fixed width.
    answerEl.style.width = "max-content";
    answerEl.style.minWidth = "0";
    answerEl.style.maxWidth = "none";
    answerEl.style.fontSize = `${fontSizePx}px`;
    answerEl.textContent = ANSWER_RESERVE_SAMPLE;

    const contentWidth = Math.ceil(answerEl.scrollWidth);
    const measuredWidth = Math.ceil(contentWidth + paddingX + borderX);

    answerEl.style.width = previousWidth;
    answerEl.style.minWidth = previousMinWidth;
    answerEl.style.maxWidth = previousMaxWidth;
    answerEl.style.fontSize = previousFontSize;
    answerEl.textContent = previousText;

    return measuredWidth;
  }

  function fitQuestionTypographyForBox(questionBox) {
    if (!questionBox) {
      return;
    }

    const prompt = questionBox.querySelector(".ui-question-prompt");
    const questionEl = questionBox.querySelector(".ui-question-value");
    const answerEl = questionBox.querySelector(".ui-answer-box");
    if (!prompt || !questionEl || !answerEl) {
      return;
    }

    const availableWidth = prompt.clientWidth || questionBox.clientWidth;
    const availableHeight = prompt.clientHeight || questionBox.clientHeight;
    if (!availableWidth || !availableHeight) {
      return;
    }

    const promptStyles = window.getComputedStyle(prompt);
    const gap = parsePixelValue(promptStyles.columnGap || promptStyles.gap);

    const minFontSize = 8;
    const maxFromHeight = Math.max(minFontSize, Math.floor(availableHeight));
    let low = minFontSize;
    let high = maxFromHeight;
    let best = minFontSize;
    let bestReservedWidth = 0;

    const evaluateCandidate = (fontSizePx) => {
      prompt.style.fontSize = `${fontSizePx}px`;

      const reservedWidth = getReservedAnswerWidthPx(answerEl, fontSizePx);
      prompt.style.setProperty("--answer-reserved-inline-size", `${reservedWidth}px`);

      const questionRect = questionEl.getBoundingClientRect();
      const answerRect = answerEl.getBoundingClientRect();
      const questionClientWidth = questionEl.clientWidth;
      const questionScrollWidth = questionEl.scrollWidth;
      const questionClientHeight = questionEl.clientHeight;
      const questionScrollHeight = questionEl.scrollHeight;
      const questionTextFitsWidth = questionClientWidth > 0 && questionScrollWidth <= questionClientWidth;
      const noOverlapWithAnswer =
        questionRect.right + QUESTION_TO_ANSWER_GAP_SAFETY_PX <= answerRect.left;

      const answerTextFits = answerEl.scrollHeight <= answerEl.clientHeight + TYPOGRAPHY_VERTICAL_SAFETY_BUFFER_PX;
      const questionFitsVertically =
        questionClientHeight > 0 &&
        questionScrollHeight <= questionClientHeight + TYPOGRAPHY_VERTICAL_SAFETY_BUFFER_PX &&
        questionRect.height <= availableHeight + TYPOGRAPHY_VERTICAL_SAFETY_BUFFER_PX;

      return {
        fits: questionTextFitsWidth && noOverlapWithAnswer && questionFitsVertically && answerTextFits,
        reservedWidth,
      };
    };

    const minCandidate = evaluateCandidate(minFontSize);
    bestReservedWidth = minCandidate.reservedWidth;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = evaluateCandidate(mid);

      if (candidate.fits) {
        best = mid;
        bestReservedWidth = candidate.reservedWidth;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    prompt.style.setProperty("--answer-reserved-inline-size", `${bestReservedWidth}px`);
    prompt.style.fontSize = `${best}px`;
  }

  function fitQuestionTypography() {
    fitQuestionTypographyForBox(ui.leftQuestionBox);
    fitQuestionTypographyForBox(ui.rightQuestionBox);
  }

  function scheduleQuestionTypographyFit() {
    if (questionTypographyFrameId != null) {
      window.cancelAnimationFrame(questionTypographyFrameId);
    }

    questionTypographyFrameId = window.requestAnimationFrame(() => {
      questionTypographyFrameId = null;
      fitQuestionTypography();
    });
  }

  function syncSideQuestion(side) {
    const indexKey = side === "left" ? "leftQuestionIndex" : "rightQuestionIndex";
    const questionKey = side === "left" ? "leftQuestion" : "rightQuestion";

    if (state.isTwoPlayer) {
      state[questionKey] = getTwoPlayerQuestionAt(side, state[indexKey]);
      return;
    }

    state[questionKey] = getQuestionAt(state[indexKey]);
  }

  function renderScoreBoxes() {
    if (ui.leftScoreBox) {
      ui.leftScoreBox.textContent = String(state.leftScore);
    }
    if (ui.rightScoreBox) {
      ui.rightScoreBox.textContent = String(state.rightScore);
    }

    syncFireEffectWithScore();
  }

  function renderTimer(secondsRemaining) {
    if (!ui.timerValue) {
      return;
    }

    const isUrgent = secondsRemaining === 30 || secondsRemaining === 10 || (secondsRemaining >= 1 && secondsRemaining <= 5);
    if (isUrgent && state.timerAlertSecond !== secondsRemaining) {
      state.timerAlertSecond = secondsRemaining;
      playTimerUrgencyAnimation(secondsRemaining);
    }

    ui.timerValue.textContent = String(Math.max(0, secondsRemaining));
  }

  function normalizeScoreArray(values) {
    if (!Array.isArray(values)) {
      return [];
    }

    return values.filter((value) => Number.isFinite(value) && value > 0).map((value) => Number(value));
  }

  function loadScoreHistory() {
    try {
      const raw = window.localStorage.getItem(SCORE_HISTORY_KEY);
      if (!raw) return [];
      return normalizeScoreArray(JSON.parse(raw));
    } catch {
      return [];
    }
  }

  function loadRecentThreeArray() {
    try {
      const raw = window.localStorage.getItem(RECENT_THREE_KEY);
      if (!raw) {
        return DEFAULT_RECENT_THREE.slice();
      }

      const parsed = normalizeScoreArray(JSON.parse(raw));
      return parsed.length >= 3 ? parsed.slice(-3) : DEFAULT_RECENT_THREE.slice();
    } catch {
      return DEFAULT_RECENT_THREE.slice();
    }
  }

  function saveHistoryData() {
    try {
      window.localStorage.setItem(SCORE_HISTORY_KEY, JSON.stringify(state.left.scoreHistory));
      window.localStorage.setItem(RECENT_THREE_KEY, JSON.stringify(state.left.recentThreeArray));
    } catch {
      // Ignore storage write failures.
    }
  }

  function getLastThreeAverage() {
    const recent = state.left.recentThreeArray;
    const sum = recent.reduce((total, value) => total + value, 0);
    return sum / recent.length;
  }

  function getLatestThreeScores() {
    return state.left.recentThreeArray.slice(-3);
  }

  function getStoredRoundScore(score) {
    return score < 3 ? randomInt(3, 5) : score;
  }

  function recordRoundScore(score) {
    state.left.scoreHistory.push(score);
    state.left.recentThreeArray.push(getStoredRoundScore(score));
    state.left.recentThreeArray = state.left.recentThreeArray.slice(-3);
    saveHistoryData();
  }

  function logRoundMetrics(label) {
    const latestThreeScores = getLatestThreeScores();
    const latestThreeAvg = latestThreeScores.length
      ? latestThreeScores.reduce((total, value) => total + value, 0) / latestThreeScores.length
      : 0;

    console.log(`${label} K=${state.kFirst30} A=${state.aLastThree} S=${state.requiredSteps}`);
    console.log(`${label} localStorage`, {
      latestThreeScores,
      exactQuestionsAnswered: state.left.scoreHistory.slice(-3),
      avg: latestThreeAvg,
      fullHistory: state.left.scoreHistory.slice(),
    });
  }

  function clearHistoricalData() {
    state.left.scoreHistory = [];
    state.left.recentThreeArray = DEFAULT_RECENT_THREE.slice();
    saveHistoryData();
  }

  function getProgressRatio(score) {
    const numericScore = Math.max(0, Number(score) || 0);

    if (!state.dynamicAdjusted) {
      if (numericScore < DEFAULT_STEPS) {
        return Math.min(1, numericScore / DEFAULT_STEPS);
      }

      const overflowTarget = Math.max(DEFAULT_STEPS + 2, numericScore + 2);
      return Math.min(1, numericScore / overflowTarget);
    }

    const k = state.kFirst30;
    const s = state.requiredSteps;
    const frozen = state.frozenProgressAt30;
    if (numericScore <= k) {
      return Math.min(1, numericScore / DEFAULT_STEPS);
    }

    const remainingSteps = s - k;
    if (remainingSteps <= 0) {
      return 1;
    }

    const afterThirty = numericScore - k;
    const filled = frozen + (afterThirty / remainingSteps) * (1 - frozen);
    return Math.min(1, filled);
  }

  function updatePlayerProgress(trackEl, fillEl, flagEl, ratio) {
    if (!trackEl || !fillEl || !flagEl) {
      return;
    }

    const trackRect = trackEl.getBoundingClientRect();
    const flagRect = flagEl.getBoundingClientRect();
    if (!trackRect.width || !flagRect.width) {
      return;
    }

    const boundedRatio = Math.max(0, Math.min(1, ratio));
    const travel = Math.max(0, trackRect.width - flagRect.width - 2);
    const isRightTrack = trackEl.id === "right-progress-track";

    if (isRightTrack) {
      flagEl.style.left = "auto";
      flagEl.style.right = `${boundedRatio * travel}px`;
    } else {
      flagEl.style.right = "auto";
      flagEl.style.left = `${boundedRatio * travel}px`;
    }

    fillEl.style.width = `${boundedRatio * 100}%`;
  }

  function playSound(fileName) {
    const audio = new Audio(fileName);
    audio.play().catch(() => {
      // Ignore autoplay restrictions until the user interacts.
    });
  }

  function spawnProgressParticles(particleLayer, color, count = 16) {
    if (!particleLayer) {
      return;
    }

    for (let index = 0; index < count; index += 1) {
      const particle = document.createElement("span");
      particle.className = "ui-progress-particle";

      const angle = (Math.PI * 2 * index) / count + (Math.random() - 0.5) * 0.4;
      const distance = 18 + Math.random() * 70;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance * 0.7;
      const scale = 0.55 + Math.random() * 0.9;
      const duration = 0.7 + Math.random() * 0.25;

      particle.style.color = color;
      particle.style.background = color;
      particle.style.setProperty("--dx", `${dx}px`);
      particle.style.setProperty("--dy", `${dy}px`);
      particle.style.setProperty("--scale", `${scale}`);
      particle.style.setProperty("--duration", `${duration}s`);
      particle.style.animationDelay = `${Math.random() * 0.08}s`;

      particle.addEventListener("animationend", () => particle.remove());
      particleLayer.appendChild(particle);
    }
  }

  function startParticleBurstLoop(particleLayer, color, timerIdKey) {
    if (!particleLayer) {
      return;
    }

    if (state[timerIdKey] != null) {
      window.clearInterval(state[timerIdKey]);
    }

    spawnProgressParticles(particleLayer, color);
    state[timerIdKey] = window.setInterval(() => {
      spawnProgressParticles(particleLayer, color, 8);
    }, 280);
  }

  function stopParticleBurstLoop(timerIdKey) {
    if (state[timerIdKey] != null) {
      window.clearInterval(state[timerIdKey]);
      state[timerIdKey] = null;
    }
  }

  function updateProgressUi() {
    if (!ui.goodFlag || !ui.badFlag) {
      return;
    }

    const previousLeftFull = state.leftBarWasFull;
    const previousRightFull = state.rightBarWasFull;
    const previousLeftThreshold = state.leftFullThreshold;
    const previousRightThreshold = state.rightFullThreshold;
    const threshold = Math.max(DEFAULT_STEPS, getCurrentWinThreshold());
    const leftFull = state.leftScore >= threshold;
    const rightFull = state.rightScore >= threshold;

    const leftRatio = leftFull ? 1 : getProgressRatio(state.leftScore);
    const rightRatio = rightFull ? 1 : getProgressRatio(state.rightScore);

    updatePlayerProgress(ui.leftTrack, ui.leftFill, ui.goodFlag, leftRatio);
    updatePlayerProgress(ui.rightTrack, ui.rightFill, ui.badFlag, rightRatio);

    if (leftFull && (!previousLeftFull || previousLeftThreshold !== threshold)) {
      startParticleBurstLoop(ui.leftParticles, "#ff3b30", "leftParticleTimerId");
    } else if (!leftFull) {
      stopParticleBurstLoop("leftParticleTimerId");
    }

    if (rightFull && (!previousRightFull || previousRightThreshold !== threshold)) {
      startParticleBurstLoop(ui.rightParticles, "#111111", "rightParticleTimerId");
    } else if (!rightFull) {
      stopParticleBurstLoop("rightParticleTimerId");
    }

    state.leftBarWasFull = leftFull;
    state.rightBarWasFull = rightFull;
    state.leftFullThreshold = leftFull ? threshold : null;
    state.rightFullThreshold = rightFull ? threshold : null;

    ui.goodFlag.style.transform = "translateY(-50%) scale(1)";
    ui.badFlag.style.transform = "translateY(-50%) scale(1)";
  }

  function bumpFlag(side) {
    const flag = side === "left" ? ui.goodFlag : ui.badFlag;
    if (!flag) {
      return;
    }

    flag.style.transform = "translateY(-50%) scale(1.14)";
    window.setTimeout(() => {
      flag.style.transform = "translateY(-50%) scale(1)";
    }, 220);
  }

  function triggerBearJump(side, score) {
    const isLeft = side === "left";
    const bearEl = isLeft ? ui.leftBear : ui.rightBear;
    if (!bearEl) {
      return;
    }

    const jumpDistance = score > 10 ? "30vh" : "20vh";
    const jumpSrc = isLeft ? LEFT_BEAR_JUMP_SRC : getRightBearJumpSrc();
    const standSrc = isLeft ? LEFT_BEAR_STAND_SRC : getRightBearStandSrc();
    const timerKey = isLeft ? "leftBearJumpTimerId" : "rightBearJumpTimerId";

    if (state[timerKey] != null) {
      window.clearTimeout(state[timerKey]);
      state[timerKey] = null;
    }

    bearEl.style.setProperty("--bear-jump-distance", jumpDistance);
    bearEl.src = jumpSrc;
    bearEl.classList.remove("is-jumping", "is-confused");
    // Force a reflow so quick consecutive correct answers restart the animation.
    void bearEl.offsetWidth;
    bearEl.classList.add("is-jumping");
    state[timerKey === "leftBearJumpTimerId" ? "leftBearJumpEndsAtMs" : "rightBearJumpEndsAtMs"] = Date.now() + BEAR_JUMP_ANIMATION_MS;

    state[timerKey] = window.setTimeout(() => {
      bearEl.classList.remove("is-jumping");
      bearEl.src = standSrc;
      state[timerKey] = null;
      state[timerKey === "leftBearJumpTimerId" ? "leftBearJumpEndsAtMs" : "rightBearJumpEndsAtMs"] = 0;
    }, BEAR_JUMP_ANIMATION_MS);
  }

  function getBearConfusedSrc(side) {
    return side === "right" ? "./good_bear_2_confused.png" : "./good_bear_1_confused.png";
  }

  function triggerBearConfusedAnimation(side) {
    const bearEl = side === "right" ? ui.rightBear : ui.leftBear;
    if (!bearEl) {
      return;
    }

    const isLeft = side === "left";
    const timerKey = isLeft ? "leftBearConfusedTimerId" : "rightBearConfusedTimerId";
    const endsAtKey = isLeft ? "leftBearConfusedEndsAtMs" : "rightBearConfusedEndsAtMs";
    const standSrc = isLeft ? LEFT_BEAR_STAND_SRC : getRightBearStandSrc();

    if (state[timerKey] != null) {
      window.clearTimeout(state[timerKey]);
      state[timerKey] = null;
    }

    bearEl.classList.remove("is-jumping", "is-confused");
    void bearEl.offsetWidth;
    bearEl.classList.add("is-confused");
    bearEl.src = getBearConfusedSrc(side);
    state[endsAtKey] = Date.now() + BEAR_CONFUSED_ANIMATION_MS;

    state[timerKey] = window.setTimeout(() => {
      bearEl.classList.remove("is-confused");
      bearEl.src = standSrc;
      state[timerKey] = null;
      state[endsAtKey] = 0;
    }, BEAR_CONFUSED_ANIMATION_MS);
  }

  function getBearConfusionRemainingMs(side) {
    const endsAtMs = side === "right" ? state.rightBearConfusedEndsAtMs : state.leftBearConfusedEndsAtMs;
    return Math.max(0, (Number(endsAtMs) || 0) - Date.now());
  }

  function clearTimers() {
    state.timers.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    state.timers = [];

    if (state.timerIntervalId != null) {
      window.clearInterval(state.timerIntervalId);
      state.timerIntervalId = null;
    }

    if (state.timerAlertTimeoutId != null) {
      window.clearTimeout(state.timerAlertTimeoutId);
      state.timerAlertTimeoutId = null;
    }

    if (state.endOverlayRevealTimerId != null) {
      window.clearTimeout(state.endOverlayRevealTimerId);
      state.endOverlayRevealTimerId = null;
    }

    if (state.endOverlayRanksTimerId != null) {
      window.clearTimeout(state.endOverlayRanksTimerId);
      state.endOverlayRanksTimerId = null;
    }

    if (state.endOverlayMusicTimerId != null) {
      window.clearTimeout(state.endOverlayMusicTimerId);
      state.endOverlayMusicTimerId = null;
    }

    state.timerAlertSecond = null;

    if (ui.timerValue) {
      ui.timerValue.classList.remove("is-urgent");
    }

    stopParticleBurstLoop("leftParticleTimerId");
    stopParticleBurstLoop("rightParticleTimerId");

    if (state.leftBearJumpTimerId != null) {
      window.clearTimeout(state.leftBearJumpTimerId);
      state.leftBearJumpTimerId = null;
    }
    if (state.rightBearJumpTimerId != null) {
      window.clearTimeout(state.rightBearJumpTimerId);
      state.rightBearJumpTimerId = null;
    }
    if (state.leftBearConfusedTimerId != null) {
      window.clearTimeout(state.leftBearConfusedTimerId);
      state.leftBearConfusedTimerId = null;
    }
    if (state.rightBearConfusedTimerId != null) {
      window.clearTimeout(state.rightBearConfusedTimerId);
      state.rightBearConfusedTimerId = null;
    }
    state.leftBearJumpEndsAtMs = 0;
    state.rightBearJumpEndsAtMs = 0;
    state.leftBearConfusedEndsAtMs = 0;
    state.rightBearConfusedEndsAtMs = 0;
    clearPendingPassTurnOverlayDelay();

    clearAllEndBearLoops();
    clearAllEndScoreCountAnimations();

    if (ui.leftBear) {
      ui.leftBear.classList.remove("is-jumping");
      ui.leftBear.src = LEFT_BEAR_STAND_SRC;
    }
    if (ui.rightBear) {
      ui.rightBear.classList.remove("is-jumping");
      ui.rightBear.src = getRightBearStandSrc();
    }

    stopAllFireEffects();
    stopAllWinnerConfetti();

    state.timerCuePlayedSeconds.clear();
  }

  function setAllKeypadsEnabled(enabled) {
    ui.keys.forEach((button) => {
      button.disabled = !enabled;
      button.setAttribute("aria-disabled", enabled ? "false" : "true");
    });

    if (!enabled) {
      return;
    }

    // Respect game mode while re-enabling after round transitions.
    if (state.isPassAndPlay) {
      syncPassTurnInputState();
      return;
    }

    setRightNumpadEnabled(state.isTwoPlayer);
  }

  function showEndOverlay() {
    if (!ui.endOverlay) {
      return;
    }

    clearAllEndBearLoops();
    clearAllEndScoreCountAnimations();
    ensureEndConfettiLayers();
    const rankResult = updateEndRanks();
    const isMultiplayerResult = state.isTwoPlayer;

    if (isMultiplayerResult) {
      applyMultiplayerEndFaceBears();
    } else {
      applySinglePlayerEndFaceBears();
    }

    fadeOutInGameMusic(IN_GAME_MUSIC_FADE_OUT_MS);

    ui.endOverlay.hidden = false;
    ui.endOverlay.classList.toggle("is-multiplayer-result", isMultiplayerResult);
    ui.endOverlay.classList.remove("is-active", "is-bears-visible", "is-ranks-visible");
    void ui.endOverlay.offsetWidth;
    ui.endOverlay.classList.add("is-active");

    setEndScoreText("left", 0);
    setEndScoreText("right", 0);

    state.passTurnTickLastMs = 0;
    state.passTimerCuePlayedSeconds.left.clear();
    state.passTimerCuePlayedSeconds.right.clear();
    hidePassTurnOverlay();

    if (state.endOverlayRevealTimerId != null) {
      window.clearTimeout(state.endOverlayRevealTimerId);
    }

    if (state.endOverlayRanksTimerId != null) {
      window.clearTimeout(state.endOverlayRanksTimerId);
      state.endOverlayRanksTimerId = null;
    }

    if (state.endOverlayMusicTimerId != null) {
      window.clearTimeout(state.endOverlayMusicTimerId);
      state.endOverlayMusicTimerId = null;
    }

    state.endOverlayRevealTimerId = window.setTimeout(() => {
      ui.endOverlay.classList.add("is-bears-visible");
      state.endOverlayRevealTimerId = null;
    }, END_OVERLAY_FADE_MS);

    state.endOverlayRanksTimerId = window.setTimeout(() => {
      if (isMultiplayerResult) {
        applyMultiplayerRankBears(rankResult);
      } else {
        applySinglePlayerRankBears(rankResult);
      }
      ui.endOverlay.classList.add("is-ranks-visible");
      startEndScoreCountUp(rankResult);
      startWinnerConfettiForResult(rankResult);

      if (!isMultiplayerResult) {
        playEndMusicForResult();
      }

      state.endOverlayRanksTimerId = null;
    }, END_RANK_REVEAL_MS);

    if (isMultiplayerResult) {
      state.endOverlayMusicTimerId = window.setTimeout(() => {
        playEndMusicForResult();
        state.endOverlayMusicTimerId = null;
      }, END_MUSIC_START_MS);
    }
  }

  function hideEndOverlay() {
    if (!ui.endOverlay) {
      return;
    }

    stopEndMusic();
    clearAllEndBearLoops();
    stopAllWinnerConfetti();

    if (state.endOverlayRevealTimerId != null) {
      window.clearTimeout(state.endOverlayRevealTimerId);
      state.endOverlayRevealTimerId = null;
    }

    if (state.endOverlayRanksTimerId != null) {
      window.clearTimeout(state.endOverlayRanksTimerId);
      state.endOverlayRanksTimerId = null;
    }

    if (state.endOverlayMusicTimerId != null) {
      window.clearTimeout(state.endOverlayMusicTimerId);
      state.endOverlayMusicTimerId = null;
    }

    clearAllEndScoreCountAnimations();

    ui.endOverlay.classList.remove("is-active", "is-bears-visible", "is-ranks-visible", "is-multiplayer-result");
    ui.endOverlay.hidden = true;
  }

  function playTimerCueOnce(secondsRemaining) {
    if (state.timerCuePlayedSeconds.has(secondsRemaining)) {
      return;
    }

    if (secondsRemaining === 30) {
      playSound(TIMER_CUE_30S);
    } else if (secondsRemaining === 10) {
      playSound(TIMER_CUE_10S);
    } else if (secondsRemaining >= 1 && secondsRemaining <= 5) {
      playSound(TIMER_CUE_5S);
    } else if (secondsRemaining === 0) {
      playSound(TIMER_CUE_0S);
    } else {
      return;
    }

    state.timerCuePlayedSeconds.add(secondsRemaining);
  }

  function startRoundTimer() {
    state.timerCuePlayedSeconds.clear();
    state.passTimerAlertPlayedSeconds.left.clear();
    state.passTimerAlertPlayedSeconds.right.clear();

    if (state.isPassAndPlay) {
      renderTimer(Math.ceil(getPassRemainingMs(state.activePassSide) / 1000));
      state.passTurnTickLastMs = Date.now();

      if (state.timerIntervalId != null) {
        window.clearInterval(state.timerIntervalId);
      }

      state.timerIntervalId = window.setInterval(() => {
        if (state.roundEnded) {
          return;
        }

        if (state.passTurnOverlayVisible) {
          state.passTurnTickLastMs = Date.now();
          return;
        }

        const activeSide = state.activePassSide;
        const now = Date.now();
        const elapsed = Math.max(0, now - state.passTurnTickLastMs);
        state.passTurnTickLastMs = now;

        const nextRemaining = Math.max(0, getPassRemainingMs(activeSide) - elapsed);
        setPassRemainingMs(activeSide, nextRemaining);

        const secondsRemaining = Math.ceil(nextRemaining / 1000);
        renderTimer(secondsRemaining);
        playPassTimerCueOnce(activeSide, secondsRemaining);
        playPassTimerUrgencyOnce(activeSide, secondsRemaining);

        if (nextRemaining > 0) {
          return;
        }

        const otherSide = getOtherSide(activeSide);
        if (getPassRemainingMs(otherSide) <= 0) {
          window.clearInterval(state.timerIntervalId);
          state.timerIntervalId = null;
          finishRound();
          return;
        }

        setPassRemainingMs(activeSide, 0);
        state.passPendingNextSide = otherSide;
        showPassTurnOverlay();
      }, 250);

      return;
    }

    renderTimer(Math.ceil(ROUND_DURATION_MS / 1000));
    state.roundEndsAtMs = Date.now() + ROUND_DURATION_MS;

    if (state.timerIntervalId != null) {
      window.clearInterval(state.timerIntervalId);
    }

    state.timerIntervalId = window.setInterval(() => {
      const msRemaining = Math.max(0, state.roundEndsAtMs - Date.now());
      const secondsRemaining = Math.ceil(msRemaining / 1000);
      renderTimer(secondsRemaining);
      playTimerCueOnce(secondsRemaining);

      if (msRemaining <= 0) {
        window.clearInterval(state.timerIntervalId);
        state.timerIntervalId = null;
        finishRound();
      }
    }, 250);
  }

  function schedule(delayMs, callback) {
    const timerId = window.setTimeout(callback, delayMs);
    state.timers.push(timerId);
    return timerId;
  }

  function getQuestionAnswer(question) {
    if (!question) {
      return null;
    }

    if (question.sum != null) {
      return question.sum;
    }

    return question.answer;
  }

  function resolveRightQuestionWhenReady(token) {
    if (token !== state.roundToken) {
      return;
    }

    if (state.roundEnded) {
      return;
    }

    if (state.rightQuestionAnimating) {
      schedule(80, () => {
        resolveRightQuestionWhenReady(token);
      });
      return;
    }

    resolveQuestionSide("right");
  }

  function scheduleNpcIncrements(count, durationMs, startOffsetMs, token) {
    const steps = Math.max(0, Math.floor(count));
    if (!steps) {
      return;
    }

    for (let index = 1; index <= steps; index += 1) {
      // Spread events strictly inside the window to avoid boundary collisions at 30s/60s.
      const delay = startOffsetMs + Math.round((durationMs * index) / (steps + 1));
      schedule(delay, () => {
        resolveRightQuestionWhenReady(token);
      });
    }
  }

  function beginRoundQuestions(token) {
    if (token !== state.roundToken) {
      return;
    }

    state.leftInput = "";
    state.leftQuestionIndex = 0;
    state.rightQuestionIndex = 0;
    state.questionDeck = [];
    state.leftQuestionDeck = [];
    state.rightQuestionDeck = [];
    syncSideQuestion("left");
    syncSideQuestion("right");

    renderQuestions(false);
    renderAnswers();
  }

  function resolveQuestionSide(side) {
    const isLeft = side === "left";
    const animatingKey = isLeft ? "leftQuestionAnimating" : "rightQuestionAnimating";
    const indexKey = isLeft ? "leftQuestionIndex" : "rightQuestionIndex";
    if (state.roundEnded) {
      return Promise.resolve(false);
    }

    if (state[animatingKey]) {
      return Promise.resolve(false);
    }

    state[animatingKey] = true;
    return animateQuestionOrbToFlag(side).then(() => {
      if (state.roundEnded) {
        state[animatingKey] = false;
        return false;
      }

      if (isLeft) {
        state.leftInput = "";
        state.leftScore += 1;
        state.leftQuestionAttemptCount = 0;
        playSound("good_bear_1_attempt_success.mp3");
      } else {
        state.rightScore += 1;
        state.rightQuestionAttemptCount = 0;
        if (state.isTwoPlayer) {
          playSound("good_bear_2_attempt_success.mp3");
        } else {
          playSound("bad_bear_attempt_success.mp3");
        }
      }

      triggerBearJump(side, isLeft ? state.leftScore : state.rightScore);
      bumpFlag(side);
      updateProgressUi();
      renderScoreBoxes();

      if (!state.isPassAndPlay) {
        state[indexKey] += 1;
        syncSideQuestion(side);
        renderQuestionCard(side, true);
      }

      renderAnswers();

      return true;
    });
  }

  function startNpcPlan(token) {
    if (state.isTwoPlayer) {
      return;
    }

    const firstThirtyTarget = Math.max(0, Math.ceil(state.aLastThree / 2));
    scheduleNpcIncrements(firstThirtyTarget, FIRST_WINDOW_MS, 0, token);

    schedule(FIRST_WINDOW_MS, () => {
      if (token !== state.roundToken) return;

      const k = state.kFirst30;
      const lower = Math.max(3, Math.ceil(k * 1.5), firstThirtyTarget);
      const upper = Math.max(lower, Math.floor(k * 1.8), firstThirtyTarget + 1);
      const safeUpper = Math.max(lower, upper);
      const finalTarget = randomInt(lower, safeUpper);
      const addsNeeded = Math.max(0, finalTarget - state.rightScore);

      scheduleNpcIncrements(addsNeeded, FIRST_WINDOW_MS, 0, token);
    });
  }

  function applyThirtySecondAdjustment() {
    if (state.isTwoPlayer) {
      return;
    }

    state.kFirst30 = state.leftScore;
    state.frozenProgressAt30 = Math.min(1, state.kFirst30 / DEFAULT_STEPS);

    // S-adjustment algorithm disabled: keep S fixed at DEFAULT_STEPS (10).
    // if (state.kFirst30 < 5) {
    //   const a = state.aLastThree;
    //   state.requiredSteps = Math.max(3, state.kFirst30 * 2, Math.ceil(a / 2) + 1);
    //   state.dynamicAdjusted = true;
    //   updateProgressUi();
    // }

    logRoundMetrics("t=30s");
  }

  function getCurrentWinThreshold() {
    return DEFAULT_STEPS;
  }

  function finishRound(options = {}) {
    if (state.roundEnded) {
      return;
    }

    const persistScore = options.persistScore !== false;
    state.roundEnded = true;
    clearTimers();
    hidePassTurnOverlay();

    setAllKeypadsEnabled(false);
    showEndOverlay();

    if (persistScore && !state.isTwoPlayer) {
      recordRoundScore(state.leftScore);
    }
  }

  function clearInputForSide(side) {
    if (side === "right") {
      state.rightInput = "";
    } else {
      state.leftInput = "";
    }
    renderAnswers();
  }

  function appendDigitForSide(side, digit) {
    if (state.roundEnded) {
      return;
    }

    const isRight = side === "right";
    const inputKey = isRight ? "rightInput" : "leftInput";
    const animating = isRight ? state.rightQuestionAnimating : state.leftQuestionAnimating;

    if (animating) {
      return;
    }

    if (digit === "0") {
      if (!state[inputKey]) {
        state[inputKey] = "0";
        renderAnswers();
        return;
      }

      if (state[inputKey] === "0") {
        renderAnswers();
        return;
      }
    }

    if (state[inputKey] === "0") {
      state[inputKey] = digit;
      renderAnswers();
      return;
    }

    if (state[inputKey].length >= 2) {
      return;
    }
    state[inputKey] += digit;
    renderAnswers();
  }

  function submitAnswerForSide(side) {
    if (state.roundEnded) {
      return;
    }

    if (state.isPassAndPlay && (state.passTurnOverlayVisible || side !== state.activePassSide)) {
      return;
    }

    const isRight = side === "right";
    const inputValue = isRight ? state.rightInput : state.leftInput;
    const animating = isRight ? state.rightQuestionAnimating : state.leftQuestionAnimating;
    const question = isRight ? state.rightQuestion : state.leftQuestion;

    if (!inputValue || animating) {
      return;
    }

    const value = Number(inputValue);
    if (Number.isNaN(value)) {
      clearInputForSide(side);
      return;
    }

    if (isRight) {
      state.rightQuestionAttemptCount += 1;
    } else {
      state.leftQuestionAttemptCount += 1;
    }

    let resolutionPromise = Promise.resolve(false);
    if (value === getQuestionAnswer(question)) {
      if (!isRight) {
        recordHumanResolutionForAutoMode(question, state.leftQuestionAttemptCount);
      }
      resolutionPromise = resolveQuestionSide(side);
    } else {
      playSound("attempt_fail.mp3");
      triggerBearConfusedAnimation(side);
    }

    clearInputForSide(side);

    if (state.isPassAndPlay) {
      resolutionPromise.finally(() => {
        advancePassTurnAfterAttempt(side);
      });
    }
  }

  function clearInput() {
    clearInputForSide("left");
  }

  function appendDigit(digit) {
    appendDigitForSide("left", digit);
  }

  function submitLeftAnswer() {
    submitAnswerForSide("left");
  }

  function submitRightAnswer() {
    submitAnswerForSide("right");
  }

  function onKeyClick(event) {
    if (state.roundEnded) {
      return;
    }

    const button = event.currentTarget;
    const side = button.dataset.side;
    if (side !== "left" && side !== "right") {
      return;
    }

    if (side === "right" && !state.isTwoPlayer) {
      return;
    }

    if (state.isPassAndPlay && (state.passTurnOverlayVisible || side !== state.activePassSide)) {
      return;
    }

    if (button.dataset.action === "clear") {
      clearInputForSide(side);
      return;
    }

    if (button.dataset.action === "submit") {
      if (side === "right") {
        submitRightAnswer();
      } else {
        submitLeftAnswer();
      }
      return;
    }

    const digit = button.dataset.digit;
    if (!digit) {
      return;
    }
    appendDigitForSide(side, digit);
  }

  function setRightNumpadEnabled(enabled) {
    ui.rightKeys.forEach((button) => {
      button.disabled = !enabled;
      button.setAttribute("aria-disabled", enabled ? "false" : "true");
    });
  }

  function startRound() {
    state.roundToken += 1;
    const token = state.roundToken;

    clearTimers();
    stopInGameMusic();

    state.leftInput = "";
    state.rightInput = "";
    state.roundEnded = false;
    state.leftScore = 0;
    state.rightScore = 0;
    state.questionDeck = [];
    state.leftQuestionDeck = [];
    state.rightQuestionDeck = [];
    state.leftQuestionIndex = 0;
    state.rightQuestionIndex = 0;
    state.requiredSteps = DEFAULT_STEPS;
    state.dynamicAdjusted = false;
    state.kFirst30 = 0;
    state.frozenProgressAt30 = 0;
    state.leftQuestionAnimating = false;
    state.rightQuestionAnimating = false;
    state.leftQuestionAttemptCount = 0;
    state.rightQuestionAttemptCount = 0;
    state.autoDifficultyRuntime = {
      add: {
        resolvedCount: 0,
        firstTryCorrectCount: 0,
        decisionMade: false,
        hardModeEnabled: false,
      },
      sub: {
        resolvedCount: 0,
        firstTryCorrectCount: 0,
        decisionMade: false,
        hardModeEnabled: false,
      },
    };
    state.aLastThree = state.isTwoPlayer ? 0 : getLastThreeAverage();
    state.leftBarWasFull = false;
    state.rightBarWasFull = false;
    state.leftFullThreshold = null;
    state.rightFullThreshold = null;
    state.timerAlertSecond = null;
    state.passTurnOverlayVisible = false;
    state.activePassSide = "left";
    state.passPendingNextSide = "right";
    state.passTimeRemainingMs = {
      left: PASS_TURN_DURATION_MS,
      right: PASS_TURN_DURATION_MS,
    };
    state.passTurnTickLastMs = 0;
    state.passTimerCuePlayedSeconds.left.clear();
    state.passTimerCuePlayedSeconds.right.clear();
    clearPendingPassTurnOverlayDelay();
    stopParticleBurstLoop("leftParticleTimerId");
    stopParticleBurstLoop("rightParticleTimerId");
    hidePassTurnOverlay();
    hideEndOverlay();
    setAllKeypadsEnabled(true);

    renderAnswers();
    renderScoreBoxes();
    renderTimer(Math.ceil(ROUND_DURATION_MS / 1000));
    updateProgressUi();
    startRoundTimer();
    beginRoundQuestions(token);
    playInGameMusicLoop();
    if (!state.isTwoPlayer) {
      schedule(FIRST_WINDOW_MS, () => {
        if (token !== state.roundToken) return;
        applyThirtySecondAdjustment();
      });
    }

    startNpcPlan(token);
    scheduleQuestionTypographyFit();
    if (!state.isTwoPlayer) {
      logRoundMetrics("t=0s");
    }
  }

  function preventTouchZoomGestures() {
    const blockZoom = (event) => {
      event.preventDefault();
    };

    ["gesturestart", "gesturechange", "gestureend"].forEach((name) => {
      document.addEventListener(name, blockZoom, { passive: false });
    });

    let lastTouchEnd = 0;
    document.addEventListener(
      "touchend",
      (event) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
          event.preventDefault();
        }
        lastTouchEnd = now;
      },
      { passive: false }
    );

    document.addEventListener(
      "touchmove",
      (event) => {
        if (event.touches && event.touches.length > 1) {
          event.preventDefault();
        }
      },
      { passive: false }
    );
  }

  function attachEvents() {
    ui.keys.forEach((key) => {
      key.addEventListener("click", onKeyClick);
    });

    if (window.ResizeObserver) {
      questionTypographyObserver = new window.ResizeObserver(() => {
        scheduleQuestionTypographyFit();
      });

      [ui.leftQuestionBox, ui.rightQuestionBox].forEach((questionBox) => {
        if (questionBox) {
          questionTypographyObserver.observe(questionBox);
        }
      });
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready
        .then(() => {
          scheduleQuestionTypographyFit();
        })
        .catch(() => {
          // Ignore font-loading failures.
        });
    }

    window.addEventListener("resize", () => {
      updateProgressUi();
      scheduleQuestionTypographyFit();
      positionFireOverlayOnBear("left");
      positionFireOverlayOnBear("right");
    });

    if (ui.endActionRestartButton) {
      ui.endActionRestartButton.addEventListener("click", onEndActionRestart);
    }

    if (ui.endActionHomeButton) {
      ui.endActionHomeButton.addEventListener("click", onEndActionHome);
    }

    if (ui.passTurnContinueButton) {
      renderPassTurnTransitionCountdown(PASS_TURN_TRANSITION_COUNTDOWN_SECONDS);
    }
  }

  function runStartupCountdown() {
    if (!ui.startupCountdown || !ui.startupCountdownValue) {
      startRound();
      return;
    }

    let remaining = STARTUP_COUNTDOWN_SECONDS;
    ui.startupCountdown.hidden = false;
    ui.startupCountdownValue.textContent = String(remaining);

    const tick = () => {
      remaining -= 1;
      if (remaining <= 0) {
        ui.startupCountdown.hidden = true;
        startRound();
        return;
      }

      ui.startupCountdownValue.textContent = String(remaining);
      schedule(1000, tick);
    };

    schedule(1000, tick);
  }

  function init() {
    preventTouchZoomGestures();
    applyMultiplayerSideAssets();
    initFireOverlays();
    ensureEndBearLayout();
    applyOperationModeClasses();
    setRightNumpadEnabled(state.isTwoPlayer);
    attachEvents();
    renderTimer(Math.ceil(ROUND_DURATION_MS / 1000));
    scheduleQuestionTypographyFit();
    runStartupCountdown();
  }

  window.endGameEarlyPreview = () => {
    finishRound({ persistScore: false });
  };

  init();
})();
