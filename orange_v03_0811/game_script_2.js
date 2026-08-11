// ======================= 2.5D Jungle Canvas =======================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;

// Show the preparation/loading overlay while game assets are loading.
if (typeof window.showPrepOverlay === "function") {
  window.showPrepOverlay("Tangerine");
}

// Gift box / claw catch shared state
let activeGiftBox = null;

let activeGiftValue = null;
let pendingCatchGift = false;
let hasCaughtGift = false;
let caughtGiftEl = null;

// Track guesses for the current round (used by the SEN smart wrong-option logic).
// Each entry is { target, guess, isHit } for the active gift.
let currentRoundGuesses = [];

// Wooden sign video removed


// Gift control panel / monitor state
let giftPanelState = {
  phase: "hidden", // "hidden" | "prompt" | "typing" | "moving" | "error" | "success"
  inputValue: "",
  keyboardEnabled: false,
  maxValue: null,
};

let giftControlPanel = null;
let giftMonitor = null;
let giftMonitorMessage = null;
let giftMonitorInput = null;
let giftDigitButtons = [];
let giftResetButton = null;
let giftMoveButton = null;
let giftZeroButton = null;
let giftButtonsInitialised = false;
let giftKeySequenceTimers = [];
let giftInputRestoreTimer = null;
let giftButtonsLocked = false;

// URL sanitisation and safe HTMLMediaElement playback helpers.
// These are shared across game_2 and menu_2 to prevent corrupt URLs
// (e.g. containing %00) and to centralise play() promise handling.
(function () {
  var CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/g;
  function sanitizeMediaUrl(raw) {
    if (typeof raw !== "string") return null;

    var cleaned = raw.replace(CONTROL_CHARS_REGEX, "").trim();
    if (!cleaned) return null;

    var urlObj;
    try {
      // Resolve relative path against current page location
      var baseDir = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
      urlObj = new URL(cleaned, baseDir);
    } catch (e) {
      return null;
    }

    // ✅ ADDED "file:" HERE so it works locally on your PC!
    var protocol = urlObj.protocol;
    if (
      protocol !== "http:" &&
      protocol !== "https:" &&
      protocol !== "file:" &&
      protocol !== "blob:" &&
      protocol !== "data:"
    ) {
      console.warn("[media] disallowed protocol", { url: urlObj.toString() });
      return null;
    }

    return urlObj.toString();
  }

  var mediaPlayState = new WeakMap();

  function safePlayMedia(mediaEl, rawUrl) {
    if (!mediaEl) {
      return Promise.reject(new Error("safePlayMedia: missing media element"));
    }

    var state = mediaPlayState.get(mediaEl);
    if (!state) {
      state = { requestId: 0 };
      mediaPlayState.set(mediaEl, state);
    }
    state.requestId += 1;
    var requestId = state.requestId;

    if (rawUrl != null) {
      var url = sanitizeMediaUrl(rawUrl);
      if (!url) {
        return Promise.reject(new Error("safePlayMedia: invalid media URL"));
      }
      try {
        mediaEl.src = url;
        if (typeof mediaEl.load === "function") {
          mediaEl.load();
        }
      } catch (e) {
        console.error("[media] failed to set src on element", e);
        return Promise.reject(e);
      }
    }

    var playPromise;
    try {
      playPromise = mediaEl.play();
    } catch (syncErr) {
      console.error("[media] synchronous play() error", syncErr);
      return Promise.reject(syncErr);
    }

    if (!playPromise || typeof playPromise.then !== "function") {
      // Older browsers: no promise; we still respect races by checking
      // requestId when callers chain on the returned value.
      return Promise.resolve();
    }

    return playPromise
      .then(function () {
        if (state.requestId !== requestId) {
          // A newer request has superseded this one; stop this playback.
          try {
            mediaEl.pause();
          } catch (_) {}
          return;
        }
      })
      .catch(function (err) {
        if (state.requestId !== requestId) {
          // Error from an outdated request; ignore.
          return;
        }
        console.error("[media] play() promise rejected", err);
      });
  }

  // Expose helpers globally so menu_2 and other scripts can share them.
  if (!window.sanitizeMediaUrl) {
    window.sanitizeMediaUrl = sanitizeMediaUrl;
  }
  if (!window.safePlayMedia) {
    window.safePlayMedia = safePlayMedia;
  }
})();

const essentialGameImageUrls = [
  "./orange_fruit_claw_open.png",
  "./fairy-flying_on_the_spot.png",
  "./fairy-flying_around.png",
  "./fairy-suprised.png",
  "./orange_bear_keyless-catcher.png",
  "./orange_bear-jumping_waving_hands.png",
  "./golden_key.png",
];

const preloadedImagePromises = new Map();

function preloadImageAsset(rawUrl) {
  const resolvedUrl =
    typeof window.sanitizeMediaUrl === "function"
      ? window.sanitizeMediaUrl(rawUrl)
      : rawUrl;

  if (!resolvedUrl) {
    return Promise.resolve(null);
  }

  if (preloadedImagePromises.has(resolvedUrl)) {
    return preloadedImagePromises.get(resolvedUrl);
  }

  const promise = new Promise((resolve) => {
    const img = new Image();
    let settled = false;

    function finish() {
      if (settled) {
        return;
      }
      settled = true;
      resolve(img);
    }

    img.addEventListener("load", finish, { once: true });
    img.addEventListener("error", finish, { once: true });
    img.src = resolvedUrl;

    if (img.complete) {
      finish();
    }
  });

  preloadedImagePromises.set(resolvedUrl, promise);
  return promise;
}

window.preloadImageAsset = preloadImageAsset;


// ======================= Generic Spritesheet Player =======================
// Descriptor format per animation:
// {
//   id,
//   png,
//   frameWidth,
//   frameHeight,
//   columns,
//   totalFrames,
//   frameDurationMs,
//   loop,
//   sequence // optional explicit frame order
// }

function normalizeSpritesheetDescriptor(rawDescriptor) {
  if (!rawDescriptor || typeof rawDescriptor !== "object") {
    throw new Error("Spritesheet descriptor must be an object.");
  }

  const descriptor = {
    id: rawDescriptor.id != null ? String(rawDescriptor.id) : "",
    png: String(rawDescriptor.png || ""),
    frameWidth: Math.max(1, Math.floor(Number(rawDescriptor.frameWidth) || 0)),
    frameHeight: Math.max(1, Math.floor(Number(rawDescriptor.frameHeight) || 0)),
    columns: Math.max(1, Math.floor(Number(rawDescriptor.columns) || 0)),
    totalFrames: Math.max(1, Math.floor(Number(rawDescriptor.totalFrames) || 0)),
    frameDurationMs: Math.max(1, Number(rawDescriptor.frameDurationMs) || 0),
    loop: Boolean(rawDescriptor.loop),
    sequence: Array.isArray(rawDescriptor.sequence) ? rawDescriptor.sequence.slice() : null,
  };

  if (!descriptor.png) {
    throw new Error("Spritesheet descriptor requires 'png'.");
  }

  return descriptor;
}

function buildFrameSequence(descriptor, overrideSequence) {
  const source = Array.isArray(overrideSequence)
    ? overrideSequence
    : Array.isArray(descriptor.sequence)
      ? descriptor.sequence
      : null;

  if (!source || source.length === 0) {
    return Array.from({ length: descriptor.totalFrames }, function (_, i) {
      return i;
    });
  }

  const safe = [];
  for (let i = 0; i < source.length; i += 1) {
    const frameIndex = Math.floor(Number(source[i]));
    if (
      Number.isFinite(frameIndex) &&
      frameIndex >= 0 &&
      frameIndex < descriptor.totalFrames
    ) {
      safe.push(frameIndex);
    }
  }

  if (safe.length === 0) {
    return Array.from({ length: descriptor.totalFrames }, function (_, i) {
      return i;
    });
  }

  return safe;
}

class GenericSpritesheetPlayer {
  constructor(element, descriptor) {
    this.element = element || null;
    this.descriptor = normalizeSpritesheetDescriptor(descriptor);
    this.sequence = [];
    this.sequenceIndex = 0;
    this.accumulatedMs = 0;
    this.lastTimestamp = null;
    this.rafId = null;
    this.running = false;

    this._applyBaseStyles();
  }

  setDescriptor(descriptor) {
    const wasRunning = this.running;
    this.stop();
    this.descriptor = normalizeSpritesheetDescriptor(descriptor);
    this._applyBaseStyles();
    if (wasRunning) {
      this.play();
    }
  }

  play(sequenceOverride) {
    if (!this.element) {
      return;
    }

    this.stop();

    this.sequence = buildFrameSequence(this.descriptor, sequenceOverride);
    this.sequenceIndex = 0;
    this.accumulatedMs = 0;
    this.lastTimestamp = null;
    this.running = true;

    this._renderFrame(this.sequence[0]);
    this.rafId = window.requestAnimationFrame(this._tick.bind(this));
  }

  stop() {
    if (this.rafId != null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.running = false;
    this.lastTimestamp = null;
    this.accumulatedMs = 0;
  }

  setFrame(frameIndex) {
    const safeFrameIndex = Math.floor(Number(frameIndex));
    if (
      Number.isFinite(safeFrameIndex) &&
      safeFrameIndex >= 0 &&
      safeFrameIndex < this.descriptor.totalFrames
    ) {
      this._renderFrame(safeFrameIndex);
    }
  }

  _applyBaseStyles() {
    if (!this.element) {
      return;
    }

    const d = this.descriptor;
    this.element.style.backgroundImage = `url(${d.png})`;
    this.element.style.width = `${d.frameWidth}px`;
    this.element.style.height = `${d.frameHeight}px`;
    this.element.style.backgroundRepeat = "no-repeat";
  }

  _tick(timestamp) {
    if (!this.running) {
      return;
    }

    if (this.lastTimestamp == null) {
      this.lastTimestamp = timestamp;
    }

    const deltaMs = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    this.accumulatedMs += deltaMs;

    while (this.accumulatedMs >= this.descriptor.frameDurationMs && this.running) {
      this.accumulatedMs -= this.descriptor.frameDurationMs;
      this.sequenceIndex += 1;

      if (this.sequenceIndex >= this.sequence.length) {
        if (this.descriptor.loop) {
          this.sequenceIndex = 0;
        } else {
          this.stop();
          return;
        }
      }

      this._renderFrame(this.sequence[this.sequenceIndex]);
    }

    this.rafId = window.requestAnimationFrame(this._tick.bind(this));
  }

  _renderFrame(frameIndex) {
    if (!this.element) {
      return;
    }

    const d = this.descriptor;
    // 1D frame index mapped into a 2D sheet grid.
    const col = frameIndex % d.columns;
    const row = Math.floor(frameIndex / d.columns);

    this.element.style.backgroundImage = `url(${d.png})`;
    this.element.style.backgroundPosition = `${-col * d.frameWidth}px ${-row * d.frameHeight}px`;
    this.element.style.width = `${d.frameWidth}px`;
    this.element.style.height = `${d.frameHeight}px`;
    this.element.style.backgroundRepeat = "no-repeat";
  }
}

function createSpritesheetPlayer(element, descriptor) {
  return new GenericSpritesheetPlayer(element, descriptor);
}

// Global helpers for pure data-driven usage in game code.
window.createSpritesheetPlayer = createSpritesheetPlayer;
window.normalizeSpritesheetDescriptor = normalizeSpritesheetDescriptor;


// ======================= Claw Machine (Canvas) =======================


function initClawMachinePNGLegacyCanvas() {
  const clawCanvas = document.getElementById("clawCanvas");
  if (!clawCanvas) {
    return;
  }

  const clawCtx = clawCanvas.getContext("2d");
  if (!clawCtx) {
    return;
  }

  // Match the claw canvas width to the viewport so that positions
  // along the bottom number line (0 to max) can always be mapped
  // directly to visible clamp positions.
  clawCanvas.width = window.innerWidth;
  clawCanvas.height = 600;

  const clawImage = new Image();
  clawImage.src = "./orange_fruit_claw_open.png";

  let imageLoaded = false;
  clawImage.addEventListener("load", () => {
    imageLoaded = true;
  });
  clawImage.addEventListener("error", () => {
    // If the image fails to load, we still run the animation loop to
    // avoid breaking controlClawPosition callers.
    imageLoaded = false;
  });

  // Horizontal movement state (canvas-pixel coordinates relative to
  // the canvas centre).
  let targetRootX = 0;
  let currentRootX = 0;
  let rootVelX = 0;

  // Single pendulum state: swing angle around the steel bar and its
  // angular velocity.
  let swingAngle = 0;
  let swingVel = 0;

  // Swing angle limit:  b110 b0 from vertical.
  const maxSwingAngle = Math.PI / 18; // 10 degrees

  // Eased horizontal movement state for the claw when it is instructed to move.
  let isMoving = false;
  let moveStartX = 0;
  let moveEndX = 0;
  let moveStartTime = 0;
  let moveDuration = 0;

  // Clamp movement duration so very short moves still feel smooth,
  // and longer moves do not take too long. Speed is in pixels / second.
  const minMoveDuration = 0.3;
  const maxMoveDuration = 4;
  const maxMoveSpeed = 200; // horizontal movement speed (slower than before)


  let lastAnimTime = null;

  function controlClawPosition(value) {
    const svg = document.getElementById("numberLineSVG");
    if (!svg || !clawCanvas) {
      return;
    }

    const rect = svg.getBoundingClientRect();
    const maxScale = getNumberLineScaleFromGameState();
    const maxValue = maxScale && maxScale > 0 ? maxScale : 10;

    let v = typeof value === "number" ? value : 0;
    if (v < 0) v = 0;
    if (v > maxValue) v = maxValue;

    // Map 0 to the left tick at x=50, and maxValue to the right tick at x=4950
    const startX = 50;
    const endX = 4950;
    const totalWidth = endX - startX;
    const xSvg = startX + (v / maxValue) * totalWidth;

    // Convert SVG coordinate to screen coordinate using rect and the known viewBox
    const viewBoxWidth = 5000;
    const ratioX = xSvg / viewBoxWidth;
    const desiredScreenX = rect.left + ratioX * rect.width;

    const clawRect = clawCanvas.getBoundingClientRect();
    const clawCenterX = clawRect.left + clawRect.width / 2;
    const deltaScreenX = desiredScreenX - clawCenterX;

    // Use screen-pixel units directly for the claw's horizontal motion.
    const newTarget = deltaScreenX;

    const distance = Math.abs(newTarget - currentRootX);
    targetRootX = newTarget;

    if (distance < 0.001) {
      // No meaningful move required.
      isMoving = false;
      moveDuration = 0;
      moveStartX = currentRootX;
      moveEndX = currentRootX;
      rootVelX = 0;
      return;
    }

    moveStartX = currentRootX;
    moveEndX = newTarget;
    moveStartTime = performance.now();

    // Compute an ideal duration based on distance and the maximum speed,
    // then clamp into a friendly 0.3 e20 e24 second window.
    const idealDuration = distance / maxMoveSpeed;
    moveDuration = Math.min(maxMoveDuration, Math.max(minMoveDuration, idealDuration));
    isMoving = true;
  }

  window.controlClawPosition = controlClawPosition;

  function animateClaw() {
    const now = performance.now();
    const dt = lastAnimTime ? (now - lastAnimTime) / 1000 : 0;
    lastAnimTime = now;

    const prevRootX = currentRootX;

    if (isMoving && moveDuration > 0 && dt > 0) {
      const elapsedSeconds = (now - moveStartTime) / 1000;
      const tNorm = Math.max(0, Math.min(elapsedSeconds / moveDuration, 1));

      // Ease-in-out (quadratic) for smoother start/stop.
      const eased =
        tNorm < 0.5
          ? 2 * tNorm * tNorm
          : -1 + (4 - 2 * tNorm) * tNorm;

      currentRootX = moveStartX + (moveEndX - moveStartX) * eased;

      if (tNorm >= 1) {
        currentRootX = moveEndX;
        isMoving = false;
        moveDuration = 0;
      }
    }

    if (dt > 0) {
      rootVelX = (currentRootX - prevRootX) / dt;

      // Impose a maximum horizontal speed to keep motion controlled.
      const maxSpeed = maxMoveSpeed;
      if (rootVelX > maxSpeed) rootVelX = maxSpeed;
      else if (rootVelX < -maxSpeed) rootVelX = -maxSpeed;
    }

    const horizontalVel = rootVelX;

    // Single pendulum dynamics: damped spring driven by horizontal velocity.
    const kSwing = 2.5;
    const cSwing = 1.8;
    const couplingSwing = 0.04;

    swingVel +=
      (-kSwing * swingAngle -
        cSwing * swingVel +
        couplingSwing * horizontalVel) * dt;

    swingAngle += swingVel * dt;

    // Enforce swing angle limit ( b110 b0 from vertical).
    if (swingAngle > maxSwingAngle) {
      swingAngle = maxSwingAngle;
      if (swingVel > 0) swingVel = -swingVel * 0.4;
    } else if (swingAngle < -maxSwingAngle) {
      swingAngle = -maxSwingAngle;
      if (swingVel < 0) swingVel = -swingVel * 0.4;
    }

    const t = now * 0.001;

    // When the clamp is idle (no commanded movement), make the
    // bobbing a bit more vigorous (double amplitude).
    const idleFactor = isMoving ? 1.0 : 2.0;
    const idleBobY = Math.sin(t * 0.5) * 6 * idleFactor;

    clawCtx.clearRect(0, 0, clawCanvas.width, clawCanvas.height);

    if (!imageLoaded || !clawImage.width || !clawImage.height) {
      requestAnimationFrame(animateClaw);
      return;
    }

    const basePivotY = clawCanvas.height / 2;
    const pivotY = basePivotY + idleBobY;
    const pivotX = clawCanvas.width / 2 + currentRootX;

    const imgWidth = clawImage.width;
    const imgHeight = clawImage.height;

    clawCtx.save();
    clawCtx.translate(pivotX, pivotY);
    clawCtx.rotate(swingAngle);
    // Draw the image so that its top centre is at the pivot.
    clawCtx.drawImage(
      clawImage,
      -imgWidth / 2,
      0,
      imgWidth,
      imgHeight
    );
    clawCtx.restore();

    requestAnimationFrame(animateClaw);
  }

  // Keep the claw canvas responsive to viewport width.
  window.addEventListener("resize", () => {
    clawCanvas.width = window.innerWidth;
    clawCanvas.height = 600;
  });

  animateClaw();
}



// Legacy Zdog claw machine kept for reference but no longer used.
// All interactive claw motion now drives a DOM <img> element instead.

function initClawMachinePNG() {
  const img = document.getElementById("clawMachineImage");
  if (!img) {
    return;
  }

  const leftCog = document.getElementById("leftCog");
  const rightCog = document.getElementById("rightCog");
  let cogAngleDeg = 0;
  const cogSpinDegPerSecond = 180; // 0.5 rotations/second
  const cogVelocityThreshold = 8;

  const clawSrcOpen = "./orange_fruit_claw_open.png";
  const clawSheetUrl = "./claw_sheet.png";
  const clawSheetFrameSizePx = 256;
  const clawSheetColumns = 4;
  const clawSheetRows = 4;
  const transparentPixelSrc =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z5D8AAAAASUVORK5CYII=";
  let clawSheetDisplayFrameWidthPx = 720;
  let clawSheetDisplayFrameHeightPx = 720;
  const clawCloseAnimationDurationMs = 1500;
  const clawCloseFrameCount = 16;
  const clawCloseFrameDurationMs = clawCloseAnimationDurationMs / clawCloseFrameCount;
  const clawFollowYOffsetPx = window.innerHeight * 0.03;
  const successBearTopVh = 12;
  const successBearFrameSize = 256;
  const successBearScale = 0.7;
  const successBearJumpFrame = 14;
  const successBearJumpCount = 3;
  const successBearJumpDurationMs = 1200;
  const successBearJumpArcVh = 2.5;
  const successBearKeyTransferDurationMs = 500;
  const successBearExitDurationMs = 850;
  const successBearExitJumpCount = 3;
  const successBearExitOffscreenPaddingPx = 24;
  const successBearExitArcVh = 2.5;
  const successBearCatcherSequence = [14, 16, 18, 19, 20, 21, 22, 3, 4, 5, 6, 7, 9, 11, 13];
  const successBearWaveSequence = [8, 9, 10, 11, 12, 13, 14, 15, 14, 13, 12, 11, 10, 9];
  const successBearCatcherDescriptor = {
    id: "orange-bear-catcher",
    png: "./orange_bear_keyless-catcher.png",
    frameWidth: successBearFrameSize,
    frameHeight: successBearFrameSize,
    columns: 5,
    totalFrames: 25,
    frameDurationMs: 90,
    loop: false,
  };
  const successBearWaveDescriptor = {
    id: "orange-bear-wave",
    png: "./orange_bear-jumping_waving_hands.png",
    frameWidth: successBearFrameSize,
    frameHeight: successBearFrameSize,
    columns: 4,
    totalFrames: 16,
    frameDurationMs: 90,
    loop: true,
  };

    // Track how close the last failed attempt was (for human fail voices).
  let lastAttemptNearMiss = false;
  // Store the numeric difference between gift position and claw for the last failed attempt.
  let lastAttemptDiff = null;
  let successBearEl = null;
  let successBearAnimator = null;
  let successBearAnimationId = null;
  let successBearSequenceTimer = null;
  let successBearMidpointTimer = null;
  let successBearKeyAnimationId = null;
  let successBearExitPromise = null;
  let successBearExitResolve = null;
  let successBearRunId = 0;
  let successBearState = "hidden";
  let successBearCenterX = -successBearFrameSize;
  let successBearCenterY = 0;
  let successBearFacing = 1;
  let clawSpriteAnimationActive = false;
  let clawSpriteAnimationCompleted = false;
  let clawSpriteAnimationStart = 0;
  let clawSpriteFrameIndex = 0;
  let clawFollowAnimationActive = false;
  let clawFollowAnimationStart = 0;
  let clawFollowAnimationStartX = 0;
  let clawFollowAnimationStartY = 0;
  let clawFollowAnimationTargetX = 0;
  let clawFollowAnimationTargetY = 0;
  let shouldFollowClawDuringClose = false;
  let shouldRotateClawDuringClose = false;
  let clawCloseRotationDirection = 0;


  // Ensure the clamp image starts in the open state.
  try {
    img.src = clawSrcOpen;
  } catch (_) {}

  // Warm the spritesheet once to reduce first-play hitching.
  preloadImageAsset(clawSheetUrl);
  preloadImageAsset(clawSrcOpen).then((openImg) => {
    if (!openImg) {
      return;
    }
    if (openImg.naturalWidth > 0) {
      clawSheetDisplayFrameWidthPx = openImg.naturalWidth;
    }
    if (openImg.naturalHeight > 0) {
      clawSheetDisplayFrameHeightPx = openImg.naturalHeight;
    }
  });

  // Ensure the clamp swings around the top centre (steel bar).
  img.style.transformOrigin = "50% 0%";
  img.style.backgroundRepeat = "no-repeat";
  img.style.border = "none";
  img.style.outline = "none";
  img.style.padding = "0";
  img.style.display = "block";

  function showClawOpenVisual() {
    if (!img) {
      return;
    }
    const wasOpenMode = img.dataset.clawVisualMode === "open";
    const hasOpenSource =
      typeof img.currentSrc === "string" &&
      img.currentSrc.indexOf("orange_fruit_claw_open.png") !== -1;

    img.dataset.clawVisualMode = "open";
    img.style.backgroundImage = "none";
    img.style.backgroundSize = "";
    img.style.backgroundPosition = "0 0";
    img.style.objectFit = "contain";
    img.style.objectPosition = "50% 50%";

    // Avoid resetting src every animation frame; repeated resets can
    // trigger flicker or broken-image flashes on some browsers.
    if (!wasOpenMode || !hasOpenSource) {
      img.src = clawSrcOpen;
    }
  }

  function resetClawToOpenVisual() {
    clawSpriteAnimationActive = false;
    clawSpriteAnimationCompleted = false;
    clawSpriteFrameIndex = 0;
    clawFollowAnimationActive = false;
    showClawOpenVisual();
  }

  window.resetClawToOpenVisual = resetClawToOpenVisual;

  function showClawClosedVisual() {
    if (!img) {
      return;
    }
    renderClawCloseFrame(clawCloseFrameCount - 1);
  }

  function renderClawCloseFrame(frameIndex) {
    if (!img) {
      return;
    }

    const safeIndex = Math.max(0, Math.min(clawCloseFrameCount - 1, Math.floor(frameIndex)));
    const col = safeIndex % clawSheetColumns;
    const row = Math.floor(safeIndex / clawSheetColumns);

    if (img.dataset.clawVisualMode !== "sheet") {
      if (img.naturalWidth > 0) {
        clawSheetDisplayFrameWidthPx = img.naturalWidth;
      }
      if (img.naturalHeight > 0) {
        clawSheetDisplayFrameHeightPx = img.naturalHeight;
      }

      img.dataset.clawVisualMode = "sheet";
      // Keep a valid image source so browsers do not show a broken-image icon.
      img.src = transparentPixelSrc;
      img.removeAttribute("alt");
      img.style.objectFit = "none";
      img.style.objectPosition = "0 0";
      img.style.backgroundColor = "transparent";
    }

    const rect = img.getBoundingClientRect();
    let frameDisplayWidth = rect.width;
    let frameDisplayHeight = rect.height;

    if (!(frameDisplayWidth > 0) || !(frameDisplayHeight > 0)) {
      const computed = window.getComputedStyle(img);
      frameDisplayWidth = parseFloat(computed.width) || 0;
      frameDisplayHeight = parseFloat(computed.height) || 0;
    }

    if (!(frameDisplayWidth > 0) || !(frameDisplayHeight > 0)) {
      const fallbackSize = (window.innerHeight || 0) * 0.1;
      frameDisplayWidth = fallbackSize;
      frameDisplayHeight = fallbackSize;
    }

    img.style.backgroundImage = `url(${clawSheetUrl})`;
    img.style.backgroundSize = `${frameDisplayWidth * clawSheetColumns}px ${frameDisplayHeight * clawSheetRows}px`;
    img.style.backgroundPosition = `${-col * frameDisplayWidth}px ${-row * frameDisplayHeight}px`;
    img.style.backgroundRepeat = "no-repeat";
  }

  function startClawCloseSpritesheet() {
    if (!img) {
      return;
    }

    clawSpriteAnimationActive = true;
    clawSpriteAnimationCompleted = false;
    clawSpriteAnimationStart = performance.now();
    clawSpriteFrameIndex = 0;
    renderClawCloseFrame(0);
  }

  function updateClawCloseSpritesheet(now) {
    if (!clawSpriteAnimationActive || !img) {
      return;
    }

    const elapsed = now - clawSpriteAnimationStart;
    if (elapsed >= clawCloseAnimationDurationMs) {
      clawSpriteAnimationActive = false;
      clawSpriteAnimationCompleted = true;
      renderClawCloseFrame(clawCloseFrameCount - 1);
      return;
    }

    clawSpriteFrameIndex = Math.min(
      clawCloseFrameCount - 1,
      Math.floor(elapsed / clawCloseFrameDurationMs)
    );
    renderClawCloseFrame(clawSpriteFrameIndex);
  }

  function startClawFollowAnimation() {
    if (!caughtGiftEl || !img) {
      return;
    }

    const imgRect = img.getBoundingClientRect();
    const giftRect = caughtGiftEl.getBoundingClientRect();
    clawFollowAnimationActive = true;
    clawFollowAnimationStart = performance.now();
    clawFollowAnimationStartX = giftRect.left + giftRect.width / 2;
    clawFollowAnimationStartY = giftRect.top + giftRect.height / 2;
    clawFollowAnimationTargetX = imgRect.left + imgRect.width / 2;
    // Horizontal-only key shift: preserve Y while moving toward the claw.
    clawFollowAnimationTargetY = clawFollowAnimationStartY;
  }

  function getSuccessBearBaseTopPx() {
    return (window.innerHeight * successBearTopVh) / 100;
  }

  function getSuccessBearJumpArcPx() {
    return (window.innerHeight * successBearJumpArcVh) / 100;
  }

  function getSuccessBearExitArcPx() {
    return (window.innerHeight * successBearExitArcVh) / 100;
  }

  function applySuccessBearTransform() {
    if (!successBearEl) {
      return;
    }
    successBearEl.style.left = `${successBearCenterX}px`;
    successBearEl.style.top = `${successBearCenterY}px`;
    successBearEl.style.transform = `translate(-50%, -50%) scale(${successBearFacing * successBearScale}, ${successBearScale})`;
  }

  function ensureSuccessBear() {
    if (successBearEl && successBearAnimator) {
      applySuccessBearTransform();
      return;
    }

    successBearEl = document.createElement("div");
    successBearEl.id = "orangeBearSuccessSprite";
    successBearEl.style.position = "fixed";
    successBearCenterX = -successBearFrameSize;
    successBearCenterY = getSuccessBearBaseTopPx() + successBearFrameSize * successBearScale * 0.5;
    successBearEl.style.left = `${successBearCenterX}px`;
    successBearEl.style.top = `${successBearCenterY}px`;
    successBearEl.style.width = `${successBearFrameSize}px`;
    successBearEl.style.height = `${successBearFrameSize}px`;
    successBearEl.style.transformOrigin = "50% 50%";
    successBearEl.style.pointerEvents = "none";
    successBearEl.style.opacity = "0";
    successBearEl.style.zIndex = "1300";
    applySuccessBearTransform();
    document.body.appendChild(successBearEl);

    successBearAnimator = createSpritesheetPlayer(successBearEl, successBearCatcherDescriptor);
    successBearAnimator.setFrame(successBearJumpFrame);
  }

  function clearSuccessBearTimers() {
    if (successBearAnimationId != null) {
      window.cancelAnimationFrame(successBearAnimationId);
      successBearAnimationId = null;
    }
    if (successBearSequenceTimer != null) {
      window.clearTimeout(successBearSequenceTimer);
      successBearSequenceTimer = null;
    }
    if (successBearMidpointTimer != null) {
      window.clearTimeout(successBearMidpointTimer);
      successBearMidpointTimer = null;
    }
    if (successBearKeyAnimationId != null) {
      window.cancelAnimationFrame(successBearKeyAnimationId);
      successBearKeyAnimationId = null;
    }
  }

  function finishSuccessBearExit() {
    if (successBearExitResolve) {
      const resolve = successBearExitResolve;
      successBearExitResolve = null;
      successBearExitPromise = null;
      resolve();
    }
  }

  function resetCaughtGiftVisuals() {
    if (!caughtGiftEl) {
      return;
    }

    caughtGiftEl.style.visibility = "visible";
    caughtGiftEl.style.opacity = "1";
    caughtGiftEl.style.transform = "translate(-50%, -50%) scale(1)";
  }

  function hideSuccessBear() {
    successBearRunId += 1;
    clearSuccessBearTimers();
    successBearState = "hidden";
    if (successBearAnimator) {
      successBearAnimator.stop();
      successBearAnimator.setDescriptor(successBearCatcherDescriptor);
      successBearAnimator.setFrame(successBearJumpFrame);
    }
    if (successBearEl) {
      successBearEl.style.opacity = "0";
      successBearCenterX = -successBearFrameSize;
      successBearCenterY = getSuccessBearBaseTopPx() + successBearFrameSize * successBearScale * 0.5;
      successBearFacing = 1;
      applySuccessBearTransform();
    }
    resetCaughtGiftVisuals();
    finishSuccessBearExit();
  }

  function queueSuccessfulRoundResolution() {
    if (verticalPhase === "idle" && roundOutcomePending && !isMoving) {
      roundOutcomePending = false;
      handleRoundOutcome();
    }
  }

  function startSuccessBearWaveLoop() {
    if (!successBearAnimator) {
      return;
    }
    successBearState = "waving";
    successBearAnimator.setDescriptor(successBearWaveDescriptor);
    successBearAnimator.play(successBearWaveSequence);
    queueSuccessfulRoundResolution();
  }

  function animateCaughtGiftToBear(runId) {
    if (!caughtGiftEl || runId !== successBearRunId) {
      return;
    }

    const giftRect = caughtGiftEl.getBoundingClientRect();
    const bearRect = successBearEl ? successBearEl.getBoundingClientRect() : null;
    if (!bearRect) {
      return;
    }

    const startX = giftRect.left + giftRect.width / 2;
    const startY = giftRect.top + giftRect.height / 2;
    const targetX = bearRect.left + bearRect.width / 2;
    const targetY = bearRect.top + bearRect.height / 2;
    const startScale = 1;
    let startTimestamp = null;

    function animateKey(timestamp) {
      if (runId !== successBearRunId || !caughtGiftEl) {
        return;
      }
      if (startTimestamp == null) {
        startTimestamp = timestamp;
      }

      const elapsed = Math.min(timestamp - startTimestamp, successBearKeyTransferDurationMs);
      const progress = successBearKeyTransferDurationMs > 0
        ? elapsed / successBearKeyTransferDurationMs
        : 1;
      const currentX = startX + (targetX - startX) * progress;
      const currentY = startY + (targetY - startY) * progress;
      const scale = startScale * (1 - progress);

      caughtGiftEl.style.left = `${currentX}px`;
      caughtGiftEl.style.top = `${currentY}px`;
      caughtGiftEl.style.transform = `translate(-50%, -50%) scale(${Math.max(scale, 0)})`;
      caughtGiftEl.style.opacity = `${1 - progress}`;

      if (elapsed >= successBearKeyTransferDurationMs) {
        successBearKeyAnimationId = null;
        caughtGiftEl.style.left = `${targetX}px`;
        caughtGiftEl.style.top = `${targetY}px`;
        caughtGiftEl.style.transform = "translate(-50%, -50%) scale(0)";
        caughtGiftEl.style.opacity = "0";
        return;
      }

      successBearKeyAnimationId = window.requestAnimationFrame(animateKey);
    }

    successBearKeyAnimationId = window.requestAnimationFrame(animateKey);
  }

  function startSuccessBearCatcherOnce(runId) {
    if (!successBearAnimator) {
      return;
    }
    successBearState = "catcher";
    successBearAnimator.setDescriptor(successBearCatcherDescriptor);
    successBearAnimator.play(successBearCatcherSequence);

    const catcherDurationMs =
      successBearCatcherSequence.length * successBearCatcherDescriptor.frameDurationMs;
    const catcherMidpointMs = catcherDurationMs / 2;
    successBearMidpointTimer = window.setTimeout(() => {
      if (runId !== successBearRunId) {
        return;
      }
      successBearMidpointTimer = null;
      animateCaughtGiftToBear(runId);
    }, catcherMidpointMs);
    successBearSequenceTimer = window.setTimeout(() => {
      if (runId !== successBearRunId) {
        return;
      }
      successBearSequenceTimer = null;
      startSuccessBearWaveLoop();
    }, catcherDurationMs + 16);
  }

  function startSuccessBearSequence(targetCenterX) {
    ensureSuccessBear();
    if (!successBearEl || !successBearAnimator) {
      queueSuccessfulRoundResolution();
      return;
    }

    successBearRunId += 1;
    const runId = successBearRunId;
    clearSuccessBearTimers();
    successBearState = "jumping";

    const baseTopPx = getSuccessBearBaseTopPx();
    const baseCenterY = baseTopPx + successBearFrameSize * successBearScale * 0.5;
    const jumpArcPx = getSuccessBearJumpArcPx();
    const startCenterX = -successBearFrameSize * successBearScale * 0.5;
    const targetCenter = targetCenterX;

    successBearEl.style.opacity = "1";
    successBearAnimator.stop();
    successBearAnimator.setDescriptor(successBearCatcherDescriptor);
    successBearAnimator.setFrame(successBearJumpFrame);
    successBearFacing = 1;
    successBearCenterX = startCenterX;
    successBearCenterY = baseCenterY;
    applySuccessBearTransform();
    resetCaughtGiftVisuals();

    let startTimestamp = null;

    function animateJump(timestamp) {
      if (runId !== successBearRunId) {
        return;
      }
      if (startTimestamp == null) {
        startTimestamp = timestamp;
      }

      const elapsed = Math.min(timestamp - startTimestamp, successBearJumpDurationMs);
      const progress = successBearJumpDurationMs > 0 ? elapsed / successBearJumpDurationMs : 1;
      const horizontalCenter = startCenterX + (targetCenter - startCenterX) * progress;
      const jumpProgress = Math.min(progress * successBearJumpCount, successBearJumpCount);
      const phaseWithinJump = jumpProgress - Math.floor(jumpProgress);
      const verticalOffset = Math.sin(phaseWithinJump * Math.PI) * jumpArcPx;

      successBearCenterX = horizontalCenter;
      successBearCenterY = baseCenterY - verticalOffset;
      applySuccessBearTransform();
      successBearAnimator.setFrame(successBearJumpFrame);

      if (elapsed >= successBearJumpDurationMs) {
        successBearAnimationId = null;
        successBearCenterX = targetCenter;
        successBearCenterY = baseCenterY;
        applySuccessBearTransform();
        startSuccessBearCatcherOnce(runId);
        return;
      }

      successBearAnimationId = window.requestAnimationFrame(animateJump);
    }

    successBearAnimationId = window.requestAnimationFrame(animateJump);
  }

  function playSuccessBearExitAndReturnClaw() {
    if (successBearState === "hidden" || !successBearEl || successBearEl.style.opacity === "0") {
      moveClawToHome();
      return Promise.resolve();
    }

    if (successBearExitPromise) {
      return successBearExitPromise;
    }

    successBearRunId += 1;
    const runId = successBearRunId;
    clearSuccessBearTimers();
    moveClawToHome();
    successBearState = "exiting";
    successBearFacing = -1;
    if (successBearAnimator) {
      successBearAnimator.stop();
      successBearAnimator.setDescriptor(successBearCatcherDescriptor);
      successBearAnimator.setFrame(successBearJumpFrame);
    }

    const startCenterX = successBearCenterX;
    const startCenterY = successBearCenterY;
    const targetCenterX =
      -((successBearFrameSize * successBearScale) / 2) - successBearExitOffscreenPaddingPx;
    const exitArcPx = getSuccessBearExitArcPx();
    let startTimestamp = null;

    successBearExitPromise = new Promise((resolve) => {
      successBearExitResolve = resolve;
    });

    function animateExit(timestamp) {
      if (runId !== successBearRunId) {
        return;
      }
      if (startTimestamp == null) {
        startTimestamp = timestamp;
      }

      const elapsed = Math.min(timestamp - startTimestamp, successBearExitDurationMs);
      const progress = successBearExitDurationMs > 0 ? elapsed / successBearExitDurationMs : 1;
      const horizontalCenter = startCenterX + (targetCenterX - startCenterX) * progress;
      const jumpProgress = Math.min(progress * successBearExitJumpCount, successBearExitJumpCount);
      const phaseWithinJump = jumpProgress - Math.floor(jumpProgress);
      const verticalOffset = Math.sin(phaseWithinJump * Math.PI) * exitArcPx;

      successBearCenterX = horizontalCenter;
      successBearCenterY = startCenterY - verticalOffset;
      applySuccessBearTransform();

      if (elapsed >= successBearExitDurationMs) {
        successBearAnimationId = null;
        hideSuccessBear();
        return;
      }

      successBearAnimationId = window.requestAnimationFrame(animateExit);
    }

    successBearAnimationId = window.requestAnimationFrame(animateExit);
    return successBearExitPromise;
  }

  window.resetClawSuccessBear = hideSuccessBear;
  window.playClawSuccessBearExit = playSuccessBearExitAndReturnClaw;



  // Horizontal movement state (pixels relative to viewport centre).
  let targetRootX = 0;
  let currentRootX = 0;
  let rootVelX = 0;

    // Conceptual number-line position for the claw.
  const clawHomeValue = -2;
  let clawCurrentValue = clawHomeValue;

  function getStripedZoneCenterRootX() {
    // The striped section spans 5vw from the track's left edge (7.5vw).
    // Its center is therefore at 10vw from the viewport left.
    const stripedCenterX = window.innerWidth * 0.1;
    const viewportCenterX = window.innerWidth / 2;
    return stripedCenterX - viewportCenterX;
  }

  function getClawHomeRootX() {
    return getStripedZoneCenterRootX();
  }

  // Initialise the claw so it starts at its home position aligned to the bear.
  const initialHomeX = getClawHomeRootX();
  currentRootX = initialHomeX;
  targetRootX = initialHomeX;



  // Single pendulum state: swing angle around the steel bar and its
  // angular velocity.
  let swingAngle = 0;
  let swingVel = 0;

  // Swing angle limit: ±10° from vertical.
  const maxSwingAngle = Math.PI / 18; // 10 degrees

  // Eased horizontal movement state for the claw when it is instructed to move.
  let isMoving = false;
  let moveStartX = 0;
  let moveEndX = 0;
  let moveStartTime = 0;
  let moveDuration = 0;

  // Fixed timing for each clamp phase.
  const horizontalMoveToTargetDuration = 1.5;
  const horizontalMoveToHomeDuration = 1.0;
  const horizontalMaxSpeedForSwing = 500;


  let lastAnimTime = null;

    // Vertical debug-motion state for "Down" button.
  let verticalPhase = "idle"; // "idle" | "down" | "close" | "up"
  let verticalStartTime = 0;
  
  let verticalMaxOffset = 0; // pixels the claw can travel down from the bar (updated dynamically)
  const verticalDownDuration = 1.5; // seconds to move fully down
  const verticalCloseDuration = 3.0; // seconds to play the claw-close spritesheet
  const verticalUpDuration = 1.0; // seconds to move back up
  let pendingDropAfterMove = false;


  let currentOffsetY = 0;
  let rodLineEl = null;
  let roundOutcomePending = false;

  function getClawTrackCenterY() {
    const barEl = document.getElementById("clawBar");
    if (!barEl) {
      return null;
    }
    const barRect = barEl.getBoundingClientRect();
    return barRect.top + barRect.height / 2;
  }



    function getRootXForNumberLineValue(rawValue) {
    const svg = document.getElementById("numberLineSVG");
    if (!svg) {
      return null;
    }

    const rect = svg.getBoundingClientRect();
    const maxScale = getNumberLineScaleFromGameState();
    const maxValue = maxScale && maxScale > 0 ? maxScale : 10;

    const startX = 50;
    const endX = 4950;
    const totalWidth = endX - startX;

    const v = typeof rawValue === "number" ? rawValue : 0;
    const xSvg = startX + (v / maxValue) * totalWidth;

    const viewBoxWidth = 5000;
    const ratioX = xSvg / viewBoxWidth;
    const desiredScreenX = rect.left + ratioX * rect.width;

    const viewportCenterX = window.innerWidth / 2;
    const deltaScreenX = desiredScreenX - viewportCenterX;

    return deltaScreenX;
  }

    function controlClawPosition(value) {
    const maxScale = getNumberLineScaleFromGameState();
    const maxValue = maxScale && maxScale > 0 ? maxScale : 10;

    let v = typeof value === "number" ? value : 0;
    if (v < 0) v = 0;
    if (v > maxValue) v = maxValue;

    const newTarget = getRootXForNumberLineValue(v);
    if (newTarget == null) {
      return;
    }

    hideSuccessBear();

    const distance = Math.abs(newTarget - currentRootX);
    targetRootX = newTarget;
    clawCurrentValue = v;

    if (distance < 0.001) {
      // No meaningful move required.
      isMoving = false;
      moveDuration = 0;
      moveStartX = currentRootX;
      moveEndX = currentRootX;
      rootVelX = 0;
      return;
    }

    moveStartX = currentRootX;
    moveEndX = newTarget;
    moveStartTime = performance.now();

    moveDuration = horizontalMoveToTargetDuration;
    isMoving = true;

    // Start the full-cycle gear sound (right 1.5s + down 1.5s + hold 0.5s + up 1s + left 1s = 5.5s).
    if (typeof window.playRunningGearSegment === "function") {
      window.playRunningGearSegment();
    }
  }

        function moveClawToHome() {
    // Home position: centre of the claw aligned with the bear's right edge.
    const homeX = getClawHomeRootX();

    const distance = Math.abs(homeX - currentRootX);
    targetRootX = homeX;
    clawCurrentValue = clawHomeValue;

    if (distance < 0.001) {
      isMoving = false;
      moveDuration = 0;
      moveStartX = currentRootX;
      moveEndX = currentRootX;
      rootVelX = 0;
      return;
    }

    moveStartX = currentRootX;
    moveEndX = homeX;
    moveStartTime = performance.now();

    moveDuration = horizontalMoveToHomeDuration;
    isMoving = true;
  }


  window.controlClawPosition = controlClawPosition;
                function startClawDropCycle() {
      // Compute a vertical offset that aligns the claw so that its top
      // stops 50px above the gift box's top edge.
      const trackCenterY = getClawTrackCenterY();
      if (trackCenterY != null) {
        const giftEl = document.querySelector(".gift-box img") || document.querySelector(".gift-box");

        if (giftEl) {
          const giftRect = giftEl.getBoundingClientRect();
          const giftTopY = giftRect.top;
          // Clamp maximum downward travel so the claw's top is always
          // 50px above the gift box's top coordinate.
          verticalMaxOffset = Math.max(0, giftTopY - trackCenterY - giftRect.height);
        } else {
          // Fallback: use the original target height when no gift is found.
          const targetGiftY = window.innerHeight * 0.675;
          verticalMaxOffset = Math.max(0, targetGiftY - trackCenterY);
        }
      } else {
        verticalMaxOffset = Math.max(0, window.innerHeight * 0.68);
      }




      // Count every full drop cycle (down/hold/up) as an attempt, regardless
      // of whether the claw successfully catches the gift.
      if (window.gameCookie && typeof window.gameCookie.recordDropAttempt === "function") {
        window.gameCookie.recordDropAttempt();
      }


      clawSpriteAnimationActive = false;
      clawSpriteAnimationCompleted = false;
      clawSpriteFrameIndex = 0;
      showClawOpenVisual();

      // Determine if the current claw position is close enough to the gift
      // (within ±clampTolerance on the number line) to allow catching,
      // and whether a failed attempt should be treated as a "near miss".
            pendingCatchGift = false;
      hasCaughtGift = false;
      caughtGiftEl = null;
      lastAttemptNearMiss = false;
      lastAttemptDiff = null;
      shouldFollowClawDuringClose = false;
      shouldRotateClawDuringClose = false;
      clawCloseRotationDirection = 0;

            if (
        activeGiftBox &&
        typeof activeGiftValue === "number" &&
        typeof clawCurrentValue === "number"
      ) {
        const tolerance =
          typeof gameState.clampTolerance === "number" &&
          gameState.clampTolerance > 0
            ? gameState.clampTolerance
            : 1;
        const diff = Math.abs(activeGiftValue - clawCurrentValue);
        if (diff <= tolerance) {
          // Will be a success if the claw catches the gift.
          pendingCatchGift = true;
          lastAttemptNearMiss = false;
          lastAttemptDiff = null;
        } else {
          // Missed; store difference and mark as "near miss" if within ±3 on the number line.
          pendingCatchGift = false;
          lastAttemptDiff = diff;
          lastAttemptNearMiss = diff <= 3;
        }

        const absDiff = Math.abs(activeGiftValue - clawCurrentValue);
        shouldFollowClawDuringClose = absDiff <= 1;
        shouldRotateClawDuringClose = absDiff > 0 && absDiff <= 1;
        clawCloseRotationDirection =
          shouldRotateClawDuringClose && activeGiftValue < clawCurrentValue
            ? 1
            : shouldRotateClawDuringClose
              ? -1
              : 0;

        // Record this attempt for the SEN estimation profile (local + historical).
        const { rangeMin, rangeMax } = getCurrentRangeAndTolerance();
        saveAttemptToHistory(activeGiftValue, clawCurrentValue, rangeMin, rangeMax);
      } else {
        lastAttemptNearMiss = false;
        lastAttemptDiff = null;
      }



            verticalPhase = "down";
      verticalStartTime = performance.now();
      // Mark that a round outcome should be resolved once the claw
      // has completed its down/hold/up motion and returned home.
      if (giftPanelState && giftPanelState.phase === "moving") {
        roundOutcomePending = true;
      }

  }


        function debugClawDown() {
    if (verticalPhase === "idle") {
      if (isMoving) {
        pendingDropAfterMove = true;
        return;
      }

      startClawDropCycle();
    }
  }



  window.debugClawDown = debugClawDown;

    function handleRoundOutcome() {
      if (hasCaughtGift && caughtGiftEl) {
        // Correct estimation / successful catch: clear current round log so
        // future MC questions only analyse fresh misses.
        resetCurrentRoundGuesses();
        animateQuestionProgressIncrement();

        if (typeof showGiftSuccessMessage === "function") {
          showGiftSuccessMessage();
        }


        // Use the cookie/run-state module to advance multi-level progress
        // and decide whether this is a middle-level success or the final
        // overall victory.
        let isFinalLevel = false;
        let completedLevelIndex = 1;
        let totalLevels = 5;
        let totalAttempts = null;

        if (window.gameCookie) {
          const api = window.gameCookie;

          if (typeof api.handleLevelCompleted === "function") {
            api.handleLevelCompleted();
          }

          const state = typeof api.getRunState === "function" ? api.getRunState() : null;
          if (state) {
            completedLevelIndex = typeof state.levelsCompleted === "number" && state.levelsCompleted > 0
              ? state.levelsCompleted
              : (typeof state.currentLevelIndex === "number" ? state.currentLevelIndex : 1);
            totalLevels = typeof api.LEVELS_PER_RUN === "number" ? api.LEVELS_PER_RUN : 5;
            isFinalLevel = state.status === "complete" || completedLevelIndex >= totalLevels;
          }

          if (typeof api.getTotalDropAttemptsForRun === "function") {
            totalAttempts = api.getTotalDropAttemptsForRun();
          }
        }

        if (isFinalLevel) {
          // Final victory for the whole run
          if (typeof window.playTotalVictory === "function") {
            window.playTotalVictory();
          }
          setTimeout(() => {
            showVictoryModal(true, completedLevelIndex, totalLevels, totalAttempts);
          }, 2600);
        } else {
          // Middle-level success (not yet the last gift)
          if (typeof window.playMiddleLevelSuccessSfx === "function") {
            window.playMiddleLevelSuccessSfx();
          }
          setTimeout(() => {
            void advanceToNextLevelWithoutOverlay();
          }, 2600);
        }
      } else {
        if (typeof showGiftErrorMessage === "function") {
          showGiftErrorMessage();
        }
        handleWrongAttemptForHints();
      }

    }


  function animateClaw() {
    const now = performance.now();
    const dt = lastAnimTime ? (now - lastAnimTime) / 1000 : 0;
    lastAnimTime = now;

    const prevRootX = currentRootX;

    if (isMoving && moveDuration > 0 && dt > 0) {
      const elapsedSeconds = (now - moveStartTime) / 1000;
      const tNorm = Math.max(0, Math.min(elapsedSeconds / moveDuration, 1));

      // Ease-in-out (quadratic) for smoother start/stop.
      const eased =
        tNorm < 0.5
          ? 2 * tNorm * tNorm
          : -1 + (4 - 2 * tNorm) * tNorm;

      currentRootX = moveStartX + (moveEndX - moveStartX) * eased;

      if (tNorm >= 1) {
        currentRootX = moveEndX;
        isMoving = false;
        moveDuration = 0;
      }
    }

    if (dt > 0) {
      rootVelX = (currentRootX - prevRootX) / dt;

      // Impose a maximum horizontal speed to keep motion controlled.
      const maxSpeed = horizontalMaxSpeedForSwing;
      if (rootVelX > maxSpeed) rootVelX = maxSpeed;
      else if (rootVelX < -maxSpeed) rootVelX = -maxSpeed;
    }

    if (dt > 0 && (leftCog || rightCog)) {
      let cogDirection = 0;
      if (rootVelX > cogVelocityThreshold) {
        cogDirection = 1;
      } else if (rootVelX < -cogVelocityThreshold) {
        cogDirection = -1;
      }

      if (cogDirection !== 0) {
        cogAngleDeg += cogDirection * cogSpinDegPerSecond * dt;
      }

      if (leftCog) {
        leftCog.style.transform = `rotate(${cogAngleDeg}deg)`;
      }
      if (rightCog) {
        rightCog.style.transform = `rotate(${cogAngleDeg}deg)`;
      }
    }

    if (pendingDropAfterMove && verticalPhase === "idle" && !isMoving) {
      pendingDropAfterMove = false;
      startClawDropCycle();
    }

    const horizontalVel = rootVelX;

    // Single pendulum dynamics: damped spring driven by horizontal velocity.
    const kSwing = 2.5;
    const cSwing = 1.8;
    const couplingSwing = 0.04;

    swingVel +=
      (-kSwing * swingAngle -
        cSwing * swingVel +
        couplingSwing * horizontalVel) * dt;

    swingAngle += swingVel * dt;

    // Enforce swing angle limit (±10° from vertical).
    if (swingAngle > maxSwingAngle) {
      swingAngle = maxSwingAngle;
      if (swingVel > 0) swingVel = -swingVel * 0.4;
    } else if (swingAngle < -maxSwingAngle) {
      swingAngle = -maxSwingAngle;
      if (swingVel < 0) swingVel = -swingVel * 0.4;
    }

        const t = now * 0.001;

    // Update vertical offset based on current debug phase.
        if (verticalPhase === "down") {
      const elapsedDown = (now - verticalStartTime) / 1000;
      const normDown = Math.max(
        0,
        Math.min(elapsedDown / verticalDownDuration, 1)
      );
      currentOffsetY = verticalMaxOffset * normDown;
      if (normDown >= 1) {
        currentOffsetY = verticalMaxOffset;
        verticalPhase = "close";
        verticalStartTime = now;
        startClawCloseSpritesheet();

        // At the lowest point, attach the gift if we decided it was
        // close enough horizontally.
        if (pendingCatchGift && activeGiftBox) {
          hasCaughtGift = true;
          caughtGiftEl = activeGiftBox;
          // Do not stick the key to the claw immediately. During the
          // full close phase, allow the key to move toward the claw.
          startClawFollowAnimation();
        }
      }
                                } else if (verticalPhase === "close") {
      const elapsedClose = (now - verticalStartTime) / 1000;
      currentOffsetY = verticalMaxOffset;
      if (elapsedClose >= verticalCloseDuration) {
        verticalPhase = "up";
        verticalStartTime = now;

        if (typeof window.playClawAttemptSuccess === "function" && hasCaughtGift) {
          window.playClawAttemptSuccess();
                } else if (!hasCaughtGift) {
          // Failed attempt: play mechanical fail, then human fail voice
          // chosen based on how close the guess was (±3 => hopeful fail).
          if (typeof window.playClawAttemptFail === "function") {
            window.playClawAttemptFail();
          }
          if (typeof window.playHumanInputError === "function") {
            window.playHumanInputError(lastAttemptDiff);
          }
        }


      }


        } else if (verticalPhase === "up") {

      const elapsedUp = (now - verticalStartTime) / 1000;
      const normUp = Math.max(
        0,
        Math.min(elapsedUp / verticalUpDuration, 1)
      );
      currentOffsetY = verticalMaxOffset * (1 - normUp);
      if (normUp >= 1) {
        currentOffsetY = 0;
        verticalPhase = "idle";
        if (hasCaughtGift) {
          const keyRect = caughtGiftEl ? caughtGiftEl.getBoundingClientRect() : null;
          const keyCenterX = keyRect ? keyRect.left + keyRect.width / 2 : window.innerWidth * 0.5;

          currentRootX = currentRootX;
          targetRootX = currentRootX;
          moveStartX = currentRootX;
          moveEndX = currentRootX;
          moveDuration = 0;
          isMoving = false;
          rootVelX = 0;

          startSuccessBearSequence(keyCenterX);
        } else {
          // After finishing the upward motion, always return the claw
          // horizontally to its home (-2) position.
          moveClawToHome();
        }
      }
    } else {
      currentOffsetY = 0;
    }

        // When a full down/hold/up cycle has finished and the claw has
    // returned horizontally to its home (-2) position, resolve the round
    // outcome once per attempt.
    if (
      verticalPhase === "idle" &&
      roundOutcomePending &&
      !isMoving &&
      successBearState !== "jumping" &&
      successBearState !== "catcher"
    ) {
      roundOutcomePending = false;
      handleRoundOutcome();
    }



                // Switch claw image between open/closed based on vertical motion.
    // The closing phase uses the spritesheet for a 2-second visual close.
    if (clawSpriteAnimationActive) {
      updateClawCloseSpritesheet(now);
    } else if (clawSpriteAnimationCompleted || hasCaughtGift || verticalPhase === "close" || verticalPhase === "up") {
      showClawClosedVisual();
    } else {
      showClawOpenVisual();
    }



    const clawRotationRad =
      swingAngle +
      (verticalPhase === "close" && shouldRotateClawDuringClose
        ? clawCloseRotationDirection * (Math.PI / 12)
        : 0);

    // Minimal visual fix: slightly reduce scale while rotating so the
    // claw edges do not get clipped by frame bounds.
    const clawVisualScale = Math.abs(clawRotationRad) > 0.001 ? 0.96 : 1;

    // Apply transform including vertical offset.
    img.style.transform =
      `translateX(-50%) ` +
      `translateX(${currentRootX}px) ` +
      `translateY(${currentOffsetY}px) ` +
      `rotate(${clawRotationRad}rad) ` +
      `scale(${clawVisualScale})`;

    // Update or create the vertical rod line that connects the steel bar

    // to the top of the claw image while it is hanging below the bar.
    if (!rodLineEl) {
      rodLineEl = document.createElement("div");
      rodLineEl.id = "clawRodLine";
      rodLineEl.style.position = "fixed";
      rodLineEl.style.left = "50%";
      rodLineEl.style.transform = "translateX(-50%)";
      rodLineEl.style.width = "0.8vw";
      rodLineEl.style.pointerEvents = "none";
      rodLineEl.style.zIndex = "1150";
      rodLineEl.style.background =
        "linear-gradient(to bottom, #000000 0%, #222222 40%, #111111 100%)";
      rodLineEl.style.boxShadow =
        "0 0.3vh 0.8vh rgba(0, 0, 0, 0.9), " +
        "0 -0.1vh 0.4vh rgba(255, 255, 255, 0.18), " +
        "inset 0 0.1vh 0.2vh rgba(255, 255, 255, 0.2), " +
        "inset 0 -0.1vh 0.2vh rgba(0, 0, 0, 0.7)";
      document.body.appendChild(rodLineEl);
    }

        const trackCenterY = getClawTrackCenterY();
    if (trackCenterY != null && rodLineEl) {
      const imgRect = img.getBoundingClientRect();
      const imgTopY = imgRect.top;

      const baseRodLength = Math.max(0, imgTopY - trackCenterY);
      const isClampRotated = Math.abs(clawRotationRad) > 0.001;
      const rodLength = baseRodLength * (isClampRotated ? 1.1 : 1);
      if (rodLength > 0.5) {
        const pivotX = window.innerWidth / 2 + currentRootX;
        rodLineEl.style.left = `${pivotX}px`;
        rodLineEl.style.transform = "translate(-50%, 0)";
        rodLineEl.style.top = `${trackCenterY}px`;
        rodLineEl.style.height = `${rodLength}px`;
        rodLineEl.style.display = "block";
      } else {
        rodLineEl.style.height = "0px";
        rodLineEl.style.display = "none";
      }
    }

    // If a gift has been caught, keep the close-phase key motion separate
    // from the claw-attachment phase:
    // - During "close": keep the key fixed for the ±1 case, otherwise shift it toward the claw.
    // - After "close": key attaches to claw and rides upward.
        if (hasCaughtGift && caughtGiftEl) {
      if (verticalPhase === "close") {
        if (shouldFollowClawDuringClose) {
          clawFollowAnimationActive = false;
        } else {
          if (!clawFollowAnimationActive) {
            startClawFollowAnimation();
          }
          const elapsed = Math.min(performance.now() - clawFollowAnimationStart, clawCloseAnimationDurationMs);
          const progress = clawCloseAnimationDurationMs > 0 ? elapsed / clawCloseAnimationDurationMs : 1;
          const currentCenterX = clawFollowAnimationStartX + (clawFollowAnimationTargetX - clawFollowAnimationStartX) * progress;
          const currentCenterY = clawFollowAnimationStartY + (clawFollowAnimationTargetY - clawFollowAnimationStartY) * progress;

          caughtGiftEl.style.left = `${currentCenterX}px`;
          caughtGiftEl.style.top = `${currentCenterY}px`;

          if (elapsed >= clawCloseAnimationDurationMs) {
            clawFollowAnimationActive = false;
            caughtGiftEl.style.left = `${clawFollowAnimationTargetX}px`;
            caughtGiftEl.style.top = `${clawFollowAnimationTargetY}px`;
          }
        }
      } else {
        const imgRect = img.getBoundingClientRect();
        const imgCenterX = imgRect.left + imgRect.width / 2;
        const imgBottomY = imgRect.bottom;

        // Keep the gift centered exactly at the bottom center
        // of the claw while it travels back up.
        const giftCenterY = imgBottomY;

        caughtGiftEl.style.left = `${imgCenterX}px`;
        caughtGiftEl.style.top = `${giftCenterY}px`;
      }
    }



    requestAnimationFrame(animateClaw);
  }



  // Keep the horizontal mapping responsive when the viewport resizes.
  window.addEventListener("resize", () => {
    // No immediate re-layout needed; future controlClawPosition calls
    // will read the updated viewport and SVG geometry.
  });

  animateClaw();
}


if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initClawMachinePNG);
} else {
  initClawMachinePNG();
}





function resizeCanvas() {

  if (!canvas) return;
  // Full-screen canvas to match CSS (100% width and height)
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener("resize", () => {
  resizeCanvas();
  initCrates();
  if (typeof sunshineEffect !== "undefined" && sunshineEffect) {
    sunshineEffect.handleResize();
  }
  // Keep the gift panel triangle aligned when the viewport changes.
  updateGiftPanelTriangle();
  setProgressTokenToCircle(Math.min(questionProgressStep, questionProgressCircles.length - 1), false);
});

function wipeTransientRunProgress() {
  if (
    window.gameCookie &&
    typeof window.gameCookie.clearAttemptCookie === "function"
  ) {
    window.gameCookie.clearAttemptCookie();
  }
}

window.addEventListener("beforeunload", wipeTransientRunProgress);
window.addEventListener("pagehide", wipeTransientRunProgress);




// Image assets
const images = {
  fieldBg: new Image(),
  crate: new Image(),
};

// Use provided assets
images.fieldBg.src = "./ug_orange_wider.png";





const layers = {

  deepBackground: {
    image: images.fieldBg,
    blur: 0, // subtle depth-of-field on far background
  },
};


const crateConfig = {
  count: 5,
  scale: 0.2,
  minXRatio: 0.55,
  maxXRatio: 0.95,
  minYRatio: 0.2,
  maxYRatio: 0.75,
  minGap: 5,
};


let crates = [];


// ======================= Animation Manager =======================

// All visual effect animations live here, rendered on top of the scene.
const animations = [];





// Track timing so we can move things in pixels/second
let lastFrameTime = 0;

/**
 * Triggered when a number is correctly placed.
 *
 * @param {number} x - Canvas X coordinate (relative to gameCanvas)
 * @param {number} y - Canvas Y coordinate (relative to gameCanvas)
 * @param {number} number - The numeric value placed
 */
function playSuccessEffect(x, y, number, restOffset, checkX, checkY) {
  // Success effect removed (no game scoring)
}





/**
 * Update and draw all active animations.
 * Must be called from gameLoop AFTER all other rendering.
 *
 * @param {number} timeMs - current timestamp from requestAnimationFrame
 * @param {number} dtSeconds - delta time in seconds since last frame
 */
function updateAndDrawAnimations(timeMs, dtSeconds) {
  if (!ctx) return;



  for (let i = animations.length - 1; i >= 0; i--) {
    const anim = animations[i];


  }
}





function initCrates() {
  // Crates / numbered clouds removed
}



function drawCrates() {
  // Crates removed
}


// Arrow path connecting stump centres (canvas coordinates)
let stumpCenters = [];

function updateNumberTilePositions() {

  if (!crates.length) return;

  const tiles = document.querySelectorAll('.num[data-role="pool"]');
  if (!tiles.length) return;

  tiles.forEach((tile, index) => {
    // Lock each tile to its original "home" crate index the first time we
    // lay it out, so its home position never changes after initialisation.
    let crateIndex;
    if (tile.dataset.homeCrateIndex != null) {
      crateIndex = parseInt(tile.dataset.homeCrateIndex, 10);
      if (Number.isNaN(crateIndex)) {
        crateIndex = index % crates.length;
        tile.dataset.homeCrateIndex = String(crateIndex);
      }
    } else {
      crateIndex = index % crates.length;
      tile.dataset.homeCrateIndex = String(crateIndex);
    }

    const crate = crates[crateIndex];
    if (!crate) return;

        // Treat each crate's logical point as the centre of the numbered tile cloud.
    // Ensure tiles sit above other overlays and remain draggable.
    tile.style.position = tile.style.position || "absolute";
    tile.style.zIndex = tile.style.zIndex || "500";

    // With base .num transform set to translate(-50%, -100%), the inline
    // left/top represent the visual centre (X) and bottom (Y). We anchor
    // the tile's centre on the crate centre.
    const centerX = crate.cx;
    const centerY = crate.cy;

    tile.style.left = `${centerX}px`;
    tile.style.top = `${centerY}px`;

  });
}




function drawDeepBackground() {
  if (!ctx || !images.fieldBg.complete) return;
  ctx.save();
  ctx.filter = `blur(${layers.deepBackground.blur}px)`;

  // Lock image to full viewport height and preserve aspect ratio.
  // Any extra width is center-cropped, which avoids horizontal stretching.
  const targetHeight = canvas.height;
  const scale = targetHeight / images.fieldBg.naturalHeight;
  const targetWidth = images.fieldBg.naturalWidth * scale;
  const offsetX = (canvas.width - targetWidth) / 2;

  ctx.drawImage(images.fieldBg, offsetX, 0, targetWidth, targetHeight);
  ctx.restore();
}


// Draw a white arrow connecting the centres of the layout anchors and
// indicating ascending/descending direction.
function drawModeArrow() {
  // Mode arrow on stumps removed
}


// DOM overlay arrow drawn directly on top of the stump images.
const SVG_NS = "http://www.w3.org/2000/svg";
let domModeArrowSvg = null;

// SVG layer for the triangular extension attached to the bottom-right
// corner of the gift control panel.
let giftPanelTriangleSvg = null;
function ensureDomModeArrowSvg() {
  if (domModeArrowSvg) return domModeArrowSvg;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.id = "dom-mode-arrow";
  svg.style.position = "fixed";
  svg.style.left = "0";
  svg.style.top = "0";
  svg.style.width = "100%";
  svg.style.height = "100%";
  svg.style.pointerEvents = "none";
  svg.style.zIndex = "400"; // above stumps/cubes
  document.body.appendChild(svg);
  domModeArrowSvg = svg;
  return svg;
}

function updateDomModeArrow() {
  const stumps = document.querySelectorAll(".slot-stump-image");
  if (!stumps.length || !canvas) return;

  const svg = ensureDomModeArrowSvg();

  // Clear previous arrow
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }

  // Build polyline through stump tops in screen coordinates
  const points = [];
  for (let i = 0; i < stumps.length; i++) {
    const rect = stumps[i].getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height * 0.5; // near top of stump
    points.push(`${x},${y}`);
  }

  if (points.length < 2) return;

  const polyline = document.createElementNS(SVG_NS, "polyline");
  polyline.setAttribute("points", points.join(" "));
  polyline.setAttribute("fill", "none");
  polyline.setAttribute("stroke", "#ffffff");
  polyline.setAttribute("stroke-width", "5");
  polyline.setAttribute("stroke-linecap", "round");
  polyline.setAttribute("stroke-linejoin", "round");
  svg.appendChild(polyline);

  // Arrowhead based on mode
  const mode = gameState.mode || "ascending";
  let headFromIndex;
  let headToIndex;
  if (mode === "ascending") {
    headFromIndex = stumps.length - 2;
    headToIndex = stumps.length - 1;
  } else {
    headFromIndex = 1;
    headToIndex = 0;
  }

  if (
    headFromIndex != null &&
    headToIndex != null &&
    headFromIndex >= 0 &&
    headToIndex >= 0 &&
    headFromIndex < stumps.length &&
    headToIndex < stumps.length
  ) {
    const fromRect = stumps[headFromIndex].getBoundingClientRect();
    const toRect = stumps[headToIndex].getBoundingClientRect();
    const fromX = fromRect.left + fromRect.width / 2;
    const fromY = fromRect.top + fromRect.height * 0.5;
    const toX = toRect.left + toRect.width / 2;
    const toY = toRect.top + toRect.height * 0.5;

    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);
    const arrowLen = 24;

    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", toX);
    line.setAttribute("y1", toY);
    line.setAttribute(
      "x2",
      toX - arrowLen * Math.cos(angle - Math.PI / 6)
    );
    line.setAttribute(
      "y2",
      toY - arrowLen * Math.sin(angle - Math.PI / 6)
    );
    line.setAttribute("stroke", "#ffffff");
    line.setAttribute("stroke-width", "5");
    line.setAttribute("stroke-linecap", "round");
    svg.appendChild(line);

    const line2 = document.createElementNS(SVG_NS, "line");
    line2.setAttribute("x1", toX);
    line2.setAttribute("y1", toY);
    line2.setAttribute(
      "x2",
      toX - arrowLen * Math.cos(angle + Math.PI / 6)
    );
    line2.setAttribute(
      "y2",
      toY - arrowLen * Math.sin(angle + Math.PI / 6)
    );
    line2.setAttribute("stroke", "#ffffff");
    line2.setAttribute("stroke-width", "5");
    line2.setAttribute("stroke-linecap", "round");
    svg.appendChild(line2);
  }
}


// Sunshine ray (god-rays / crepuscular rays) effect overlay
class SunshineEffect {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.lightSource = { x: 0, y: 0 };
    this.layers = [];
    this.noiseTime = 0;
    this.lastTimestamp = 0;
    this._initLayers();
    this.handleResize();
  }

  _initLayers() {
    // Multiple ray layers with different speeds to create a 2.5D parallax effect.
    this.layers = [
      {
        radiusScale: 1.2,
        beamCount: 40,
        baseAlpha: 0.18 + 0.16,
        noiseScale: 0.0008,
        speed: 0.00004,
      },
      {
        radiusScale: 1.4,
        beamCount: 30,
        baseAlpha: 0.12 + 0.16,
        noiseScale: 0.0012,
        speed: 0.00007,
      },
      {
        radiusScale: 1.6,
        beamCount: 20,
        baseAlpha: 0.08 + 0.16,
        noiseScale: 0.0016,
        speed: 0.0001,
      },
    ];
  }

  handleResize() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    // Off-screen / off-centre light source (80% X, -10% Y of viewport).
    this.lightSource.x = w * 0.8;
    this.lightSource.y = -h * 0.1;
    this.maxRadius = Math.sqrt(w * w + h * h) * 1.2;
  }

  // Smooth pseudo-noise using overlapping sine/cosine waves.
  noise2D(x, y, time) {
    const n1 =
      Math.sin(x * 0.0007 + time * 0.0013) *
      Math.cos(y * 0.0004 + time * 0.0011);
    const n2 =
      Math.sin(x * 0.0003 + time * 0.0009) *
      Math.cos(y * 0.0006 + time * 0.0017);
    return 0.5 + 0.5 * (0.6 * n1 + 0.4 * n2);
  }

  // 1D smooth noise used for global flicker.
  noise1D(t) {
    return 0.5 + 0.5 * Math.sin(t) * Math.cos(t * 0.7);
  }

  render(time) {
    if (!this.ctx) return;

    if (!this.lastTimestamp) {
      this.lastTimestamp = time;
    }
    const dt = time - this.lastTimestamp;
    this.lastTimestamp = time;
    this.noiseTime += dt * 0.0005;

    const ctx = this.ctx;
    ctx.save();
    // Use "screen" blending so rays brighten the existing scene
    // without washing it out.
    ctx.globalCompositeOperation = "screen";

    const flicker = 0.7 + 0.3 * this.noise1D(this.noiseTime * 0.8);

    this.layers.forEach((layer, index) => {
      const radius = this.maxRadius * layer.radiusScale;
      const beamCount = layer.beamCount;
      const baseAlpha = layer.baseAlpha;

      for (let i = 0; i < beamCount; i++) {
        const angle =
          (i / beamCount) * Math.PI +
          this.noiseTime * layer.speed +
          index * 0.12;

        const startX = this.lightSource.x;
        const startY = this.lightSource.y;
        const endX = startX + Math.cos(angle) * radius;
        const endY = startY + Math.sin(angle) * radius;

        // march along the beam in small segments to create
        // volumetric, feathered light patches.
        const segments = 12;
        for (let s = 0; s < segments; s++) {
          const t = s / segments;
          const px = startX + (endX - startX) * t;
          const py = startY + (endY - startY) * t;

          // fade toward the far end of the beam
          const fade = 1 - t;
          const localNoise = this.noise2D(
            px + index * 50,
            py - index * 80,
            this.noiseTime * (1 + index * 0.25)
          );

          const alpha = baseAlpha * fade * localNoise * flicker;
          if (alpha <= 0.001) continue;

          const thickness =
            60 * (1 - t) * (0.5 + localNoise) * (1 + index * 0.2);

          const grad = ctx.createRadialGradient(
            px,
            py,
            0,
            px,
            py,
            thickness
          );
          grad.addColorStop(0, `rgba(142, 90, 35, ${alpha})`);
          grad.addColorStop(1, "rgba(142, 90, 35, 0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          // Elongated elliptical patch oriented along the beam direction.
          ctx.ellipse(
            px,
            py,
            thickness,
            thickness * 0.35,
            angle,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }
    });

    ctx.restore();
  }
}

let sunshineEffect = null;
function initSunshineEffect(canvasElement) {
  if (!canvasElement) return null;
  const effect = new SunshineEffect(canvasElement);
  return effect;
}

function gameLoop(timestamp) {
  if (!ctx || !canvas) return;
  const time = timestamp || performance.now();

  const dt = lastFrameTime ? (time - lastFrameTime) / 1000 : 0;
  lastFrameTime = time;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Layer 1: deep background
  drawDeepBackground();

    // Layer 5: crates placed in the mid-ground (removed visually; crates now act as
  // invisible anchor points for the numbered tile clouds)
  // drawCrates();

  // (Canvas-based mode arrow removed; DOM-based arrow is drawn directly
  // on top of the stump DOM elements via updateDomModeArrow.)

  // Wooden sign video layer (drawn on top of crates, before particles and rays)
  // drawSignVideo();



  // Layer 7: global sunshine rays overlay
  if (sunshineEffect) {
    sunshineEffect.render(time);
  }

  // Layer 8: top-level animations
  updateAndDrawAnimations(time, dt);

  requestAnimationFrame(gameLoop);
}



const requiredAssetKeys = [
  "fieldBg",
];

const loadedAssets = new Set();

// Promise that resolves once all visual assets used by the canvas
// background have finished loading (or errored).
let visualAssetsReadyResolve = null;
const visualAssetsReadyPromise = new Promise((resolve) => {
  visualAssetsReadyResolve = resolve;
});

function onAssetReady(assetKey) {
  if (loadedAssets.has(assetKey)) return;
  loadedAssets.add(assetKey);

    if (loadedAssets.size === requiredAssetKeys.length) {
    initCrates();
    sunshineEffect = initSunshineEffect(canvas);
    requestAnimationFrame(gameLoop);

    if (typeof visualAssetsReadyResolve === "function") {
      visualAssetsReadyResolve();
    }
  }
}



function registerAssetLoad(assetKey) {
  const img = images[assetKey];
  if (!img) {
    onAssetReady(assetKey);
    return;
  }

  // Handle cached images that may have finished loading before listener registration.
  if (img.complete && img.naturalWidth > 0) {
    onAssetReady(assetKey);
    return;
  }

  img.addEventListener("load", () => onAssetReady(assetKey), { once: true });
  img.addEventListener("error", () => onAssetReady(assetKey), { once: true });
}

requiredAssetKeys.forEach(registerAssetLoad);



function updateStumpsLayout() {
  if (!canvas) return;

  const stumps = document.querySelectorAll(".slot-stump-image");
  const cubes = document.querySelectorAll(".slot-cube");
  if (!stumps.length || stumps.length !== cubes.length) return;

    const N = stumps.length;

  // Reset stump centres and rebuild them from current layout
  stumpCenters = [];

  for (let i = 0; i < N; i++) {

    //const targetBottom = canvas.height * (0.875 + Math.sqrt(i) * 0.06); // 5% from bottom of viewport
    const targetBottom = canvas.height * 0.95;
    const stump = stumps[i];
    const cube = cubes[i];

    // Reset transforms to a neutral state before measuring.
    stump.style.transformOrigin = "50% 100%";
    stump.style.transform = "translate(-50%, 0) scale(1)";
    cube.style.transformOrigin = "50% 50%";
    cube.style.transform = "translate(0px, 0px) scale(1)";

    const stumpRect = stump.getBoundingClientRect();

    // Evenly distribute stump centers across viewport width

            const targetCenterX =
              ((i + 0.5) / N) * canvas.width * 0.85 + canvas.width * 0.12;
    const currentCenterX = stumpRect.left + stumpRect.width / 2;
    const deltaStumpX = targetCenterX - currentCenterX;

    // Align stump bottom at 5% from bottom of viewport
    const currentBottom = stumpRect.bottom;
    const deltaStumpY = targetBottom - currentBottom;

    // Apply stump transform: base center + translations
    stump.style.transform = `translate(-50%, 0) translate(${deltaStumpX}px, ${deltaStumpY}px) scale(3)`;

    // --- MATHEMATICAL PREDICTION (No second layout read!) ---
    const scaledStumpHeight = stumpRect.height * 3;
    
    // Since scale anchor is bottom-center, target bottom dictates the new top position
    const stumpTopCenterX = targetCenterX;
    const stumpTopCenterY = targetBottom - scaledStumpHeight;

        // Record stump centre in canvas coordinates for the mode arrow.
    // Convert from page coords (client) to canvas coords.
    const canvasRect = canvas.getBoundingClientRect();

    // Lift the arrow slightly above the visual top of each stump so
    // the white path appears clearly above the stumps instead of
    // intersecting their tops.
    const arrowYOffset = scaledStumpHeight * 0.15; // 15% of stump height

    stumpCenters.push({
      // Extend arrow 5% longer at tail and head by mapping the logical
      // stump center into an expanded parametric 0.05–0.95 domain.
      x:
        canvas.width * 0.05 +
        (stumpTopCenterX / canvas.width) * canvas.width * 0.9,
      y: stumpTopCenterY + stumpRect.height / 2,
    });

    // Ensure arrow layer is above stumps by tracking a higher z-like value
    // that drawModeArrow can respect (logical layering only).
    stumpCenters[stumpCenters.length - 1].layer = 1; // stumps are layer 1


    const cubeRect = cube.getBoundingClientRect();

    const cubeBottomCenterX = cubeRect.left + cubeRect.width / 2;
    const cubeBottomCenterY = cubeRect.bottom;

    const deltaCubeX = stumpTopCenterX - cubeBottomCenterX;
    const deltaCubeY = stumpTopCenterY - cubeBottomCenterY;

        // Configure the oval shadow above the cube base
    const wrapper = cube.closest(".slot-wrapper");
    if (wrapper) {
      const shadow = wrapper.querySelector(".slot-shadow");
      if (shadow) {
        const wrapperRect = wrapper.getBoundingClientRect();

                // Shadow center: 10% of stump image height from top, horizontally aligned with stump
        const currentStumpRect = stump.getBoundingClientRect();
        const currentStumpHeight = currentStumpRect.height;
        const shadowCenterX = currentStumpRect.left + currentStumpRect.width / 2;
        const shadowCenterY = currentStumpRect.top + currentStumpHeight * 0.2;


        // Shadow size follows cube size so larger cubes cast larger shadows
        const cubeSide = cubeRect.width; // cube is square
        const majorAxis = cubeSide * 0.7; // longer axis
        const minorAxis = cubeSide * 0.4; // shorter axis

        shadow.style.width = `${majorAxis}px`;
        shadow.style.height = `${minorAxis}px`;

        // Position shadow relative to wrapper using predicted math coordinates
        const left = shadowCenterX - wrapperRect.left - majorAxis / 2;
        const top = shadowCenterY - wrapperRect.top - minorAxis / 2;

        shadow.style.left = `${left}px`;
        shadow.style.top = `${top}px`;
        shadow.style.transform = "none";
        // Darker shadow (75% darker appearance)
        shadow.style.backgroundColor = "rgba(0, 0, 0, 0.75)";
      }
    }


    // Store translation components so progression logic can scale separately
    cube.dataset.tx = String(deltaCubeX);
    cube.dataset.ty = String(deltaCubeY);

    // Initial positioning at base scale
    cube.style.transform = `translate(${deltaCubeX}px, ${deltaCubeY}px) scale(1)`;
  }


        // Update DOM-based mode arrow drawn on top of stumps.
  updateDomModeArrow();
}






// ======================= Sorting Game Logic =======================


// 遊戲狀態
let gameState = {
  numbers: [],
  mode: "ascending",
  difficulty: "easy",
  // Logical playable range for gifts/inputs
  rangeMin: 0,
  rangeMax: 20,
  // Legacy field kept for compatibility; usually equals rangeMax
  maxNumber: 20,
  clampTolerance: 1,
  // Hint-related state
  wrongAttemptsForHints: 0,
  shownHints: {},
  hintRound1Played: false,
  hintRound2Played: false,
  selectedNumbers: [],
  nextIndex: 0,
  draggedValue: null,
  draggedElement: null,
};



function validatePlacement(index, numberValue) {
  let sorted = [...gameState.numbers];
  if (gameState.mode === "ascending") {
    sorted.sort((a, b) => a - b);
  } else {
    sorted.sort((a, b) => b - a);
  }

  const logicalIndex =
    gameState.mode === "ascending"
      ? index
      : sorted.length - 1 - index;

  const expectedValue = sorted[logicalIndex];
  return numberValue === expectedValue;
}

function updateCubeFacesWithValue(slot, value) {
  const cube = slot.closest(".slot-cube");
  if (!cube) return;

  const faces = cube.querySelectorAll(".slot-cube-face");
  faces.forEach((face) => {
    face.textContent = String(value);
    face.style.color = "white";
    face.style.fontWeight = "bold";
    face.style.fontSize = "24px";
  });
}

function updateCubesProgression() {
  if (!slotsBox) return;

  const cubes = document.querySelectorAll(".slot-cube");
  const slots = slotsBox.querySelectorAll(".slot");
  if (!cubes.length || cubes.length !== slots.length) return;

  const N = cubes.length;
  let filledCount = 0;
  const emptyIndices = [];

  for (let i = 0; i < N; i++) {
    const slot = slots[i];
    const isFilled = slot.textContent.trim() !== "";
    if (isFilled) {
      filledCount++;
    } else {
      emptyIndices.push(i);
    }
  }

    let activeIndex = null;
  if (emptyIndices.length > 0) {
    if (gameState.mode === "ascending") {
      // leftmost available empty space
      activeIndex = emptyIndices[0];
    } else {
      // rightmost available empty space
      activeIndex = emptyIndices[emptyIndices.length - 1];
    }
  }

  for (let i = 0; i < N; i++) {
    const cube = cubes[i];
    const slot = slots[i];
    const isFilled = slot.textContent.trim() !== "";

    const tx = parseFloat(cube.dataset.tx || "0");
    const ty = parseFloat(cube.dataset.ty || "0");

    let scale = 1;

    if (isFilled) {
      // Filled: remain at base size and light blue
      scale = 1;
    } else if (activeIndex !== null && i === activeIndex) {
      // Active empty space: scaled up and animated between blue and milk-white
      scale = 2.5;
    } else {
      // Non-active, empty spaces stay small and grey
      scale = 1;
    }


    cube.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;

    const faces = cube.querySelectorAll(".slot-cube-face");
    faces.forEach((face) => {
      face.style.animation = "";
      if (isFilled) {
        // Light blue for filled cubes
        face.style.backgroundColor = "#3b82f6";
      } else if (activeIndex !== null && i === activeIndex) {
        // Animate color between blue and milk-white
        face.style.backgroundColor = "#1d4ed8";
        face.style.animation = "cube-active-color 2s ease-in-out infinite";
      } else {
        // Grey for non-active, empty cubes
        face.style.backgroundColor = "#808080";
      }
    });

        // Shadow on stump when cube is floating (large)
    const wrapper = cube.closest(".slot-wrapper");
    if (wrapper) {
      const shadow = wrapper.querySelector(".slot-shadow");
      const stumpImg = wrapper.querySelector(".slot-stump-image");
      if (shadow && stumpImg) {
        const stumpRect = stumpImg.getBoundingClientRect();
                const stumpHeight = stumpRect.height;
        const stumpCenterX = stumpRect.left + stumpRect.width / 2;

        // Shadow center: 10% of stump image height from top, horizontally aligned with stump
        const shadowCenterX = stumpCenterX;
        const shadowCenterY = stumpRect.top + stumpHeight * 0.2;

        // Shadow size follows cube size so larger cubes cast larger shadows
        const cubeRect = cube.getBoundingClientRect();
        const cubeSide = cubeRect.width; // cube is square and scaled via transform
        const majorAxis = cubeSide * 0.7;
        const minorAxis = cubeSide * 0.4;


        shadow.style.width = `${majorAxis}px`;
        shadow.style.height = `${minorAxis}px`;

        const wrapperRect = wrapper.getBoundingClientRect();
        const left = shadowCenterX - wrapperRect.left - majorAxis / 2;
        const top = shadowCenterY - wrapperRect.top - minorAxis / 2;

        shadow.style.left = `${left}px`;
        shadow.style.top = `${top}px`;
        shadow.style.transform = "none";

        // Darker shadow (75% darker appearance)
        shadow.style.backgroundColor = "rgba(0, 0, 0, 0.75)";
        shadow.style.opacity = scale > 1 ? "0.8" : "0.6";
      }
    }

  }
}





// 外套選項（目前未使用，但保留作擴充用）
const outfits = [];


// DOM 元素
const mainMenu = document.getElementById("mainMenu");
const gameArea = document.getElementById("gameArea");
const difficultySelection = document.getElementById("difficultySelection");
const numbersBox = null;
const slotsBox = null;

const speech = document.getElementById("speech");
const yellowBubbleText = document.getElementById("yellowBubbleText");
const result = document.getElementById("result");
const treasure = document.getElementById("treasure");
const chest = document.getElementById("chest");
const outfitLayer = document.getElementById("outfitLayer");
const victoryModal = document.getElementById("victoryModal");
const orderInfo = document.getElementById("orderInfo");
const difficultyInfo = document.getElementById("difficultyInfo");
const rangeInfo = document.getElementById("rangeInfo");
const precisionInfo = document.getElementById("precisionInfo");
const victoryHeadline = document.getElementById("victoryHeadline");
const victorySubheadline = document.getElementById("victorySubheadline");
const victoryCelebrationArea = document.getElementById("victoryCelebrationArea");
const victoryBearSprite = document.getElementById("victoryBearSprite");
const victoryStarsContainer = document.getElementById("victoryStarsContainer");
const victoryExtraText = document.getElementById("victoryExtraText");
const victoryExtraTextValue = document.getElementById("victoryExtraTextValue");
const questionProgressRoot = document.getElementById("questionProgress");
const questionProgressFill = document.getElementById("questionProgressFill");
const questionProgressCircles = Array.from(
  document.querySelectorAll(".question-progress-circle")
);
const questionProgressToken = document.getElementById("questionProgressToken");
const questionProgressParticleLayer = document.querySelector(
  ".question-progress-fill-particles"
);
const QUESTION_PROGRESS_TOTAL = Math.max(1, questionProgressCircles.length - 1);


// Gift control panel DOM references (assigned lazily in initGiftControlPanel)
// These are kept as vars so the panel can be reconfigured if needed.




let speechTypewriterTimer = null;
let lastSpeechText = "";
let questionProgressStep = 0;
let questionProgressSequence = Promise.resolve();
let questionProgressParticleRefreshTimer = null;
let roundGiftPlan = [];
let roundGiftPlanKey = "";

function waitMs(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function setProgressTokenToCircle(circleIndex, withTransition) {
  if (!questionProgressToken || !questionProgressCircles.length) {
    return;
  }

  const safeIndex = Math.max(0, Math.min(questionProgressCircles.length - 1, circleIndex));
  const targetCircle = questionProgressCircles[safeIndex];
  if (!targetCircle) {
    return;
  }

  const rootRect = questionProgressToken.offsetParent
    ? questionProgressToken.offsetParent.getBoundingClientRect()
    : questionProgressToken.parentElement.getBoundingClientRect();
  const circleRect = targetCircle.getBoundingClientRect();

  questionProgressToken.style.transition = withTransition
    ? "left 0.9s ease-in-out, top 0.9s ease-in-out"
    : "none";
  questionProgressToken.style.left = `${circleRect.left - rootRect.left + circleRect.width / 2}px`;
  questionProgressToken.style.top = `${circleRect.top - rootRect.top + circleRect.height / 2}px`;

  if (!withTransition) {
    // Restore animated transition for future movements.
    void questionProgressToken.offsetHeight;
    questionProgressToken.style.transition = "left 0.9s ease-in-out, top 0.9s ease-in-out";
  }
}

function buildRandomProgressParticles() {
  if (!questionProgressParticleLayer) {
    return;
  }

  questionProgressParticleLayer.innerHTML = "";

  const colors = [
    "rgba(255, 248, 196, 0.95)",
    "rgba(254, 215, 102, 0.88)",
    "rgba(251, 146, 60, 0.82)",
    "rgba(248, 113, 113, 0.86)",
  ];
  const particleCount = 34;

  for (let i = 0; i < particleCount; i += 1) {
    const dot = document.createElement("span");
    dot.className = "question-progress-particle";

    const left = Math.random() * 100;
    const size = 0.26 + Math.random() * 0.56;
    const duration = 1.2 + Math.random() * 2.2;
    const delay = -Math.random() * 2.8;
    const drift = -16 + Math.random() * 32;
    const opacity = 0.55 + Math.random() * 0.4;
    const color = colors[Math.floor(Math.random() * colors.length)];

    dot.style.setProperty("--particle-left", `${left}%`);
    dot.style.setProperty("--particle-size", `${size}vh`);
    dot.style.setProperty("--particle-duration", `${duration}s`);
    dot.style.setProperty("--particle-delay", `${delay}s`);
    dot.style.setProperty("--particle-drift-x", `${drift}px`);
    dot.style.setProperty("--particle-opacity", String(opacity));
    dot.style.setProperty("--particle-color", color);

    questionProgressParticleLayer.appendChild(dot);
  }
}

function initProgressParticles() {
  buildRandomProgressParticles();

  if (questionProgressParticleRefreshTimer != null) {
    window.clearInterval(questionProgressParticleRefreshTimer);
    questionProgressParticleRefreshTimer = null;
  }

  // Re-seed particles periodically so movement stays less patterned.
  questionProgressParticleRefreshTimer = window.setInterval(() => {
    buildRandomProgressParticles();
  }, 2600);
}

function renderQuestionProgress(step) {
  const safeStep = Math.max(0, Math.min(QUESTION_PROGRESS_TOTAL, Number(step) || 0));

  if (questionProgressFill) {
    // Fill remains 10% narrower than the exterior bar.
    questionProgressFill.style.width = `${(safeStep / QUESTION_PROGRESS_TOTAL) * 90}%`;
  }

  questionProgressCircles.forEach((circle, index) => {
    if (!circle) return;

    if (index === 0) {
      circle.classList.add("is-start");
    }

    if (index > 0 && index <= safeStep) {
      circle.classList.add("is-filled");
      return;
    }

    circle.classList.remove("is-filled");
    const fillEl = circle.querySelector(".question-progress-circle-fill");
    if (fillEl) {
      fillEl.style.animation = "none";
      // Allow the same fill animation to replay next time.
      void fillEl.offsetHeight;
      fillEl.style.animation = "";
    }
  });

  setProgressTokenToCircle(Math.min(safeStep, questionProgressCircles.length - 1), false);
}

function resetQuestionProgress() {
  questionProgressStep = 0;
  questionProgressSequence = Promise.resolve();
  initProgressParticles();
  renderQuestionProgress(0);
}

function animateQuestionProgressIncrement() {
  if (!questionProgressFill || !questionProgressCircles.length) {
    return Promise.resolve();
  }

  if (questionProgressStep >= QUESTION_PROGRESS_TOTAL) {
    return questionProgressSequence;
  }

  questionProgressSequence = questionProgressSequence.then(async () => {
    if (questionProgressStep >= QUESTION_PROGRESS_TOTAL) {
      return;
    }

    const nextStep = questionProgressStep + 1;
    const transitionSlowdown = 1.5;

    // Replace the old between-question waiting gap with a centered progress cue.
    if (questionProgressRoot) {
      questionProgressRoot.classList.add("is-centered-transition");
    }
    await waitMs(Math.round(350 * transitionSlowdown));

    if (questionProgressToken) {
      questionProgressToken.style.setProperty("--question-progress-token-scale", "1.5");
    }

    // Fill and token movement happen together.
    questionProgressFill.style.width = `${(nextStep / QUESTION_PROGRESS_TOTAL) * 90}%`;
    const destinationIndex = Math.min(nextStep, questionProgressCircles.length - 1);
    const circle = questionProgressCircles[destinationIndex];
    setProgressTokenToCircle(destinationIndex, true);

    if (circle) {
      const fillEl = circle.querySelector(".question-progress-circle-fill");
      if (fillEl) {
        fillEl.style.animation = "none";
        void fillEl.offsetHeight;
        fillEl.style.animation = "";
      }
      if (destinationIndex > 0) {
        circle.classList.add("is-filled");
      }
    }

    if (typeof window.playVictorySuccessVoice === "function") {
      window.playVictorySuccessVoice();
    }

    await waitMs(Math.round(950 * transitionSlowdown));
    if (questionProgressToken) {
      questionProgressToken.style.setProperty("--question-progress-token-scale", "1");
    }
    await waitMs(Math.round(220 * transitionSlowdown));

    if (questionProgressRoot) {
      if (questionProgressToken) {
        questionProgressToken.classList.add("is-hidden-during-return");
      }
      questionProgressRoot.classList.remove("is-centered-transition");
    }

    await waitMs(Math.round(350 * transitionSlowdown));
    setProgressTokenToCircle(destinationIndex, false);
    if (questionProgressToken) {
      questionProgressToken.classList.remove("is-hidden-during-return");
    }
    questionProgressStep = nextStep;
  });

  return questionProgressSequence;
}


function setSpeech(text) {
  const nextText = typeof text === "string" ? text : String(text ?? "");

  if (speechTypewriterTimer) {
    window.clearInterval(speechTypewriterTimer);
    speechTypewriterTimer = null;
  }

  // Only animate when the speech text changes.
  if (nextText === lastSpeechText) {
    if (speech) speech.textContent = nextText;
    if (yellowBubbleText) yellowBubbleText.textContent = nextText;
    return;
  }

  lastSpeechText = nextText;

  if (speech) speech.textContent = "";
  if (yellowBubbleText) yellowBubbleText.textContent = "";

  let index = 0;
  const stepMs = 24;

  speechTypewriterTimer = window.setInterval(() => {
    index += 1;
    const partial = nextText.slice(0, index);

    if (speech) speech.textContent = partial;
    if (yellowBubbleText) yellowBubbleText.textContent = partial;

    if (index >= nextText.length) {
      window.clearInterval(speechTypewriterTimer);
      speechTypewriterTimer = null;
    }
  }, stepMs);
}

function createConfetti() {
  startVictoryConfettiLoop();
}

function getGiftPanelMaxValue() {
  const max = typeof gameState.rangeMax === "number" && gameState.rangeMax > 0
    ? gameState.rangeMax
    : 20;
  return max;
}


function stopAllGame2Audio() {
  // Prefer project-level audio stop hooks when available.
  const stopFns = [
    window.stopAllAudio,
    window.stopAllGameAudio,
    window.stopAllSfx,
    window.stopAllVoice,
  ];

  stopFns.forEach((fn) => {
    if (typeof fn === "function") {
      try {
        fn();
      } catch (_) {}
    }
  });

  // Fallback: stop all HTMLMediaElement instances currently in the DOM.
  try {
    document.querySelectorAll("audio, video").forEach((media) => {
      try {
        media.pause();
        media.currentTime = 0;
      } catch (_) {}
    });
  } catch (_) {}
}

function initGiftControlPanel() {
  giftControlPanel = document.getElementById("giftControlPanel");
  giftMonitor = document.getElementById("giftMonitor");
  giftMonitorMessage = document.getElementById("giftMonitorMessage");
  giftMonitorInput = document.getElementById("giftMonitorInput");

  giftDigitButtons = Array.from(
    document.querySelectorAll(".gift-key-digit")
  );
  giftResetButton = document.getElementById("giftKeyReset");
  giftMoveButton = document.getElementById("giftKeyMove");
  giftZeroButton = document.getElementById("giftKey0");

  if (!giftControlPanel || !giftMonitor || !giftMonitorMessage || !giftMonitorInput) {
    return;
  }

  // Initialise keyboard labels once and hide all labels so they can be
  // revealed sequentially by the flicker animation.
  if (!giftButtonsInitialised) {
    giftDigitButtons.forEach((btn) => {
      const label = btn.textContent.trim();
      if (label) {
        btn.dataset.label = label;
      }
      const labelSpan = ensureGiftButtonLabelSpan(btn);
      if (labelSpan) {
        labelSpan.classList.add("gift-key-digit-hidden");
      }
    });

    if (giftResetButton) {
      const label = (giftResetButton.textContent || "").trim() || "🔄";
      giftResetButton.dataset.label = label;
      const labelSpan = ensureGiftButtonLabelSpan(giftResetButton);
      if (labelSpan) {
        labelSpan.classList.add("gift-key-digit-hidden");
      }
    }

    if (giftMoveButton) {
      const label = (giftMoveButton.textContent || "").trim() || "✅";
      giftMoveButton.dataset.label = label;
      giftMoveButton.textContent = label;
      const labelSpan = ensureGiftButtonLabelSpan(giftMoveButton);
      if (labelSpan) {
        labelSpan.classList.add("gift-key-digit-hidden");
      }
    }

    giftButtonsInitialised = true;
  }

    giftPanelState.maxValue = getGiftPanelMaxValue();
  giftPanelState.phase = "hidden";
  giftPanelState.inputValue = "";
  giftPanelState.keyboardEnabled = false;

  if (giftControlPanel) {
    giftControlPanel.classList.remove("gift-panel-prompt");
  }


  if (giftZeroButton) {
    giftZeroButton.disabled = false;
  }

        giftDigitButtons.forEach((btn) => {
    const key = btn.dataset.key;
    if (!key) return;
    btn.addEventListener("click", () => {
      if (giftButtonsLocked) {
        return;
      }
      if (typeof window.playPanelButtonClick === "function") {
        window.playPanelButtonClick();
      }
      const digit = parseInt(key, 10);
      if (!Number.isNaN(digit)) {
        handleGiftDigitClick(digit);
      }
    });
  });

  if (giftResetButton) {
    giftResetButton.addEventListener("click", () => {
      if (giftButtonsLocked) {
        return;
      }
      stopAllGame2Audio();
      if (typeof window.playPanelButtonClick === "function") {
        window.playPanelButtonClick();
      }
      handleGiftResetClick();
    });
  }
    if (giftMoveButton) {
    giftMoveButton.addEventListener("click", () => {
      if (giftButtonsLocked) {
        return;
      }
      if (typeof window.playPanelButtonClick === "function") {
        window.playPanelButtonClick();
      }
      handleGiftMoveClick();
    });
  }


  // Draw or update the triangle attached to the bottom-right corner
  // of the gift control panel.
  updateGiftPanelTriangle();
}

function ensureGiftPanelTriangleSvg() {
  if (giftPanelTriangleSvg) return giftPanelTriangleSvg;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.id = "gift-panel-triangle";
  svg.style.position = "fixed";
  svg.style.left = "0";
  svg.style.top = "0";
  svg.style.width = "100%";
  svg.style.height = "100%";
  svg.style.pointerEvents = "none";
  // Slightly above the panel background so the triangle is visible.
  svg.style.zIndex = "1390";
  document.body.appendChild(svg);
  giftPanelTriangleSvg = svg;
  return svg;
}

function updateGiftPanelTriangle() {
  const panel = document.getElementById("giftControlPanel");
  if (!panel) return;

  const rect = panel.getBoundingClientRect();
  const svg = ensureGiftPanelTriangleSvg();

  // Clear any previous triangle.
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }

  // Vertical side along the panel's right wall between 80% and 95% of panel height.
  const xRight = rect.left;
  const yTop = rect.top + rect.height * 0.8;
  const yBottom = rect.top + rect.height * 1;

  // Third vertex at viewport coordinates: x = 45vw, y = 97.5vh.
  const xThird = window.innerWidth * 0.45;
  const yThird = window.innerHeight * 0.925;

  const triangle = document.createElementNS(SVG_NS, "polygon");
  const points = [
    `${xRight},${yTop}`,
    `${xRight},${yBottom}`,
    `${xThird},${yThird}`,
  ].join(" ");
  triangle.setAttribute("points", points);
  triangle.setAttribute("fill", "rgba(255, 255, 255, 0.75)");
  triangle.setAttribute("stroke", "none");

  svg.appendChild(triangle);
}


function setGiftKeyboardEnabled(enabled, hideDigits) {

  giftPanelState.keyboardEnabled = !!enabled;

  if (enabled && typeof window.resetClawToOpenVisual === "function") {
    window.resetClawToOpenVisual();
  }

  giftDigitButtons.forEach((btn) => {
    const labelSpan = ensureGiftButtonLabelSpan(btn);
    if (!labelSpan) return;

    if (hideDigits) {
      labelSpan.classList.add("gift-key-digit-hidden");
    } else {
      labelSpan.classList.remove("gift-key-digit-hidden");
    }
  });
}

function setGiftKeyLabelsHidden(hidden) {
  const buttons = [];
  if (giftDigitButtons && giftDigitButtons.length) {
    buttons.push(...giftDigitButtons);
  }
  if (giftResetButton) buttons.push(giftResetButton);
  if (giftMoveButton) buttons.push(giftMoveButton);

  buttons.forEach((btn) => {
    const labelSpan = ensureGiftButtonLabelSpan(btn);
    if (!labelSpan) return;

    if (hidden) {
      labelSpan.classList.add("gift-key-digit-hidden");
    } else {
      labelSpan.classList.remove("gift-key-digit-hidden");
    }
  });
}

function setGiftPanelButtonsLocked(locked) {
  giftButtonsLocked = !!locked;

  const buttons = [];
  if (giftDigitButtons && giftDigitButtons.length) {
    buttons.push(...giftDigitButtons);
  }
  if (giftResetButton) buttons.push(giftResetButton);
  if (giftMoveButton) buttons.push(giftMoveButton);

  buttons.forEach((btn) => {
    const labelSpan = ensureGiftButtonLabelSpan(btn);
    if (!labelSpan) return;

    if (giftButtonsLocked) {
      labelSpan.classList.add("gift-key-digit-hidden");
    } else {
      labelSpan.classList.remove("gift-key-digit-hidden");
    }
  });
}



function setGiftMonitorMessage(message, type) {

  if (!giftMonitorMessage) return;

  giftMonitorMessage.textContent = message;

  const messageText = String(message ?? "").trim();
  const isAllDigits = /^\d+$/.test(messageText);
  const isSingleGiftEmoji = messageText === "🎁";

  if (isAllDigits || isSingleGiftEmoji) {
    giftMonitorMessage.style.fontSize = "4rem";
  } else if (/[^\d]/.test(messageText)) {
    giftMonitorMessage.style.fontSize = "1.5rem";
  }

  giftMonitorMessage.classList.remove(
    "gift-monitor-message-cyan",
    "gift-monitor-message-error",
    "gift-monitor-message-lime"
  );

  let colorClass = "gift-monitor-message-cyan";
  let animName = "gift-neon-cyan";

  if (type === "error" || type === "warning") {
    colorClass = "gift-monitor-message-error";
    animName = "gift-neon-pink";
  } else if (type === "success") {
    colorClass = "gift-monitor-message-lime";
    animName = "gift-neon-lime";
  } else {
    colorClass = "gift-monitor-message-cyan";
    animName = "gift-neon-cyan";
  }

  giftMonitorMessage.classList.add(colorClass);

  // Restart neon animation
  giftMonitorMessage.style.animation = "none";
  // Force reflow
  void giftMonitorMessage.offsetWidth;
  giftMonitorMessage.style.animation = `${animName} 1s ease-out`;
}

function ensureGiftButtonLabelSpan(btn) {
  if (!btn) return null;

  let span = btn.querySelector(".gift-key-label");
  const label = btn.dataset.label || (btn.textContent || "").trim();

  if (!span) {
    span = document.createElement("span");
    span.className = "gift-key-label";
    btn.textContent = "";
    btn.appendChild(span);
  }

  if (label) {
    btn.dataset.label = label;
    span.textContent = label;
  }

  return span;
}

function clearGiftKeySequenceTimers() {
  giftKeySequenceTimers.forEach((id) => {
    window.clearTimeout(id);
  });
  giftKeySequenceTimers = [];
}

function clearGiftInputRestoreTimer() {
  if (giftInputRestoreTimer !== null) {
    window.clearTimeout(giftInputRestoreTimer);
    giftInputRestoreTimer = null;
  }
}

function runGiftKeySequenceAnimation() {
  if (!giftDigitButtons || giftDigitButtons.length === 0) return;

  const buttons = [];
  const digits = giftDigitButtons
    .slice()
    .sort((a, b) => {
      const ak = parseInt(a.dataset.key || "0", 10);
      const bk = parseInt(b.dataset.key || "0", 10);
      return ak - bk;
    });

  digits.forEach((btn) => buttons.push(btn));
  if (giftResetButton) buttons.push(giftResetButton);
  if (giftMoveButton) buttons.push(giftMoveButton);

  const stepMs = 110;

  clearGiftKeySequenceTimers();

  buttons.forEach((btn, index) => {
    const labelSpan = ensureGiftButtonLabelSpan(btn);
    if (!labelSpan) return;

    // Ensure each key starts hidden and restarts its flicker cleanly.
    labelSpan.classList.add("gift-key-digit-hidden");
    labelSpan.classList.remove("gift-key-flickering");
    labelSpan.style.animation = "none";
    void labelSpan.offsetWidth;

    const delay = stepMs * index;
    const timerId = window.setTimeout(() => {
      const label = btn.dataset.label;
      if (label && labelSpan.textContent.trim() !== label) {
        labelSpan.textContent = label;
      }
      labelSpan.classList.remove("gift-key-digit-hidden");
      // This is the place where key-label animation gets applied.
      // Keep it one-shot so all number-button spans don't stay animated.
      labelSpan.style.animation = "gift-key-flicker 0.45s ease 1";

      const clearAnimTimerId = window.setTimeout(() => {
        labelSpan.style.animation = "none";
      }, 500);
      giftKeySequenceTimers.push(clearAnimTimerId);
    }, delay);

    giftKeySequenceTimers.push(timerId);
  });
}

function playGiftPromptVoice() {
  // If the fairy has just appeared for this round, skip all human input/hint
  // voices once; the fairy audio will guide the child instead.
  if (skipHintVoiceThisRound) {
    skipHintVoiceThisRound = false;
    return;
  }

  // Count how many numeric hint labels are currently visible on the number line.
  const hintCount =
    gameState.shownHints && typeof gameState.shownHints === "object"
      ? Object.keys(gameState.shownHints).length
      : 0;

  if (hintCount > 0) {
    // First human hint voice: only play once per round when at least one
    // hint label exists.
    if (!gameState.hintRound1Played && typeof window.playHintVoiceRound1 === "function") {
      window.playHintVoiceRound1();
      gameState.hintRound1Played = true;
      return;
    }

    // Second human hint voice: only available when more than one hint label
    // exists (Level 3) so that Level 1/2 never jump straight to hint 2.
    if (
      hintCount > 1 &&
      !gameState.hintRound2Played &&
      typeof window.playHintVoiceRound2 === "function"
    ) {
      window.playHintVoiceRound2();
      gameState.hintRound2Played = true;
      return;
    }
  }

  // Non-hint round fallback: always play the standard human input voice.
  if (typeof window.playVoiceRoboticInput === "function") {
    window.playVoiceRoboticInput();
  }
}







function showGiftInputPromptForGift() {
  if (!giftControlPanel || !giftMonitor || !giftMonitorMessage || !giftMonitorInput) {
    return;
  }

    giftPanelState.maxValue = getGiftPanelMaxValue();
  giftPanelState.phase = "prompt";
  giftPanelState.inputValue = "";
  giftPanelState.keyboardEnabled = true;

    giftControlPanel.classList.remove("hidden");
  giftControlPanel.setAttribute("aria-hidden", "false");
  giftControlPanel.classList.add("gift-panel-prompt");


        giftMonitorInput.textContent = "";
  giftMonitor.classList.remove("has-input");
    setGiftKeyboardEnabled(true, false);
  setGiftPanelButtonsLocked(false);
    // Prompt phase indicator: user has not typed anything yet.
  setGiftMonitorMessage("•ᴗ•", "normal");

  playGiftPromptVoice();

  runGiftKeySequenceAnimation();

  // Once the panel is visible and laid out, update the triangle so
  // its vertical edge sticks to the panel's right wall.
  updateGiftPanelTriangle();
}






function handleGiftDigitClick(digit) {
  // Only allow digit input during the explicit number input phases
  // ("prompt" or "typing"); clicks are still visually acknowledged
  // via the panel button SFX in the event handler.
  const phase = giftPanelState && giftPanelState.phase;
  if (phase !== "prompt" && phase !== "typing") return;

  if (!giftPanelState.keyboardEnabled) return;
  if (typeof digit !== "number" || !Number.isFinite(digit)) return;

  const previous = giftPanelState.inputValue || "";
  const nextRaw = previous + String(digit);
  const max = getGiftPanelMaxValue();
  const parsed = parseInt(nextRaw, 10);

    // Overflow / out-of-range error indicator: show ＞ᨓ＜, then
    // restore the stored number (or prompt face) after the error audio.
    // The overflow detection algorithm itself is unchanged.
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) {
      clearGiftInputRestoreTimer();
      setGiftMonitorMessage("＞ᨓ＜", "error");

      // Range-specific human overflow guidance.
      playHumanOverflowVoiceForCurrentRange();


    giftInputRestoreTimer = window.setTimeout(() => {
      giftInputRestoreTimer = null;
      if (previous) {
        setGiftMonitorMessage(previous, "normal");
        if (giftMonitor) {
          giftMonitor.classList.add("has-input");
        }
        giftPanelState.phase = "typing";
      } else {
        setGiftMonitorMessage("•ᴗ•", "normal");
        giftPanelState.phase = "prompt";
      }
    }, 2400);
    return;
  }


  const next = String(parsed);

  giftPanelState.inputValue = next;

  if (giftMonitorInput) {
    giftMonitorInput.textContent = next;
  }

  // Show the entered number directly in the centred text row.
  setGiftMonitorMessage(next, "normal");

  if (giftMonitor) {
    giftMonitor.classList.add("has-input");
  }

  if (giftPanelState.phase === "prompt") {
    giftPanelState.phase = "typing";
  }
}



function handleGiftResetClick() {
  if (!giftControlPanel || !giftMonitor || !giftMonitorMessage || !giftMonitorInput) {
    return;
  }

  // Only function in number input phases ("prompt" or "typing");
  // in other phases the button remains clickable but has no effect.
  const phase = giftPanelState && giftPanelState.phase;
  if (phase !== "prompt" && phase !== "typing") {
    return;
  }

  // 勝利後不再允許重設。
  if (giftPanelState.phase === "success") {
    return;
  }

  giftPanelState.inputValue = "";

  giftPanelState.phase = "prompt";

  // Cancel any pending callbacks that could restore stale digits.
  clearGiftInputRestoreTimer();

  giftMonitorInput.textContent = "";
  giftMonitor.classList.remove("has-input");
  if (giftControlPanel) {
    giftControlPanel.classList.add("gift-panel-prompt");
  }

  if (giftZeroButton) {
    giftZeroButton.disabled = false;
  }

  clearGiftKeySequenceTimers();
  setGiftKeyLabelsHidden(false);
  setGiftKeyboardEnabled(true, false);
  // Back to prompt phase: no digits typed yet.
  setGiftMonitorMessage("•ᴗ•", "normal");

  // When the child manually presses the retry button during a turn
  // where hints may already be visible, always play the normal
  // input guidance track instead of progressing to a later hint
  // voice.
  if (typeof window.playVoiceRoboticInput === "function") {
    window.playVoiceRoboticInput();
  }
}






function handleGiftMoveClick() {
  // Only function when actually in a number-input phase ("prompt" or "typing");
  // in other phases the button remains clickable but does nothing.
  const phase = giftPanelState && giftPanelState.phase;
  if (phase !== "prompt" && phase !== "typing") {
    return;
  }

  // 不在輸入階段或正在移動／已完成勝利時，按鈕不作任何反應。
  if (giftPanelState.phase === "moving" || giftPanelState.phase === "success") {
    return;
  }

  // 沒有數字輸入時不作任何反應。
  if (!giftPanelState.inputValue) {
    return;
  }

  const max = getGiftPanelMaxValue();
  const value = parseInt(giftPanelState.inputValue, 10);

    // Invalid value error: show ＞ᨓ＜, then restore the stored number
    // (or prompt face) after the error audio. The overflow algorithm
    // remains unchanged; this branch simply adds voice feedback.
    if (!Number.isFinite(value) || value < 0 || value > max) {
      const stored = giftPanelState.inputValue || "";
      clearGiftInputRestoreTimer();
      setGiftMonitorMessage("＞ᨓ＜", "error");

      // Range-specific human overflow guidance.
      playHumanOverflowVoiceForCurrentRange();


    giftInputRestoreTimer = window.setTimeout(() => {
      giftInputRestoreTimer = null;
      if (stored) {
        setGiftMonitorMessage(stored, "normal");
        if (giftMonitor) {
          giftMonitor.classList.add("has-input");
        }
        giftPanelState.phase = "typing";
      } else {
        setGiftMonitorMessage("•ᴗ•", "normal");
        giftPanelState.phase = "prompt";
      }
    }, 2400);
    return;
  }


    // Mark the panel as moving before starting the claw motion so that
  // debugClawDown can correctly flag a pending round outcome.
  giftPanelState.phase = "moving";
  if (giftControlPanel) {
    giftControlPanel.classList.remove("gift-panel-prompt");
  }

    // Lock all panel buttons and hide all panel labels while the claw is moving.
  setGiftPanelButtonsLocked(true);

  // Keep the entered number visible in the centred text while the claw moves;
  // digits remain hidden and the keyboard is disabled.
  setGiftKeyboardEnabled(false, true);



  if (typeof window.controlClawPosition === "function") {
    window.controlClawPosition(value);
  }
  if (typeof window.debugClawDown === "function") {
    window.debugClawDown();
  }
}


function showGiftErrorMessage() {
  if (!giftControlPanel || !giftMonitor || !giftMonitorMessage || !giftMonitorInput) {
    return;
  }

        giftPanelState.phase = "error";
  if (giftControlPanel) {
    giftControlPanel.classList.remove("gift-panel-prompt");
  }
  // Catch failed / attempt error indicator.
  setGiftMonitorMessage("＞ᨓ＜", "error");

  // Disable keyboard and hide digits while the error message is showing.
  setGiftKeyboardEnabled(false, true);

  // Helper to restore the panel back to the input prompt phase.
  function restorePromptFromError() {
    if (!giftControlPanel || !giftMonitor || !giftMonitorMessage || !giftMonitorInput) {
      return;
    }

    giftPanelState.inputValue = "";
    giftPanelState.phase = "prompt";

    giftMonitorInput.textContent = "";
    giftMonitor.classList.remove("has-input");
    if (giftControlPanel) {
      giftControlPanel.classList.add("gift-panel-prompt");
    }


    if (giftZeroButton) {
      giftZeroButton.disabled = false;
    }

                                setGiftKeyboardEnabled(true, false);
    setGiftPanelButtonsLocked(false);
    // Back to prompt phase indicator after an error.
    setGiftMonitorMessage("•ᴗ•", "normal");
                                playGiftPromptVoice();
    runGiftKeySequenceAnimation();

  }

    // Prefer to wait until the fail voice clip has finished before
  // restoring the prompt; fall back to a timeout if the audio is
  // unavailable or cannot play.
  let restored = false;
  function restoreOnce() {
    if (restored) return;
    restored = true;
    restorePromptFromError();
  }

  // No dedicated fail element is used here; keep the previous
  // fixed-delay behaviour.
  window.setTimeout(restoreOnce, 2400);
}





function showGiftSuccessMessage() {
  if (!giftControlPanel || !giftMonitor || !giftMonitorMessage) {
    return;
  }

    giftPanelState.phase = "success";
  if (giftControlPanel) {
    giftControlPanel.classList.remove("gift-panel-prompt");
  }
  // Success indicator: gift caught.
  setGiftMonitorMessage("🎁", "success");

  // Victory modal, multi-level progression, and celebratory sounds are
  // handled separately inside handleRoundOutcome() once the claw has
  // returned home with the gift.
}




// 在新流程中，模式及等級會由主選單提供，
// 此函式只保留作後備使用。
function selectMode(mode) {
  gameState.mode = mode;
  if (difficultySelection) {
    difficultySelection.classList.remove("hidden");
  }
}

// 後備難度及等級選擇邏輯：更新標題列的排序方向及等級顯示。
// 此函式目前不在新流程中自動呼叫，但可供主菜單或未來擴充使用。
function startGame(difficulty) {
  gameState.difficulty = difficulty;

  if (mainMenu) mainMenu.classList.add("hidden");
  if (gameArea) gameArea.classList.remove("hidden");

  if (orderInfo) {
    if (gameState.mode === "ascending") {
      orderInfo.innerHTML = "👉 由 <b>小 → 大</b> 排列 (左邊最小)";
    } else {
      orderInfo.innerHTML = "👈 由 <b>大 → 小</b> 排列 (右邊最大)";
    }
  }

  if (difficultyInfo) {
    difficultyInfo.innerHTML =
      difficulty === "easy" ? "⭐ 等級一 (1-10)" : "⭐⭐ 等級二 (1-20)";
  }
}


// Read URL parameters from game.html and initialise game state + header bar.
function initGameConfigFromUrl() {
    const params = new URLSearchParams(window.location.search);
  const rangeMinParam = params.get("rangeMin");
  const rangeMaxParam = params.get("rangeMax");
  const clampTolParam = params.get("clampTolerance");

  if (rangeMinParam) {
    const parsedMin = parseInt(rangeMinParam, 10);
    if (!Number.isNaN(parsedMin) && parsedMin >= 0) {
      gameState.rangeMin = parsedMin;
    }
  }

  if (rangeMaxParam) {
    const parsedMax = parseInt(rangeMaxParam, 10);
    if (!Number.isNaN(parsedMax) && parsedMax > 0) {
      gameState.rangeMax = parsedMax;
      gameState.maxNumber = parsedMax;
    }
  }


  if (clampTolParam) {
    const parsedTol = parseInt(clampTolParam, 10);
    if (!Number.isNaN(parsedTol) && parsedTol > 0) {
      gameState.clampTolerance = parsedTol;
    }
  }

    // Header bar: show a friendly summary of range and clamp settings, with emojis.
  if (rangeInfo) {
    const minNumber = typeof gameState.rangeMin === "number" ? gameState.rangeMin : 0;
    const maxNumber = typeof gameState.rangeMax === "number" && gameState.rangeMax > 0 ? gameState.rangeMax : 20;
    rangeInfo.innerHTML = `🔢 範圍：${minNumber} 至 ${maxNumber}`;
  }


  if (precisionInfo) {
    const clampTolerance = typeof gameState.clampTolerance === "number" && gameState.clampTolerance > 0 ? gameState.clampTolerance : 1;
    precisionInfo.innerHTML = `🧸 夾子：允許 ${clampTolerance} 落差`;
  }
}

// Decide the number line scale for rendering.
// The visual number line is always 0–20, regardless of the playable range.
function getNumberLineScaleFromGameState() {
  return 20;
}

// Map current playable range to a logical hint level (1/2/3).
function getHintLevelFromRange() {
  const min = typeof gameState.rangeMin === "number" ? gameState.rangeMin : 0;
  const max = typeof gameState.rangeMax === "number" ? gameState.rangeMax : 20;
  if (min === 0 && max === 10) return 1;
  if (min === 11 && max === 20) return 2;
  if (min === 0 && max === 20) return 3;
  return null;
}

function ensureHintLabelsGroup() {
  const svg = document.getElementById("numberLineLabelsSVG");
  if (!svg) return null;
  let group = document.getElementById("labelsGroupHints");
  if (!group) {
    group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.id = "labelsGroupHints";
    group.style.zIndex = "3";
    svg.appendChild(group);
  }
  return group;
}

// Fade in a white hint label at the given numeric value on the 0-20 number line.
function showHintLabelAt(value) {
  const group = ensureHintLabelsGroup();
  if (!group) return;

  // Avoid duplicate labels for the same value.
  if (!gameState.shownHints) {
    gameState.shownHints = {};
  }
  if (gameState.shownHints[value]) {
    return;
  }

  const startX = 50;
  const endX = 4950;
  const totalWidth = endX - startX;
  const fixedMax = 20;
  const yCenter = 80;

  const xPos = startX + (value / fixedMax) * totalWidth;
  const labelY = yCenter - 200;

  // Hint tick at the same position.
  const hintTickHeight = 120;
  const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
  tick.setAttribute("x1", xPos);
  tick.setAttribute("y1", yCenter - hintTickHeight);
  tick.setAttribute("x2", xPos);
  tick.setAttribute("y2", yCenter);
  tick.setAttribute("stroke", "white");
  tick.setAttribute("stroke-width", "22.5");
  tick.style.filter =
    "drop-shadow(1vh 0 0 #000) drop-shadow(-1vh 0 0 #000) drop-shadow(0 1vh 0 #000) drop-shadow(0 -1vh 0 #000)";
  tick.style.opacity = "0";
  tick.style.transition = "opacity 0.8s ease-out";

  const hint = document.createElementNS("http://www.w3.org/2000/svg", "text");
  hint.setAttribute("x", xPos);
  hint.setAttribute("y", labelY);
  hint.setAttribute("text-anchor", "middle");
  hint.setAttribute("fill", "white");
  hint.setAttribute("font-family", "Impact, Arial, sans-serif");
  hint.setAttribute("font-size", "360");
  hint.style.filter =
    "drop-shadow(1vh 0 0 #000) drop-shadow(-1vh 0 0 #000) drop-shadow(0 1vh 0 #000) drop-shadow(0 -1vh 0 #000)";
  hint.style.opacity = "0";
  hint.style.transition = "opacity 0.8s ease-out";
  hint.textContent = String(value);

  group.appendChild(tick);
  group.appendChild(hint);

  // Mark as shown in state and fade in.
  gameState.shownHints[value] = true;
  requestAnimationFrame(function () {
    hint.style.opacity = "1";
    tick.style.opacity = "1";
  });
}


// Reset all hint-related state and remove any existing hint labels.
function resetHintState() {
  gameState.wrongAttemptsForHints = 0;
  gameState.shownHints = {};
  gameState.hintRound1Played = false;
  gameState.hintRound2Played = false;
  const group = document.getElementById("labelsGroupHints");
  if (group) {
    group.innerHTML = "";
  }
  // Reset fairy/hint voice coupling so each level/run starts clean.
  skipHintVoiceThisRound = false;
  // Also reset any fairy guidance overlay so each level/run starts clean.
  clearFairyState();
}


// Fairy guidance spritesheet/audio and panel fade helpers
let fairySpriteEl = null;
let fairySpriteAnimator = null;
let fairyAudio = null;
let fairyGreetingAudio = null;
let fairyUltFailAudio = null;
let fairyHasAppeared = false;
let fairySpriteResizeBound = false;
let fairyFlightAnimationId = null;
let fairyFlightRunId = 0;
let fairyReactionTimerId = null;
let fairyReactionRunId = 0;

// Shared frame duration constant for spritesheet animations in this game.
const SPRITESHEET_FRAME_DURATION_MS = 90;

// Fairy spritesheet tuning knobs.
const FAIRY_SPRITESHEET_PNG = "./fairy-flying_on_the_spot.png";
const FAIRY_SPRITESHEET_FRAME_SIZE = 256;
const FAIRY_SPRITESHEET_COLUMNS = 4;
const FAIRY_SPRITESHEET_TOTAL_FRAMES = 16;
const FAIRY_SPRITESHEET_LOOP = true;
const FAIRY_SPRITESHEET_SEQUENCE = [8, 9, 10, 11, 12, 13, 14, 15];
const FAIRY_FLYING_AROUND_PNG = "./fairy-flying_around.png";
const FAIRY_SUPRISED_PNG = "./fairy-suprised.png";
const FAIRY_SUPRISED_SEQUENCE = [10, 11, 12, 13, 14, 15, 14, 13, 12, 11];
const FAIRY_LOCUS = [5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 11, 11, 11, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 1, 2, 3, 4];
const FAIRY_SUCCESS_FLIGHT_DURATION_MS = 1000;
const FAIRY_SUCCESS_FADE_OUT_DURATION_MS = 350;
const FAIRY_SUCCESS_CIRCLE_RADIUS_VH = 40;
const FAIRY_SUCCESS_INTERSECTION_Y = 0.7;
const FAIRY_AURA_BLUR_PX = 30;
const FAIRY_AURA = {
  lime: ["rgba(190, 242, 100, 0.98)", "rgba(132, 204, 22, 0.85)"],
  pink: ["rgba(244, 114, 182, 0.98)", "rgba(236, 72, 153, 0.85)"],
};
// When the fairy appears for a particular round, skip human input/hint voices
// for the next input prompt so they do not overlap with the fairy guidance.
let skipHintVoiceThisRound = false;
// DOM container and state for fairy round multiple-choice options.
let fairyOptionsContainer = null;
let fairyOptionButtons = [];
let fairyRoundResolved = false;

function playFairyMedia(mediaEl, rawUrl) {
  if (!mediaEl) {
    return Promise.resolve(false);
  }

  if (typeof window.safePlayMedia === "function") {
    return window
      .safePlayMedia(mediaEl, rawUrl)
      .then(function () {
        return true;
      })
      .catch(function () {
        return false;
      });
  }

  try {
    if (rawUrl) {
      mediaEl.src = rawUrl;
      if (typeof mediaEl.load === "function") {
        mediaEl.load();
      }
    }

    var playPromise = mediaEl.play();
    if (playPromise && typeof playPromise.then === "function") {
      return playPromise
        .then(function () {
          return true;
        })
        .catch(function () {
          return false;
        });
    }
    return Promise.resolve(true);
  } catch (_) {
    return Promise.resolve(false);
  }
}

function updateFairySpriteScale() {
  if (!fairySpriteEl) {
    return;
  }

  // Make fairy 1.25x larger than the previous 20vw baseline.
  const targetWidthPx = window.innerWidth * 0.25;
  const scale = Math.max(0.1, targetWidthPx / FAIRY_SPRITESHEET_FRAME_SIZE);
  fairySpriteEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

function setFairyAuraMood(mood) {
  if (!fairySpriteEl) {
    return;
  }

  const colors = FAIRY_AURA[mood] || FAIRY_AURA.lime;
  fairySpriteEl.style.filter =
    `drop-shadow(0 0 ${FAIRY_AURA_BLUR_PX}px ${colors[0]}) ` +
    `drop-shadow(0 0 ${FAIRY_AURA_BLUR_PX}px ${colors[1]})`;
}

function restoreFairyIdleSpritesheet() {
  if (!fairySpriteAnimator) {
    return;
  }

  const idlePngUrl =
    typeof window.sanitizeMediaUrl === "function"
      ? window.sanitizeMediaUrl(FAIRY_SPRITESHEET_PNG)
      : FAIRY_SPRITESHEET_PNG;
  fairySpriteAnimator.setDescriptor({
    id: "fairy-guidance",
    png: idlePngUrl || FAIRY_SPRITESHEET_PNG,
    frameWidth: FAIRY_SPRITESHEET_FRAME_SIZE,
    frameHeight: FAIRY_SPRITESHEET_FRAME_SIZE,
    columns: FAIRY_SPRITESHEET_COLUMNS,
    totalFrames: FAIRY_SPRITESHEET_TOTAL_FRAMES,
    frameDurationMs: SPRITESHEET_FRAME_DURATION_MS,
    loop: FAIRY_SPRITESHEET_LOOP,
    sequence: FAIRY_SPRITESHEET_SEQUENCE.slice(),
  });
}

function playFairySurprisedReaction() {
  if (!fairySpriteEl || !fairySpriteAnimator) {
    return Promise.resolve();
  }

  fairyReactionRunId += 1;
  const reactionRunId = fairyReactionRunId;
  if (fairyReactionTimerId != null) {
    window.clearTimeout(fairyReactionTimerId);
    fairyReactionTimerId = null;
  }

  fairySpriteAnimator.stop();
  const surprisedPngUrl =
    typeof window.sanitizeMediaUrl === "function"
      ? window.sanitizeMediaUrl(FAIRY_SUPRISED_PNG)
      : FAIRY_SUPRISED_PNG;
  setFairyAuraMood("pink");
  fairySpriteAnimator.setDescriptor({
    id: "fairy-surprised",
    png: surprisedPngUrl || FAIRY_SUPRISED_PNG,
    frameWidth: FAIRY_SPRITESHEET_FRAME_SIZE,
    frameHeight: FAIRY_SPRITESHEET_FRAME_SIZE,
    columns: FAIRY_SPRITESHEET_COLUMNS,
    totalFrames: FAIRY_SPRITESHEET_TOTAL_FRAMES,
    frameDurationMs: SPRITESHEET_FRAME_DURATION_MS,
    loop: true,
    sequence: FAIRY_SUPRISED_SEQUENCE.slice(),
  });
  fairySpriteAnimator.play();

  return Promise.resolve(reactionRunId);
}

function stopFairySurprisedReaction() {
  fairyReactionRunId += 1;
  if (fairyReactionTimerId != null) {
    window.clearTimeout(fairyReactionTimerId);
    fairyReactionTimerId = null;
  }

  if (!fairySpriteAnimator || !fairySpriteEl) {
    return;
  }

  restoreFairyIdleSpritesheet();
  setFairyAuraMood("lime");
  if (fairySpriteEl.style.opacity !== "0") {
    fairySpriteAnimator.play();
  }
}

function getFairySuccessLoopBounds() {
  const xMin = window.innerWidth * 0.1;
  const xMax = window.innerWidth * 0.9;
  const yMin = window.innerHeight * 0.35;
  const yMax = window.innerHeight * 0.75;
  return {
    xMin,
    xMax,
    yMin,
    yMax,
    center: {
      x: (xMin + xMax) / 2,
      y: (yMin + yMax) / 2,
    },
    halfX: (xMax - xMin) / 2,
    halfY: (yMax - yMin) / 2,
  };
}

function playFairySuccessFlight() {
  if (!fairySpriteEl || !fairySpriteAnimator) {
    return Promise.resolve();
  }

  fairyFlightRunId += 1;
  const runId = fairyFlightRunId;
  if (fairyFlightAnimationId != null) {
    window.cancelAnimationFrame(fairyFlightAnimationId);
  }
  fairyReactionRunId += 1;
  if (fairyReactionTimerId != null) {
    window.clearTimeout(fairyReactionTimerId);
    fairyReactionTimerId = null;
  }

  fairySpriteAnimator.stop();
  setFairyAuraMood("lime");
  const flyingAroundPngUrl =
    typeof window.sanitizeMediaUrl === "function"
      ? window.sanitizeMediaUrl(FAIRY_FLYING_AROUND_PNG)
      : FAIRY_FLYING_AROUND_PNG;
  fairySpriteAnimator.setDescriptor({
    id: "fairy-success-flight",
    png: flyingAroundPngUrl || FAIRY_FLYING_AROUND_PNG,
    frameWidth: FAIRY_SPRITESHEET_FRAME_SIZE,
    frameHeight: FAIRY_SPRITESHEET_FRAME_SIZE,
    columns: FAIRY_SPRITESHEET_COLUMNS,
    totalFrames: FAIRY_SPRITESHEET_TOTAL_FRAMES,
    frameDurationMs: SPRITESHEET_FRAME_DURATION_MS,
    loop: false,
    sequence: FAIRY_LOCUS.slice(),
  });
  fairySpriteEl.style.transition = "none";

  const loop = getFairySuccessLoopBounds();
  const center = loop.center;
  const halfX = loop.halfX;
  const halfY = loop.halfY;

  function setPosition(point) {
    fairySpriteEl.style.left = `${point.x}px`;
    fairySpriteEl.style.top = `${point.y}px`;
  }

  // Lemniscate of Bernoulli path mapped to viewport bounds:
  // x range 10vw..90vw, y range 35vh..75vh.
  // Start exactly at center with +y and +x movement first.
  function pointAtProgress(progress01) {
    const theta = Math.PI / 2 - progress01 * Math.PI * 2;
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    const denom = 1 + sinT * sinT;

    const xNorm = cosT / denom;
    const yNorm = (sinT * cosT) / denom;

    return {
      x: center.x + xNorm * halfX,
      y: center.y + (yNorm / 0.5) * halfY,
    };
  }

  return new Promise(function (resolve) {
    let startTimestamp = null;

    // Snap to the required start point (center) before motion begins.
    setPosition(center);

    function finishFlight() {
      fairyFlightAnimationId = null;
      setPosition(center);
      restoreFairyIdleSpritesheet();
      setFairyAuraMood("lime");
      fairySpriteAnimator.play();
      resolve();
    }

    function animateFlight(timestamp) {
      if (runId !== fairyFlightRunId) {
        return;
      }
      if (startTimestamp == null) {
        startTimestamp = timestamp;
      }

      const elapsed = Math.min(
        timestamp - startTimestamp,
        FAIRY_SUCCESS_FLIGHT_DURATION_MS
      );
      const frameDuration = FAIRY_SUCCESS_FLIGHT_DURATION_MS / FAIRY_LOCUS.length;
      const frameIndex = Math.min(
        FAIRY_LOCUS.length - 1,
        Math.floor(elapsed / frameDuration)
      );
      fairySpriteAnimator.setFrame(FAIRY_LOCUS[frameIndex]);
      setPosition(pointAtProgress(elapsed / FAIRY_SUCCESS_FLIGHT_DURATION_MS));

      if (elapsed >= FAIRY_SUCCESS_FLIGHT_DURATION_MS) {
        finishFlight();
        return;
      }
      fairyFlightAnimationId = window.requestAnimationFrame(animateFlight);
    }

    fairyFlightAnimationId = window.requestAnimationFrame(animateFlight);
  });
}

function initFairyMedia() {
  if (fairySpriteEl && fairyAudio && fairyGreetingAudio) {
    return;
  }

  const fairySpritePngUrl =
    typeof window.sanitizeMediaUrl === "function"
      ? window.sanitizeMediaUrl(FAIRY_SPRITESHEET_PNG)
      : FAIRY_SPRITESHEET_PNG;

    const greetingUrl =
    typeof window.sanitizeMediaUrl === "function"
      ? window.sanitizeMediaUrl("./bear_fairy_greeting.mp3")
      : "./bear_fairy_greeting.mp3";

  const audioUrl =
    typeof window.sanitizeMediaUrl === "function"
      ? window.sanitizeMediaUrl("./bear_fairy_input.mp3")
      : "./bear_fairy_input.mp3";

  const ultFailUrl =
    typeof window.sanitizeMediaUrl === "function"
      ? window.sanitizeMediaUrl("./bear_fairy_ultfail.mp3")
      : "./bear_fairy_ultfail.mp3";

  fairySpriteEl = document.createElement("div");
  fairySpriteEl.id = "bearFairySprite";
  fairySpriteEl.style.position = "fixed";
  const loopCenter = getFairySuccessLoopBounds().center;
  fairySpriteEl.style.left = `${loopCenter.x}px`;
  fairySpriteEl.style.top = `${loopCenter.y}px`;
  fairySpriteEl.style.zIndex = "1400";
  fairySpriteEl.style.opacity = "0";
  fairySpriteEl.style.pointerEvents = "none";
  setFairyAuraMood("lime");

  document.body.appendChild(fairySpriteEl);

  fairySpriteAnimator = createSpritesheetPlayer(fairySpriteEl, {
    id: "fairy-guidance",
    png: fairySpritePngUrl || FAIRY_SPRITESHEET_PNG,
    frameWidth: FAIRY_SPRITESHEET_FRAME_SIZE,
    frameHeight: FAIRY_SPRITESHEET_FRAME_SIZE,
    columns: FAIRY_SPRITESHEET_COLUMNS,
    totalFrames: FAIRY_SPRITESHEET_TOTAL_FRAMES,
    frameDurationMs: SPRITESHEET_FRAME_DURATION_MS,
    loop: FAIRY_SPRITESHEET_LOOP,
    sequence: FAIRY_SPRITESHEET_SEQUENCE.slice(),
  });

  updateFairySpriteScale();
  if (!fairySpriteResizeBound) {
    window.addEventListener("resize", updateFairySpriteScale);
    fairySpriteResizeBound = true;
  }

  fairyGreetingAudio = new Audio();
  if (greetingUrl) {
    fairyGreetingAudio.src = greetingUrl;
    fairyGreetingAudio.preload = "auto";
    try {
      fairyGreetingAudio.load();
    } catch (_) {}
  }

    fairyAudio = new Audio();
  if (audioUrl) {
    fairyAudio.src = audioUrl;
    fairyAudio.preload = "auto";
    try {
      fairyAudio.load();
    } catch (_) {}
  }

  fairyUltFailAudio = new Audio();
  if (ultFailUrl) {
    fairyUltFailAudio.src = ultFailUrl;
    fairyUltFailAudio.preload = "auto";
    try {
      fairyUltFailAudio.load();
    } catch (_) {}
  }
}



function clearFairyState() {
  fairyHasAppeared = false;
  fairyRoundResolved = false;
  fairyFlightRunId += 1;
  fairyReactionRunId += 1;
  if (fairyFlightAnimationId != null) {
    window.cancelAnimationFrame(fairyFlightAnimationId);
    fairyFlightAnimationId = null;
  }
  if (fairyReactionTimerId != null) {
    window.clearTimeout(fairyReactionTimerId);
    fairyReactionTimerId = null;
  }
  if (fairySpriteAnimator) {
    fairySpriteAnimator.stop();
    restoreFairyIdleSpritesheet();
  }
  if (fairySpriteEl) {
    setFairyAuraMood("lime");
    fairySpriteEl.style.opacity = "0";
    const loopCenter = getFairySuccessLoopBounds().center;
    fairySpriteEl.style.left = `${loopCenter.x}px`;
    fairySpriteEl.style.top = `${loopCenter.y}px`;
  }
    if (fairyGreetingAudio) {
    try {
      fairyGreetingAudio.pause();
      fairyGreetingAudio.currentTime = 0;
    } catch (_) {}
  }
  if (fairyAudio) {
    try {
      fairyAudio.pause();
      fairyAudio.currentTime = 0;
    } catch (_) {}
  }
  if (fairyUltFailAudio) {
    try {
      fairyUltFailAudio.pause();
      fairyUltFailAudio.currentTime = 0;
    } catch (_) {}
  }

  if (giftControlPanel) {
    giftControlPanel.style.transition = "";
    giftControlPanel.style.opacity = "";
    giftControlPanel.style.pointerEvents = "";
  }
  if (giftPanelTriangleSvg) {
    giftPanelTriangleSvg.style.transition = "";
    giftPanelTriangleSvg.style.opacity = "";
  }
  if (fairyOptionsContainer) {
    fairyOptionsContainer.style.display = "none";
    fairyOptionsContainer.innerHTML = "";
  }
  fairyOptionButtons = [];
}

function ensureFairyOptionsContainer() {
  if (fairyOptionsContainer) return fairyOptionsContainer;
  const container = document.createElement("div");
  container.id = "fairyOptionsContainer";
    container.style.position = "fixed";
  container.style.left = "0";
  // Position the container so that the option centres sit at ~85vh.
  container.style.top = "70vh";
  container.style.width = "100%";
  container.style.display = "flex";

  container.style.justifyContent = "space-evenly";
  container.style.alignItems = "center";
  container.style.zIndex = "1450";
  container.style.pointerEvents = "auto";
  document.body.appendChild(container);
  fairyOptionsContainer = container;
  return container;
}

function getFairyRange() {
  const rangeMin =
    typeof gameState.rangeMin === "number" && gameState.rangeMin >= 0
      ? gameState.rangeMin
      : 0;
  const rangeMax =
    typeof gameState.rangeMax === "number" && gameState.rangeMax >= rangeMin
      ? gameState.rangeMax
      : 20;
  return { rangeMin, rangeMax };
}

function generateAlternativeAnswer(correct) {
  // Wrapper kept for backward compatibility: delegate to the SEN-aware
  // smart wrong-option generator.
  const { rangeMin, rangeMax } = getFairyRange();
  return getSmartWrongOption(correct, currentRoundGuesses, rangeMin, rangeMax);
}


function showFairyOptionsForCurrentGift() {
  if (fairyRoundResolved) return;
  if (typeof activeGiftValue !== "number") return;

  const correctValue = activeGiftValue;
  const alternativeValue = generateAlternativeAnswer(correctValue);

  const container = ensureFairyOptionsContainer();
  container.style.display = "flex";
  container.innerHTML = "";

  fairyOptionButtons = [];

  const values = Math.random() < 0.5
    ? [correctValue, alternativeValue]
    : [alternativeValue, correctValue];

  values.forEach((value) => {
        const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = String(value);

    // Base option size: 20vh high/wide, font-size 80% of height.
    btn.style.height = "20vh";
    btn.style.width = "20vh";
    btn.style.borderRadius = "50%";
    btn.style.backgroundColor = "#ffffff";
    btn.style.color = "#000000";
    btn.style.display = "flex";
    btn.style.alignItems = "center";
    btn.style.justifyContent = "center";
    btn.style.fontFamily = "Nightgazer16, system-ui, sans-serif";
    btn.style.fontSize = "16vh";
    btn.style.border = "0.4vh solid #dddddd";
    btn.style.boxShadow = "0 0.5vh 1vh rgba(0,0,0,0.25)";
    btn.style.cursor = "pointer";
    btn.style.transition = "all 0.6s ease";
    btn.style.transform = "scale(1)";

    btn.dataset.value = String(value);
    btn.dataset.correct = value === correctValue ? "true" : "false";

    btn.addEventListener("click", () => {
      handleFairyOptionClick(btn);
    });

    fairyOptionButtons.push(btn);

    // Base plate behind each circular option to give a 3D button feel.
    const plate = document.createElement("div");
    plate.className = "fairy-option-plate";
    plate.style.display = "flex";
    plate.style.alignItems = "center";
    plate.style.justifyContent = "center";
    plate.style.padding = "1.5vh";
    plate.style.borderRadius = "2vh";
    plate.style.background = "rgba(0, 0, 0, 0.12)";
    plate.style.border = "0.5vh solid #000000";
    plate.style.boxShadow =
      "0 1vh 2vh rgba(0,0,0,0.35), " +
      "0 -0.3vh 0.6vh rgba(255,255,255,0.3)";
    plate.style.transition = "all 0.6s ease";
    // Fix the plate height so that the option centre stays put even
    // when the circular button grows or shrinks.
    plate.style.height = "28vh";
    plate.style.width = "28vh";
    plate.style.boxSizing = "border-box";
    plate.style.overflow = "visible";


    plate.appendChild(btn);
    container.appendChild(plate);

  });
}


function handleFairyOptionClick(btn) {
  if (fairyRoundResolved) return;
  if (!btn) return;
  if (btn.dataset.lockedWrong === "true") return;

  const isCorrect = btn.dataset.correct === "true";

    if (isCorrect) {
    fairyRoundResolved = true;
    fairyOptionButtons.forEach((optionBtn) => {
      optionBtn.style.pointerEvents = "none";
      optionBtn.style.cursor = "default";
    });
    setFairyAuraMood("lime");
    stopFairySurprisedReaction();
    // Correct choice: grow to 25vh and turn green over 2 seconds.
    btn.style.backgroundColor = "#bbf7d0"; // light green
    btn.style.color = "#166534"; // dark green
    btn.style.height = "25vh";
    btn.style.width = "25vh";
    btn.style.fontSize = "20vh"; // 80% of height
    btn.style.transform = "scale(1)";

    if (typeof window.playClawAttemptSuccess === "function") {
      window.playClawAttemptSuccess();
    }

    playFairySuccessFlight()
      .catch(() => {})
      .then(() => {
        return fadeOutFairyThenStartClawForMcSuccess();
      });
    } else {
    const selectedValue = parseInt(btn.dataset.value || "", 10);
    if (Number.isFinite(selectedValue) && typeof activeGiftValue === "number") {
      const { rangeMin, rangeMax } = getFairyRange();
      saveAttemptToHistory(activeGiftValue, selectedValue, rangeMin, rangeMax);
    }

    // Wrong choice: shrink to 10vh and turn red over 2 seconds.
    btn.dataset.lockedWrong = "true";
    btn.style.backgroundColor = "#fecaca"; // light red
    btn.style.color = "#991b1b"; // dark red
    btn.style.height = "10vh";
    btn.style.width = "10vh";
    btn.style.fontSize = "8vh"; // 80% of height
    btn.style.transform = "scale(1)";
    btn.style.pointerEvents = "none";
    btn.style.cursor = "default";

        if (typeof window.playClawAttemptFail === "function") {
      window.playClawAttemptFail();
    }

    handleWrongAttemptForHints();

    // Immediately after the mechanical claw fail sound, play the
    // ultimate fairy fail voice.
    if (fairyUltFailAudio) {
      try {
        fairyUltFailAudio.currentTime = 0;
        playFairyMedia(fairyUltFailAudio);
      } catch (_) {}
    }

    playFairySurprisedReaction();

    setTimeout(() => {
      // Keep surprised looping briefly, then return to idle while
      // leaving the correct option for another student attempt.
      if (fairyRoundResolved) {
        return;
      }
      stopFairySurprisedReaction();
    }, 2000);
  }

}

function fadeOutFairyThenStartClawForMcSuccess() {
  return new Promise((resolve) => {
    const launchClawSequence = () => {
      stopFairySurprisedReaction();
      if (fairyAudio) {
        try {
          fairyAudio.pause();
          fairyAudio.currentTime = 0;
        } catch (_) {}
      }
      if (fairyGreetingAudio) {
        try {
          fairyGreetingAudio.pause();
          fairyGreetingAudio.currentTime = 0;
        } catch (_) {}
      }
      if (fairySpriteAnimator) {
        fairySpriteAnimator.stop();
      }
      if (fairyOptionsContainer) {
        fairyOptionsContainer.style.display = "none";
      }

      if (typeof activeGiftValue !== "number") {
        handleFairyRoundSuccess(false);
        resolve();
        return;
      }

      giftPanelState.phase = "moving";
      if (giftControlPanel) {
        giftControlPanel.classList.remove("gift-panel-prompt");
      }
      setGiftKeyboardEnabled(false, true);
      setGiftPanelButtonsLocked(true);

      if (typeof window.controlClawPosition === "function") {
        window.controlClawPosition(activeGiftValue);
      }
      if (typeof window.debugClawDown === "function") {
        window.debugClawDown();
      }

      resolve();
    };

    if (!fairySpriteEl) {
      launchClawSequence();
      return;
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      fairySpriteEl.removeEventListener("transitionend", onTransitionEnd);
      launchClawSequence();
    };
    const onTransitionEnd = (event) => {
      if (event && event.target !== fairySpriteEl) {
        return;
      }
      finish();
    };

    fairySpriteEl.addEventListener("transitionend", onTransitionEnd);
    fairySpriteEl.style.transition = `opacity ${FAIRY_SUCCESS_FADE_OUT_DURATION_MS}ms ease-out`;
    fairySpriteEl.style.opacity = "0";
    window.setTimeout(finish, FAIRY_SUCCESS_FADE_OUT_DURATION_MS + 120);
  });
}


function handleFairyRoundSuccess(withFlight = true) {
  // MC question answered; clear the current round's attempt log so the next
  // gift starts with a fresh local profile.
  resetCurrentRoundGuesses();

  if (withFlight) {
    playFairySuccessFlight().then(completeFairyRoundSuccess);
    return;
  }

  stopFairySurprisedReaction();
  completeFairyRoundSuccess();
}

function completeFairyRoundSuccess() {

  animateQuestionProgressIncrement();

  // Use the same run-state progression logic as a normal successful catch,
  // but without driving the claw machine.
  let isFinalLevel = false;
  let completedLevelIndex = 1;
  let totalLevels = 5;
  let totalAttempts = null;


  if (window.gameCookie) {
    const api = window.gameCookie;

    if (typeof api.handleLevelCompleted === "function") {
      api.handleLevelCompleted();
    }

    const state = typeof api.getRunState === "function" ? api.getRunState() : null;
    if (state) {
      completedLevelIndex =
        typeof state.levelsCompleted === "number" && state.levelsCompleted > 0
          ? state.levelsCompleted
          : (typeof state.currentLevelIndex === "number"
              ? state.currentLevelIndex
              : 1);
      totalLevels = typeof api.LEVELS_PER_RUN === "number"
        ? api.LEVELS_PER_RUN
        : 5;
      isFinalLevel = state.status === "complete" || completedLevelIndex >= totalLevels;
    }

    if (typeof api.getTotalDropAttemptsForRun === "function") {
      totalAttempts = api.getTotalDropAttemptsForRun();
    }
  }

  // Hide fairy options UI once the round is resolved.
  if (fairyOptionsContainer) {
    fairyOptionsContainer.style.display = "none";
  }

  if (isFinalLevel) {
    if (typeof window.playTotalVictory === "function") {
      window.playTotalVictory();
    }
    setTimeout(() => {
      showVictoryModal(true, completedLevelIndex, totalLevels, totalAttempts);
    }, 2000);
  } else {
    if (typeof window.playMiddleLevelSuccessSfx === "function") {
      window.playMiddleLevelSuccessSfx();
    }
    setTimeout(() => {
      void advanceToNextLevelWithoutOverlay();
    }, 2000);
  }
}

function showFairyGuidance() {
  if (fairyHasAppeared) return;

  if (!fairySpriteEl || !fairyAudio || !fairyGreetingAudio) {
    initFairyMedia();
  }

  fairyHasAppeared = true;
  // Skip human input/hint voices for the next prompt so they don’t overlap with the fairy.
  skipHintVoiceThisRound = true;

  // Fade out the input panel over 2 seconds and disable interaction.
  if (giftControlPanel) {
    giftControlPanel.style.transition = "opacity 2s ease-out";
    giftControlPanel.style.opacity = "0";
    giftControlPanel.style.pointerEvents = "none";
    setGiftKeyboardEnabled(false, true);
    setGiftPanelButtonsLocked(true);
  }

  // Hide the triangle that attaches to the bottom-right of the panel.
  if (giftPanelTriangleSvg) {
    giftPanelTriangleSvg.style.transition = "opacity 2s ease-out";
    giftPanelTriangleSvg.style.opacity = "0";
  }

  // Fade in the fairy spritesheet over 2 seconds and start loop playback.
  if (fairySpriteEl) {
    fairySpriteEl.style.transition = "opacity 2s ease-in";
    fairySpriteEl.style.opacity = "1";
    updateFairySpriteScale();

    if (fairySpriteAnimator) {
      fairySpriteAnimator.play();
    }
  }

  // Play greeting first; once it finishes, play the input guidance and
  // show the multiple-choice buttons.
  if (fairyGreetingAudio) {
    let advanced = false;
    const advanceToInputAndOptions = function () {
      if (advanced) return;
      advanced = true;
      if (fairyGreetingAudio) {
        fairyGreetingAudio.onended = null;
      }
      if (fairyAudio) {
        try {
          fairyAudio.currentTime = 0;
        } catch (_) {}
        playFairyMedia(fairyAudio);
      }
      showFairyOptionsForCurrentGift();
    };

    const greetingFallbackTimer = setTimeout(advanceToInputAndOptions, 8000);

    try {
      fairyGreetingAudio.currentTime = 0;
      fairyGreetingAudio.onended = function () {
        clearTimeout(greetingFallbackTimer);
        advanceToInputAndOptions();
      };
      playFairyMedia(fairyGreetingAudio).then(function (started) {
        if (!started) {
          clearTimeout(greetingFallbackTimer);
          advanceToInputAndOptions();
        }
      });
    } catch (_) {
      clearTimeout(greetingFallbackTimer);
      advanceToInputAndOptions();
    }
  } else {
    // No greeting audio: just play the input guidance and show options.
    if (fairyAudio) {
      try {
        fairyAudio.currentTime = 0;
      } catch (_) {}
      playFairyMedia(fairyAudio);
    }
    showFairyOptionsForCurrentGift();
  }
}

function startFairyMcSession() {
  if (typeof activeGiftValue !== "number") {
    spawnRandomGiftBox();
  }
  if (typeof activeGiftValue !== "number") {
    return false;
  }

  clearFairyState();
  showFairyGuidance();
  return true;
}

window.startFairyMcSession = startFairyMcSession;



// Track wrong attempts and show hints according to level / thresholds.
function handleWrongAttemptForHints() {
  if (typeof gameState.wrongAttemptsForHints !== "number") {
    gameState.wrongAttemptsForHints = 0;
  }
  gameState.wrongAttemptsForHints += 1;

  const level = getHintLevelFromRange();
  if (!level) return;

  const attempts = gameState.wrongAttemptsForHints;

  if (level === 1) {
    // Level 1: after 2 wrong attempts, fade in mark 5.
    if (attempts >= 2) {
      showHintLabelAt(5);
    }
    // After 3 wrong attempts, summon the fairy guidance.
    if (attempts >= 3) {
      showFairyGuidance();
    }
  } else if (level === 2) {
    // Level 2: after 2 wrong attempts, fade in 15.
    if (attempts >= 2) {
      showHintLabelAt(15);
    }
    // After 3 wrong attempts, summon the fairy guidance.
    if (attempts >= 3) {
      showFairyGuidance();
    }
  } else if (level === 3) {
    // Level 3: after 2 wrong attempts, fade in 10.
    if (attempts >= 2) {
      showHintLabelAt(10);
    }
    // After 3 wrong attempts, fade in 5 and 15.
    if (attempts >= 3) {
      showHintLabelAt(5);
      showHintLabelAt(15);
    }
    // After 4 wrong attempts, summon the fairy guidance.
    if (attempts >= 4) {
      showFairyGuidance();
    }
  }
}



// Render the bottom number line ticks and labels.
// Visuals are matched exactly to scale.txt: only 0 and the max value,
// white ticks, Impact-style font, and the same spacing.
function renderNumberLine(scale) {

  const ticksGroupBack = document.getElementById("ticksGroupBack");
  const labelsGroupBack = document.getElementById("labelsGroupBack");
  const ticksGroup = document.getElementById("ticksGroup");
  const labelsGroup = document.getElementById("labelsGroup");
  const mainAxis = document.getElementById("mainAxis");
  const mainAxisBack = document.getElementById("mainAxisBack");

  if (!ticksGroupBack || !labelsGroupBack || !ticksGroup || !labelsGroup) {
    return;
  }

  // Clear previous elements to avoid overlapping when re-rendering
  ticksGroupBack.innerHTML = "";
  labelsGroupBack.innerHTML = "";
  ticksGroup.innerHTML = "";
  labelsGroup.innerHTML = "";

  if (mainAxisBack) {
    mainAxisBack.setAttribute("stroke-width", "30");
    mainAxisBack.style.filter = "none";
  }

  if (mainAxis) {
    mainAxis.setAttribute("stroke-width", "22.5");
    mainAxis.style.filter =
      "drop-shadow(1vh 0 0 #000) drop-shadow(-1vh 0 0 #000) drop-shadow(0 1vh 0 #000) drop-shadow(0 -1vh 0 #000)";
  }

  // Canvas layout parameters in the 5000-unit SVG coordinate space.
  // Keep a 10% margin on each side so ticks align with the visible axis.
  const startX = 50;
  const endX = 4950;
  const yCenter = 80;
  const tickHalfHeight = 150; // 5x original: symmetrical height above/below the line
  const totalWidth = endX - startX;
  const backOffsetX = 4;
  const backOffsetY = 4;
  function appendTickAndLabel(groupTicks, groupLabels, xPos, yPos, value, strokeColor, fillColor, opacity, fontSize, markerWidth) {
    const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
    tick.setAttribute("x1", xPos);
    tick.setAttribute("y1", yPos - tickHalfHeight);
    tick.setAttribute("x2", xPos);
    tick.setAttribute("y2", yPos); // + tickHalfHeight);
    tick.setAttribute("stroke", strokeColor);
    tick.setAttribute("stroke-width", markerWidth);
    tick.setAttribute("opacity", opacity);
    if (groupTicks === ticksGroup) {
      tick.style.filter =
        "drop-shadow(1vh 0 0 #000) drop-shadow(-1vh 0 0 #000) drop-shadow(0 1vh 0 #000) drop-shadow(0 -1vh 0 #000)";
    }
    groupTicks.appendChild(tick);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", xPos);
    label.setAttribute("y", yPos - 200); // + tickHalfHeight
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("fill", fillColor);
    label.setAttribute("font-family", "Impact, Arial, sans-serif");
    label.setAttribute("font-size", fontSize);
    label.setAttribute("opacity", opacity);
    if (groupLabels === labelsGroup) {
      label.style.filter =
        "drop-shadow(1vh 0 0 #000) drop-shadow(-1vh 0 0 #000) drop-shadow(0 1vh 0 #000) drop-shadow(0 -1vh 0 #000)";
    }
    label.textContent = String(value);
    groupLabels.appendChild(label);
  }

    // Always draw ticks at 0 and at 20 on the visual number line.
  const fixedMin = 0;
  const fixedMax = 20;
  const values = [fixedMin, fixedMax];
  values.forEach((value) => {
    const xPos = startX + (value / fixedMax) * totalWidth;
    appendTickAndLabel(
      ticksGroupBack,
      labelsGroupBack,
      xPos + backOffsetX,
      yCenter + backOffsetY,
      value,
      "rgba(150,150,150,0.75)",
      "rgba(150,150,150,0.8)",
      "0.8",
      "240",
      "24"
    );
    appendTickAndLabel(
      ticksGroup,
      labelsGroup,
      xPos,
      yCenter,
      value,
      "white",
      "white",
      "1",
      "360",
      "22.5"
    );
  });

  // If the playable range is a proper subset of [0, 20], add an extra tick at 10.
  const minNumber = typeof gameState.rangeMin === "number" ? gameState.rangeMin : fixedMin;
  const maxNumber = typeof gameState.rangeMax === "number" ? gameState.rangeMax : fixedMax;
  if (minNumber !== fixedMin || maxNumber !== fixedMax) {
    const midValue = 10;
    const xPosMid = startX + (midValue / fixedMax) * totalWidth;
    appendTickAndLabel(
      ticksGroupBack,
      labelsGroupBack,
      xPosMid + backOffsetX,
      yCenter + backOffsetY,
      midValue,
      "rgba(150,150,150,0.75)",
      "rgba(150,150,150,0.8)",
      "0.8",
      "240",
      "24"
    );
    appendTickAndLabel(
      ticksGroup,
      labelsGroup,
      xPosMid,
      yCenter,
      midValue,
      "white",
      "white",
      "1",
      "360",
      "22.5"
    );
  }

}

// Initialise the number line after URL/game config has been read.
function initNumberLineFromGameConfig() {
  const svg = document.getElementById("numberLineSVG");
  const ticksGroupBack = document.getElementById("ticksGroupBack");
  const labelsGroupBack = document.getElementById("labelsGroupBack");
  const ticksGroup = document.getElementById("ticksGroup");
  const labelsGroup = document.getElementById("labelsGroup");

  if (!svg || !ticksGroupBack || !labelsGroupBack || !ticksGroup || !labelsGroup) {
    return;
  }

  const scale = getNumberLineScaleFromGameState();
  renderNumberLine(scale);
}

function spawnRandomGiftBox() {
  const svg = document.getElementById("numberLineSVG");
  if (!svg) return;

  if (typeof window.resetClawSuccessBear === "function") {
    window.resetClawSuccessBear();
  }

    const rect = svg.getBoundingClientRect();

  // Gifts should spawn within the logical playable range.
  const minNumber = typeof gameState.rangeMin === "number" ? gameState.rangeMin : 0;
  const maxNumber = typeof gameState.rangeMax === "number" && gameState.rangeMax > minNumber
    ? gameState.rangeMax
    : 20;

  // Planned per-run value: distinct across the 5 rounds, with lower/upper
  // coverage when both halves exist.
  const v = getPlannedGiftValue(minNumber, maxNumber);

  const startX = 50;
  const endX = 4950;
  const totalWidth = endX - startX;
  const fullScaleMax = 20;
  const xSvg = startX + (v / fullScaleMax) * totalWidth;


  const viewBoxWidth = 5000;
  const ratioX = xSvg / viewBoxWidth;
  const screenX = rect.left + ratioX * rect.width;

  // Remove any previous debug gift box.
  if (activeGiftBox && activeGiftBox.parentNode) {
    activeGiftBox.parentNode.removeChild(activeGiftBox);
  }

    // Reset gift-related state.
  activeGiftBox = null;
  activeGiftValue = null;
  pendingCatchGift = false;
  hasCaughtGift = false;
  caughtGiftEl = null;

  // Reset the current round attempt log whenever a new gift appears.
  resetCurrentRoundGuesses();

  // Create a new gift box overlay centred at the chosen number-line position.

    const box = document.createElement("div");
  box.className = "gift-box";
  box.style.left = `${screenX}px`;
  const targetGiftY = window.innerHeight * 0.675;
  box.style.top = `${targetGiftY}px`;
  box.style.zIndex = "1995";

  // Use an image as the gift marker.
  const icon = document.createElement("img");
  icon.src = "./golden_key.png";
  icon.alt = "Gift";
  icon.style.pointerEvents = "none";
  box.appendChild(icon);


  document.body.appendChild(box);

  activeGiftBox = box;
  activeGiftValue = v;

  // Bring up the input panel for the child to enter the gift position.
  if (typeof showGiftInputPromptForGift === "function") {
    showGiftInputPromptForGift();
  }
}

function computeStarCount(totalAttempts, levelNo) {
  const starThresholdMatrix = [
    [7, 10],
    [10, 15],
    [10, 15],
  ];

  const attempts = Number(totalAttempts);
  const thresholds = starThresholdMatrix[Math.max(0, (levelNo || 1) - 1)] || starThresholdMatrix[0];
  if (attempts <= thresholds[0]) return 3;
  if (attempts <= thresholds[1]) return 2;
  return 1;
}

function spawnStarSparkles(starEl) {
  if (!starEl) return;
  const sparklesToCreate = 6;
  for (let i = 0; i < sparklesToCreate; i++) {
    const sparkle = document.createElement("div");
    sparkle.className = "star-sparkle";
    const angle = Math.random() * Math.PI * 2;
    const distance = (starEl.offsetHeight || 0) * (0.4 + Math.random() * 0.4);
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    sparkle.style.setProperty("--sparkleX", `${dx}px`);
    sparkle.style.setProperty("--sparkleY", `${dy}px`);
    starEl.appendChild(sparkle);
    setTimeout(() => {
      sparkle.remove();
    }, 1000);
  }
}

let finalVictoryBalloonLayer = null;
let finalVictoryBalloonSpawnTimer = null;
let finalVictoryBalloonStopTimer = null;
let finalVictoryBalloonRunId = 0;
let victoryTimelineRunId = 0;
let victoryTimelineTimers = [];
let victoryConfettiLayer = null;
let victoryConfettiSpawnTimer = null;
let victoryConfettiRunId = 0;
let victoryBearAnimator = null;
let victoryMedalAudio = null;
let victoryMedalFadeAnimationId = null;
let victoryAttemptsCountAnimationId = null;
let pausedNormalMediaForVictory = [];
let hasPausedNormalMediaForVictory = false;

const victoryBearWaveDescriptor = {
  id: "orange-bear-victory-wave",
  png: "./orange_bear-jumping_waving_hands.png",
  frameWidth: 256,
  frameHeight: 256,
  columns: 4,
  totalFrames: 16,
  frameDurationMs: 90,
  loop: true,
};

const victoryBearWaveSequence = [8, 9, 10, 11, 12, 13, 14, 15, 14, 13, 12, 11, 10, 9];

function clearVictoryTimelineTimers() {
  if (!victoryTimelineTimers.length) {
    return;
  }

  victoryTimelineTimers.forEach((timerId) => {
    window.clearTimeout(timerId);
  });
  victoryTimelineTimers = [];
}

function scheduleVictoryTimeline(runId, delayMs, callback) {
  const timerId = window.setTimeout(() => {
    if (runId !== victoryTimelineRunId) {
      return;
    }
    callback();
  }, delayMs);
  victoryTimelineTimers.push(timerId);
}

function ensureVictoryBearAnimator() {
  if (!victoryBearSprite) {
    return null;
  }

  if (!victoryBearAnimator) {
    victoryBearAnimator = createSpritesheetPlayer(victoryBearSprite, victoryBearWaveDescriptor);
  }

  return victoryBearAnimator;
}

function ensureVictoryConfettiLayer() {
  if (victoryConfettiLayer) {
    return victoryConfettiLayer;
  }

  const layer = document.createElement("div");
  layer.id = "victoryConfettiLayer";
  layer.className = "victory-confetti-layer";
  document.body.appendChild(layer);
  victoryConfettiLayer = layer;
  return layer;
}

function spawnVictoryConfettiPieces(pieceCount) {
  const layer = ensureVictoryConfettiLayer();
  if (!layer) {
    return;
  }

  for (let i = 0; i < pieceCount; i += 1) {
    const piece = document.createElement("div");
    piece.className = "victory-confetti-piece";

    const hue = Math.floor(Math.random() * 360);
    const saturation = 86 + Math.random() * 11;
    const lightness = 52 + Math.random() * 17;
    const startX = 2 + Math.random() * 96;
    const driftX = -11 + Math.random() * 22;
    const pieceWidth = 0.2 + Math.random() * 0.35;
    const pieceLength = 0.7 + Math.random() * 2.1;
    const spinStart = Math.floor(Math.random() * 360);
    const duration = 1.8 + Math.random() * 2.2;
    const delay = Math.random() * 0.3;

    piece.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    piece.style.setProperty("--start-x", `${startX}%`);
    piece.style.setProperty("--drift-x", `${driftX}vw`);
    piece.style.setProperty("--piece-width", `${pieceWidth}rem`);
    piece.style.setProperty("--piece-length", `${pieceLength}rem`);
    piece.style.setProperty("--spin-start", `${spinStart}deg`);
    piece.style.setProperty("--fall-duration", `${duration}s`);
    piece.style.setProperty("--fall-delay", `${delay}s`);

    piece.addEventListener("animationend", () => {
      piece.remove();
    }, { once: true });

    layer.appendChild(piece);
  }
}

function startVictoryConfettiLoop() {
  const runId = ++victoryConfettiRunId;

  if (victoryConfettiSpawnTimer != null) {
    window.clearInterval(victoryConfettiSpawnTimer);
    victoryConfettiSpawnTimer = null;
  }

  const layer = ensureVictoryConfettiLayer();
  if (layer) {
    layer.innerHTML = "";
  }

  spawnVictoryConfettiPieces(24);

  victoryConfettiSpawnTimer = window.setInterval(() => {
    if (runId !== victoryConfettiRunId) {
      return;
    }
    spawnVictoryConfettiPieces(10);
  }, 220);
}

function stopVictoryConfettiLoop() {
  victoryConfettiRunId += 1;

  if (victoryConfettiSpawnTimer != null) {
    window.clearInterval(victoryConfettiSpawnTimer);
    victoryConfettiSpawnTimer = null;
  }

  if (victoryConfettiLayer) {
    victoryConfettiLayer.innerHTML = "";
    victoryConfettiLayer.remove();
    victoryConfettiLayer = null;
  }
}

function stopVictoryMedalAudio() {
  if (victoryMedalFadeAnimationId != null) {
    window.cancelAnimationFrame(victoryMedalFadeAnimationId);
    victoryMedalFadeAnimationId = null;
  }

  if (!victoryMedalAudio) {
    return;
  }

  try {
    victoryMedalAudio.pause();
    victoryMedalAudio.currentTime = 0;
    victoryMedalAudio.volume = 0;
  } catch (_) {}

  resumeNormalAudioAfterVictoryMedal();

  if (typeof window.resumePrepBgMusicLoop === "function") {
    try {
      window.resumePrepBgMusicLoop();
    } catch (_) {}
  }
}

function fadeOutNormalBackgroundMusicOnVictoryOverlayStart() {
  if (typeof window.fadeOutPrepBgMusicLoop === "function") {
    try {
      window.fadeOutPrepBgMusicLoop(1000);
      return;
    } catch (_) {}
  }

  if (typeof window.stopPrepBgMusicLoop === "function") {
    try {
      window.stopPrepBgMusicLoop();
    } catch (_) {}
  }
}

function collectNormalMediaForVictoryPause() {
  const mediaSet = new Set();

  try {
    document.querySelectorAll("audio, video").forEach((media) => {
      if (media && media !== victoryMedalAudio) {
        mediaSet.add(media);
      }
    });
  } catch (_) {}

  [fairyAudio, fairyGreetingAudio, fairyUltFailAudio, humanOverflowAudio].forEach((media) => {
    if (media && media !== victoryMedalAudio) {
      mediaSet.add(media);
    }
  });

  return Array.from(mediaSet);
}

function pauseNormalAudioForVictoryMedal() {
  pausedNormalMediaForVictory = [];
  hasPausedNormalMediaForVictory = false;

  const mediaCandidates = collectNormalMediaForVictoryPause();
  mediaCandidates.forEach((media) => {
    try {
      if (!media.paused && !media.ended) {
        pausedNormalMediaForVictory.push(media);
        media.pause();
      }
    } catch (_) {}
  });

  hasPausedNormalMediaForVictory = pausedNormalMediaForVictory.length > 0;
}

function resumeNormalAudioAfterVictoryMedal() {
  if (!hasPausedNormalMediaForVictory) {
    pausedNormalMediaForVictory = [];
    return;
  }

  pausedNormalMediaForVictory.forEach((media) => {
    try {
      const playPromise = media.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise.catch(() => {});
      }
    } catch (_) {}
  });

  pausedNormalMediaForVictory = [];
  hasPausedNormalMediaForVictory = false;
}

function fadeInVictoryMedalAudio(runId) {
  if (!victoryMedalAudio) {
    victoryMedalAudio = new Audio("./Gold_Medal_Run.mp3");
    victoryMedalAudio.preload = "auto";
    victoryMedalAudio.loop = true;
  }

  try {
    victoryMedalAudio.pause();
    victoryMedalAudio.currentTime = 0;
  } catch (_) {}

  victoryMedalAudio.volume = 0;
  victoryMedalAudio.loop = true;

  try {
    if (typeof victoryMedalAudio.load === "function") {
      victoryMedalAudio.load();
    }
  } catch (_) {}

  const beginFade = () => {
    pauseNormalAudioForVictoryMedal();

    const fadeDurationMs = 1200;
    const fadeStart = performance.now();

    if (victoryMedalFadeAnimationId != null) {
      window.cancelAnimationFrame(victoryMedalFadeAnimationId);
      victoryMedalFadeAnimationId = null;
    }

    const tickFade = (now) => {
      if (runId !== victoryTimelineRunId) {
        return;
      }

      const elapsed = Math.max(0, now - fadeStart);
      const progress = Math.min(elapsed / fadeDurationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 2);
      victoryMedalAudio.volume = Math.max(0, Math.min(eased, 1));

      if (progress >= 1) {
        victoryMedalFadeAnimationId = null;
        return;
      }

      victoryMedalFadeAnimationId = window.requestAnimationFrame(tickFade);
    };

    victoryMedalFadeAnimationId = window.requestAnimationFrame(tickFade);
  };

  let playPromise = null;
  try {
    playPromise = victoryMedalAudio.play();
  } catch (syncErr) {
    console.error("[victoryMedalAudio] synchronous play error", syncErr);
    return;
  }

  if (playPromise && typeof playPromise.then === "function") {
    playPromise
      .then(() => {
        if (runId !== victoryTimelineRunId) {
          return;
        }
        beginFade();
      })
      .catch((err) => {
        console.error("[victoryMedalAudio] play() rejected", err);
      });
    return;
  }

  beginFade();
}

function getVictoryBearCenter() {
  const viewportWidth = window.innerWidth || 0;
  const viewportHeight = window.innerHeight || 0;
  const headerHeight = viewportHeight * 0.15;
  const nonHeaderHeight = Math.max(0, viewportHeight - headerHeight);

  return {
    x: viewportWidth * 0.5,
    y: headerHeight + nonHeaderHeight * 0.5,
    size: viewportHeight * 0.4,
  };
}

function updateVictoryStarPositions() {
  if (!victoryStarsContainer || victoryStarsContainer.classList.contains("hidden")) {
    return;
  }

  const stars = Array.from(victoryStarsContainer.querySelectorAll(".victory-star"));
  if (!stars.length) {
    return;
  }

  const bearCenter = getVictoryBearCenter();
  const topCenterY = bearCenter.y - bearCenter.size * 0.5 - window.innerHeight * 0.1;
  const spacingPx = window.innerWidth * 0.15;

  stars.forEach((starEl) => {
    let x = bearCenter.x;
    if (starEl.classList.contains("is-left")) {
      x = bearCenter.x - spacingPx;
    } else if (starEl.classList.contains("is-right")) {
      x = bearCenter.x + spacingPx;
    }

    starEl.style.left = `${x}px`;
    starEl.style.top = `${topCenterY}px`;
  });
}

function updateVictoryCelebrationLayout() {
  if (!victoryBearSprite) {
    return;
  }

  const bearCenter = getVictoryBearCenter();
  const spriteScale = bearCenter.size / 256;

  victoryBearSprite.style.left = `${bearCenter.x}px`;
  victoryBearSprite.style.top = `${bearCenter.y}px`;
  victoryBearSprite.style.transform = `translate(-50%, -50%) scale(${spriteScale})`;

  if (victoryExtraText && !victoryExtraText.classList.contains("hidden")) {
    const bearTopY = bearCenter.y - bearCenter.size * 0.5;
    const extraTopY = bearTopY + bearCenter.size * 0.6;
    victoryExtraText.style.left = `${bearCenter.x}px`;
    victoryExtraText.style.top = `${extraTopY}px`;
  }

  updateVictoryStarPositions();
}

function stopVictoryAttemptsCounterAnimation() {
  if (victoryAttemptsCountAnimationId != null) {
    window.cancelAnimationFrame(victoryAttemptsCountAnimationId);
    victoryAttemptsCountAnimationId = null;
  }
}

function resetVictoryAttemptsText() {
  stopVictoryAttemptsCounterAnimation();
  if (!victoryExtraText) {
    return;
  }

  victoryExtraText.classList.add("hidden");
  victoryExtraText.classList.remove("is-finalized");
  if (victoryExtraTextValue) {
    victoryExtraTextValue.textContent = "0次";
  } else {
    victoryExtraText.textContent = "0次";
  }
}

function startVictoryAttemptsCounter(totalAttempts, runId) {
  if (!victoryExtraText) {
    return;
  }

  stopVictoryAttemptsCounterAnimation();

  const targetAttempts = Math.max(0, Math.floor(Number(totalAttempts) || 0));
  const durationMs = 1800;
  const startTs = performance.now();

  victoryExtraText.classList.remove("hidden");
  victoryExtraText.classList.remove("is-finalized");

  const renderValue = (value) => {
    const safeValue = Math.max(0, Math.floor(Number(value) || 0));
    if (victoryExtraTextValue) {
      victoryExtraTextValue.textContent = `${safeValue}次`;
    } else {
      victoryExtraText.textContent = `${safeValue}次`;
    }
  };

  renderValue(0);
  updateVictoryCelebrationLayout();

  const tick = (now) => {
    if (runId !== victoryTimelineRunId) {
      return;
    }

    const elapsed = Math.max(0, now - startTs);
    const progress = Math.min(elapsed / durationMs, 1);
    const eased = 1 - Math.pow(1 - progress, 2);
    renderValue(Math.round(targetAttempts * eased));

    if (progress >= 1) {
      renderValue(targetAttempts);
      victoryExtraText.classList.add("is-finalized");
      victoryAttemptsCountAnimationId = null;
      return;
    }

    victoryAttemptsCountAnimationId = window.requestAnimationFrame(tick);
  };

  victoryAttemptsCountAnimationId = window.requestAnimationFrame(tick);
}

function stopVictoryCelebrationEffects() {
  clearVictoryTimelineTimers();
  stopVictoryConfettiLoop();
  stopVictoryMedalAudio();
  stopVictoryAttemptsCounterAnimation();

  if (victoryBearAnimator) {
    victoryBearAnimator.stop();
    victoryBearAnimator.setFrame(8);
  }

  if (victoryBearSprite) {
    victoryBearSprite.classList.remove("is-visible");
  }

  if (victoryCelebrationArea) {
    victoryCelebrationArea.classList.add("hidden");
  }

  if (victoryStarsContainer) {
    victoryStarsContainer.classList.add("hidden");
    victoryStarsContainer.innerHTML = "";
  }

  resetVictoryAttemptsText();
}

function startFinalVictoryCelebrationTimeline(starCount, totalAttempts) {
  const runId = ++victoryTimelineRunId;
  clearVictoryTimelineTimers();

  scheduleVictoryTimeline(runId, 4000, () => {
    if (victoryCelebrationArea) {
      victoryCelebrationArea.classList.remove("hidden");
    }

    const animator = ensureVictoryBearAnimator();
    if (animator) {
      animator.play(victoryBearWaveSequence);
    }

    updateVictoryCelebrationLayout();

    if (victoryBearSprite) {
      victoryBearSprite.classList.add("is-visible");
    }

    if (victoryStarsContainer) {
      victoryStarsContainer.classList.remove("hidden");
    }

    startVictoryAttemptsCounter(totalAttempts, runId);

    animateFinalVictoryStars(starCount, function () {
      const hasFullStars = starCount >= 3;
      if (!hasFullStars) {
        if (typeof window.playMoreStarVoice === "function") {
          window.playMoreStarVoice();
        }
      }
    });
  });

  scheduleVictoryTimeline(runId, 5000, () => {
    fadeInVictoryMedalAudio(runId);
  });

  scheduleVictoryTimeline(runId, 6000, () => {
    startVictoryConfettiLoop();
  });
}

window.addEventListener("resize", () => {
  if (!victoryModal || victoryModal.classList.contains("hidden")) {
    return;
  }
  updateVictoryCelebrationLayout();
});

function ensureFinalVictoryBalloonLayer() {
  if (finalVictoryBalloonLayer) {
    return finalVictoryBalloonLayer;
  }

  const layer = document.createElement("div");
  layer.id = "finalVictoryBalloonLayer";
  layer.style.position = "fixed";
  layer.style.inset = "0";
  layer.style.overflow = "hidden";
  layer.style.pointerEvents = "none";
  layer.style.zIndex = "2010";
  document.body.appendChild(layer);
  finalVictoryBalloonLayer = layer;
  return layer;
}

function clearFinalVictoryBalloonEffects() {
  finalVictoryBalloonRunId += 1;
  if (finalVictoryBalloonSpawnTimer != null) {
    window.clearInterval(finalVictoryBalloonSpawnTimer);
    finalVictoryBalloonSpawnTimer = null;
  }
  if (finalVictoryBalloonStopTimer != null) {
    window.clearTimeout(finalVictoryBalloonStopTimer);
    finalVictoryBalloonStopTimer = null;
  }
  if (finalVictoryBalloonLayer) {
    finalVictoryBalloonLayer.innerHTML = "";
    finalVictoryBalloonLayer.remove();
    finalVictoryBalloonLayer = null;
  }
}

function spawnFinalVictoryBalloon() {
  return;
}

function getFinalVictoryBalloonCount(starCount) {
  if (starCount >= 3) return 15;
  if (starCount === 2) return 10;
  return 5;
}

function startFinalVictoryBalloonEffects(starCount) {
  clearFinalVictoryBalloonEffects();
  return;
}

function getVictoryStarSlotClass(index, starCount) {
  if (starCount <= 1) {
    return "is-center";
  }
  if (starCount === 2) {
    return index === 0 ? "is-left" : "is-right";
  }
  if (index === 0) return "is-left";
  if (index === 1) return "is-center";
  return "is-right";
}

function animateFinalVictoryStars(starCount, onComplete) {
  if (!victoryStarsContainer) {
    if (typeof onComplete === "function") onComplete();
    return;
  }

  victoryStarsContainer.innerHTML = "";

  if (starCount <= 0) {
    if (typeof onComplete === "function") onComplete();
    return;
  }

  for (let i = 0; i < starCount; i++) {
    const starWrapper = document.createElement("div");
    starWrapper.className = "victory-star";
    starWrapper.classList.add(getVictoryStarSlotClass(i, starCount));
    const img = document.createElement("img");
    img.src = "./award_star.png";
    img.alt = "Star";
    img.className = "victory-star-image";
    starWrapper.appendChild(img);
    victoryStarsContainer.appendChild(starWrapper);
  }

  updateVictoryStarPositions();

  const stars = victoryStarsContainer.querySelectorAll(".victory-star");
  stars.forEach((starEl, index) => {
    const delayMs = index * 450;
    setTimeout(() => {
      if (!victoryModal || victoryModal.classList.contains("hidden")) {
        return;
      }
      starEl.classList.add("victory-star-pop");
      spawnStarSparkles(starEl);
      if (typeof window.playClawAttemptSuccess === "function") {
        window.playClawAttemptSuccess();
      }
      if (index === stars.length - 1 && typeof onComplete === "function") {
        setTimeout(onComplete, 200);
      }
    }, delayMs);
  });
}

let victoryActionInFlight = false;
let restartRunGeneration = 0;

function setVictoryButtonsBusy(isBusy) {
  const primaryBtn = document.getElementById("victoryPrimaryButton");
  const secondaryBtn = document.getElementById("victorySecondaryButton");

  if (primaryBtn) {
    primaryBtn.disabled = isBusy;
  }
  if (secondaryBtn) {
    secondaryBtn.disabled = isBusy;
  }
}

function showVictoryModal(isFinalLevel, completedLevelIndex, totalLevels, totalAttempts) {
  if (!victoryModal) return;

  const messageEl = document.getElementById("victoryMessage");
  const primaryBtn = document.getElementById("victoryPrimaryButton");
  const secondaryBtn = document.getElementById("victorySecondaryButton");
  const victoryButtons = document.getElementById("victoryButtons");
  const homeButton = document.getElementById("menuArrow");

  // Stop any previous success voice before starting a new one.
  if (typeof window.stopVictorySuccessVoice === "function") {
    window.stopVictorySuccessVoice();
  }

  stopVictoryCelebrationEffects();
  victoryModal.classList.remove("is-visible");

  // Reset text and star visibility.
  if (messageEl) {
    messageEl.style.display = "";
    messageEl.style.height = "";
    messageEl.textContent = "";
  }
  if (victoryHeadline) {
    victoryHeadline.classList.add("hidden");
  }
  if (victorySubheadline) {
    victorySubheadline.classList.add("hidden");
  }
  if (victoryStarsContainer) {
    victoryStarsContainer.classList.add("hidden");
    victoryStarsContainer.innerHTML = "";
  }
  if (victoryCelebrationArea) {
    victoryCelebrationArea.classList.add("hidden");
  }
  if (victoryBearSprite) {
    victoryBearSprite.classList.remove("is-visible");
  }
  if (victoryExtraText) {
    resetVictoryAttemptsText();
  }
  if (victoryButtons) {
    victoryButtons.classList.remove("ui-end-footer-actions");
  }
  if (homeButton && !isFinalLevel) {
    homeButton.classList.add("hidden");
  } else if (homeButton) {
    homeButton.classList.remove("hidden");
  }

  if (isFinalLevel) {
    const stars = computeStarCount(totalAttempts, totalLevels);

    /*if (victoryHeadline) {
      victoryHeadline.textContent = "🎉 你成功尋回全部鎖匙！";
      victoryHeadline.classList.remove("hidden");
      victoryHeadline.style.color = "#a44100";
    }
    if (victorySubheadline) {
      victorySubheadline.textContent = "你獲得了";
      victorySubheadline.classList.remove("hidden");
      victorySubheadline.style.color = "#a44100";
    }

    const hasFullStars = stars >= 3;
    if (!hasFullStars && victoryExtraText) {
      victoryExtraText.textContent = "下次估算得準確一些就可以得到多些星星了！";
      victoryExtraText.classList.remove("hidden");
    }*/

    if (primaryBtn) {
      primaryBtn.style.cssText = "";
      primaryBtn.textContent = "↺";
      primaryBtn.setAttribute("aria-label", "再次由第一關開始挑戰");
      primaryBtn.title = "再次由第一關開始挑戰";
      primaryBtn.onclick = handleRestartRunClick;
      primaryBtn.className = "victory-button ui-end-action-button";
      primaryBtn.disabled = false;
    }

    if (secondaryBtn) {
      secondaryBtn.style.cssText = "";
      secondaryBtn.textContent = "🏠︎";
      secondaryBtn.setAttribute("aria-label", "返回菜單");
      secondaryBtn.title = "返回菜單";
      secondaryBtn.onclick = handleReturnToMenuClick;
      secondaryBtn.className = "victory-button ui-end-action-button";
      secondaryBtn.classList.remove("hidden");
      secondaryBtn.disabled = false;
    }

    victoryModal.classList.remove("hidden");
    requestAnimationFrame(() => {
      if (!victoryModal.classList.contains("hidden")) {
        fadeOutNormalBackgroundMusicOnVictoryOverlayStart();
        victoryModal.classList.add("is-visible");
      }
    });

    startFinalVictoryCelebrationTimeline(stars, totalAttempts);
  } else {
    // Middle-level success: keep original text-based message.
    if (messageEl) {
      messageEl.textContent = `${completedLevelIndex} / ${totalLevels} 關 ✅`;

      messageEl.style.color = "#16a34a";
      messageEl.style.display = "";
    }

    if (primaryBtn) {
      primaryBtn.style.cssText = "";
      primaryBtn.textContent = "🞂";
      primaryBtn.setAttribute("aria-label", "下一關");
      primaryBtn.title = "下一關";
      primaryBtn.onclick = handleNextLevelClick;
      primaryBtn.className = "victory-button ui-end-action-button";
      primaryBtn.disabled = false;
    }

    if (secondaryBtn) {
      secondaryBtn.style.cssText = "";
      secondaryBtn.classList.add("hidden");
    }

    if (victoryButtons) {
      victoryButtons.classList.add("ui-end-footer-actions");
    }

    victoryModal.classList.remove("hidden");
    requestAnimationFrame(() => {
      if (!victoryModal.classList.contains("hidden")) {
        victoryModal.classList.add("is-visible");
      }
    });
  }
}


function hideVictoryModal() {
  clearFinalVictoryBalloonEffects();
  stopVictoryCelebrationEffects();
  victoryTimelineRunId += 1;

  const homeButton = document.getElementById("menuArrow");
  if (homeButton) {
    homeButton.classList.remove("hidden");
  }

  if (victoryModal) {
    victoryModal.classList.remove("is-visible");
    victoryModal.classList.add("hidden");
  }
}

async function advanceToNextLevelWithoutOverlay() {
  if (typeof window.playClawSuccessBearExit === "function") {
    await window.playClawSuccessBearExit();
  }

  if (window.gameCookie && typeof window.gameCookie.startLevelTimer === "function") {
    window.gameCookie.startLevelTimer();
  }

  resetHintState();
  spawnRandomGiftBox();
}

async function handleNextLevelClick() {
  if (victoryActionInFlight) {
    return;
  }
  victoryActionInFlight = true;
  setVictoryButtonsBusy(true);

  if (typeof window.stopVictorySuccessVoice === "function") {
    window.stopVictorySuccessVoice();
  }

  try {
    hideVictoryModal();
    await advanceToNextLevelWithoutOverlay();
  } finally {
    victoryActionInFlight = false;
    setVictoryButtonsBusy(false);
  }
}



function getCurrentRangeAndTolerance() {
  const rangeMin =
    typeof gameState.rangeMin === "number" && gameState.rangeMin >= 0
      ? gameState.rangeMin
      : 0;
  const rangeMax =
    typeof gameState.rangeMax === "number" && gameState.rangeMax > rangeMin
      ? gameState.rangeMax
      : 20;
  const clampTolerance =
    typeof gameState.clampTolerance === "number" && gameState.clampTolerance > 0
      ? gameState.clampTolerance
      : 1;

  return { rangeMin, rangeMax, clampTolerance };
}

function shuffleArrayInPlace(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = items[i];
    items[i] = items[j];
    items[j] = temp;
  }
  return items;
}

function getCurrentRunRoundIndex() {
  if (window.gameCookie && typeof window.gameCookie.getRunState === "function") {
    const state = window.gameCookie.getRunState();
    if (
      state &&
      typeof state.currentLevelIndex === "number" &&
      Number.isFinite(state.currentLevelIndex)
    ) {
      return Math.max(0, Math.floor(state.currentLevelIndex) - 1);
    }
  }

  return 0;
}

function buildDistinctRoundGiftPlan(rangeMin, rangeMax, roundsPerRun) {
  const min = Number.isFinite(rangeMin) ? Math.floor(rangeMin) : 0;
  const max = Number.isFinite(rangeMax) ? Math.floor(rangeMax) : 20;
  const rounds = Math.max(1, Math.floor(roundsPerRun) || 1);

  const allValues = [];
  for (let value = min; value <= max; value += 1) {
    allValues.push(value);
  }

  if (!allValues.length) {
    return [0];
  }

  if (allValues.length <= rounds) {
    const uniquePool = allValues.slice();
    shuffleArrayInPlace(uniquePool);
    while (uniquePool.length < rounds) {
      uniquePool.push(allValues[Math.floor(Math.random() * allValues.length)]);
    }
    return uniquePool.slice(0, rounds);
  }

  // Ensure one from each half when possible.
  // For 0-20 this guarantees one from 0-10 and one from 11-20.
  const split = Math.floor((min + max) / 2);
  const lowerHalf = allValues.filter((value) => value <= split);
  const upperHalf = allValues.filter((value) => value > split);

  const required = [];
  if (lowerHalf.length && upperHalf.length) {
    required.push(lowerHalf[Math.floor(Math.random() * lowerHalf.length)]);
    const upperPick = upperHalf[Math.floor(Math.random() * upperHalf.length)];
    if (!required.includes(upperPick)) {
      required.push(upperPick);
    }
  }

  const remaining = allValues.filter((value) => !required.includes(value));
  shuffleArrayInPlace(remaining);

  const plan = required.slice();
  while (plan.length < rounds && remaining.length) {
    plan.push(remaining.pop());
  }

  shuffleArrayInPlace(plan);
  return plan.slice(0, rounds);
}

function ensureRoundGiftPlan(rangeMin, rangeMax) {
  const runState =
    window.gameCookie && typeof window.gameCookie.getRunState === "function"
      ? window.gameCookie.getRunState()
      : null;
  const attemptId = runState && runState.attemptId ? String(runState.attemptId) : "no-attempt";
  const planKey = `${rangeMin}-${rangeMax}-${attemptId}`;

  if (
    roundGiftPlanKey === planKey &&
    Array.isArray(roundGiftPlan) &&
    roundGiftPlan.length === QUESTION_PROGRESS_TOTAL
  ) {
    return;
  }

  roundGiftPlan = buildDistinctRoundGiftPlan(rangeMin, rangeMax, QUESTION_PROGRESS_TOTAL);
  roundGiftPlanKey = planKey;
}

function getPlannedGiftValue(rangeMin, rangeMax) {
  ensureRoundGiftPlan(rangeMin, rangeMax);

  const roundIndex = Math.min(
    Math.max(0, getCurrentRunRoundIndex()),
    QUESTION_PROGRESS_TOTAL - 1
  );
  const planned = roundGiftPlan[roundIndex];

  if (Number.isFinite(planned)) {
    return planned;
  }

  return Math.floor(Math.random() * (rangeMax - rangeMin + 1)) + rangeMin;
}

// Play range-specific human overflow guidance when the input number
// exceeds the current playable range. The overflow detection logic
// itself is unchanged; this helper is only an additional voice track.
let humanOverflowAudio = null;

function playHumanOverflowVoiceForCurrentRange() {
  const { rangeMin, rangeMax } = getCurrentRangeAndTolerance();
  const fileName = `./voice_human_overflow_${rangeMin}_${rangeMax}.mp3`;

  const url =
    typeof window.sanitizeMediaUrl === "function"
      ? window.sanitizeMediaUrl(fileName)
      : fileName;

  if (!url) {
    return;
  }

  if (!humanOverflowAudio) {
    humanOverflowAudio = new Audio();
    humanOverflowAudio.preload = "auto";
  }

  try {
    humanOverflowAudio.src = url;
    humanOverflowAudio.currentTime = 0;
    humanOverflowAudio.play();
  } catch (_) {
    // If playback fails (missing file, browser restriction, etc.),
    // silently ignore so the core overflow behaviour remains intact.
  }
}


// ======================= SEN Estimation Profile (Smart Wrong Option) =======================

const SEN_PROFILE_STORAGE_KEY = "sen_claw_game_data";

function loadProfileData() {
  let root = {};

  try {
    const raw = window.localStorage ? window.localStorage.getItem(SEN_PROFILE_STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        root = parsed;
      }
    }
  } catch (_) {
    // localStorage may be unavailable; fall back to an in-memory profile.
  }

  // New structure: biasProfile.ranges["min-max"] = { zones: {low/mid/high}, successStreak }
  if (!root.biasProfile || typeof root.biasProfile !== "object") {
    root.biasProfile = { ranges: {} };
  } else if (!root.biasProfile.ranges && root.biasProfile.zones) {
    // Migrate legacy single-range structure into a "legacy" range key so we
    // don't discard existing data.
    const oldZones = root.biasProfile.zones;
    const oldSuccess =
      typeof root.biasProfile.successStreak === "number"
        ? root.biasProfile.successStreak
        : 0;
    root.biasProfile = {
      ranges: {
        legacy: {
          zones: oldZones,
          successStreak: oldSuccess,
        },
      },
    };
  } else if (!root.biasProfile.ranges) {
    root.biasProfile.ranges = {};
  }

  return root.biasProfile;
}

function getProfileRangeKey(rangeMin, rangeMax) {
  const min = Number.isFinite(rangeMin) ? rangeMin : 0;
  const max = Number.isFinite(rangeMax) ? rangeMax : 20;
  return `${min}-${max}`;
}

function ensureRangeProfile(biasProfile, rangeMin, rangeMax) {
  if (!biasProfile || typeof biasProfile !== "object") {
    biasProfile = { ranges: {} };
  }
  if (!biasProfile.ranges || typeof biasProfile.ranges !== "object") {
    biasProfile.ranges = {};
  }

  const key = getProfileRangeKey(rangeMin, rangeMax);
  let rangeProfile = biasProfile.ranges[key];

  if (!rangeProfile || typeof rangeProfile !== "object") {
    rangeProfile = {
      zones: {
        low: {
          under: 0,
          over: 0,
          missTotal: 0,
          under2: 0,
          under3: 0,
          over2: 0,
          over3: 0,
        },
        mid: {
          under: 0,
          over: 0,
          missTotal: 0,
          under2: 0,
          under3: 0,
          over2: 0,
          over3: 0,
        },
        high: {
          under: 0,
          over: 0,
          missTotal: 0,
          under2: 0,
          under3: 0,
          over2: 0,
          over3: 0,
        },
      },
      successStreak: 0,
    };
    biasProfile.ranges[key] = rangeProfile;
  } else {
    const zones = rangeProfile.zones || (rangeProfile.zones = {});
    ["low", "mid", "high"].forEach((name) => {
      const z = zones[name] || (zones[name] = {});
      if (typeof z.under !== "number") z.under = 0;
      if (typeof z.over !== "number") z.over = 0;
      if (typeof z.missTotal !== "number") z.missTotal = 0;
      if (typeof z.under2 !== "number") z.under2 = 0;
      if (typeof z.under3 !== "number") z.under3 = 0;
      if (typeof z.over2 !== "number") z.over2 = 0;
      if (typeof z.over3 !== "number") z.over3 = 0;
    });
    if (typeof rangeProfile.successStreak !== "number") {
      rangeProfile.successStreak = 0;
    }
  }

  return rangeProfile;
}



function saveProfileData(profile) {
  try {
    if (!window.localStorage) return;
    const raw = window.localStorage.getItem(SEN_PROFILE_STORAGE_KEY);
    let root = {};
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        root = parsed;
      }
    }

    // Preserve any existing fields (e.g. best_record) and attach the bias
    // profile alongside them.
    root.biasProfile = profile;
    window.localStorage.setItem(SEN_PROFILE_STORAGE_KEY, JSON.stringify(root));
  } catch (_) {
    // Swallow storage errors; the game should remain playable without
    // persistent profiling.
  }
}

function getRangeZoneForTarget(target, rangeMin, rangeMax) {
  if (!Number.isFinite(target)) return "mid";
  const span = rangeMax - rangeMin;
  if (!Number.isFinite(span) || span <= 0) return "mid";

  const normalized = (target - rangeMin) / span; // 0 → 1
  if (normalized <= 1 / 3) return "low";
  if (normalized >= 2 / 3) return "high";
  return "mid";
}

function resetCurrentRoundGuesses() {
  currentRoundGuesses = [];
}

function saveAttemptToHistory(target, guess, rangeMin, rangeMax) {
  if (!Number.isFinite(target) || !Number.isFinite(guess)) {
    return;
  }

  // Record in current-round log so Layer 1 can analyse the most recent
  // 3–4 misses for the active gift.
  const error = guess - target;
  const isHit = Math.abs(error) <= 1; // SEN rule: ±1 is treated as a hit

  currentRoundGuesses.push({ target, guess, isHit });

    // Update persistent bias profile (Layer 2), scoped to the current range
  // (so 0–10, 11–20, 0–20 each retain their own statistics).
  const biasProfile = loadProfileData();
  const rangeProfile = ensureRangeProfile(biasProfile, rangeMin, rangeMax);
  const zoneName = getRangeZoneForTarget(target, rangeMin, rangeMax);
  const zone = rangeProfile.zones[zoneName];

  if (isHit) {
    // Successful estimation: increase success streak and decay historical
    // bias slightly so recent improvement is recognised. Only the current
    // range's zones are decayed.
    rangeProfile.successStreak = (rangeProfile.successStreak || 0) + 1;

    Object.keys(rangeProfile.zones).forEach((key) => {
      const z = rangeProfile.zones[key];
      z.under = Math.floor(z.under * 0.8);
      z.over = Math.floor(z.over * 0.8);
      z.missTotal = Math.floor(z.missTotal * 0.8);
      z.under2 = Math.floor((typeof z.under2 === "number" ? z.under2 : 0) * 0.8);
      z.under3 = Math.floor((typeof z.under3 === "number" ? z.under3 : 0) * 0.8);
      z.over2 = Math.floor((typeof z.over2 === "number" ? z.over2 : 0) * 0.8);
      z.over3 = Math.floor((typeof z.over3 === "number" ? z.over3 : 0) * 0.8);
    });

    // After 5 consecutive successful attempts *within this range*, clear
    // stale bias for this range only.
    if (rangeProfile.successStreak >= 5) {
      Object.keys(rangeProfile.zones).forEach((key) => {
        const z = rangeProfile.zones[key];
        z.under = 0;
        z.over = 0;
        z.missTotal = 0;
        z.under2 = 0;
        z.under3 = 0;
        z.over2 = 0;
        z.over3 = 0;
      });
      rangeProfile.successStreak = 0;
    }
  } else {
    // Miss: reset success streak (for this range only) and accumulate
    // under/over bias and magnitude buckets.
    rangeProfile.successStreak = 0;
    zone.missTotal += 1;
    if (error < 0) {
      zone.under += 1;
      if (error === -2) zone.under2 += 1;
      else if (error === -3) zone.under3 += 1;
    } else if (error > 0) {
      zone.over += 1;
      if (error === 2) zone.over2 += 1;
      else if (error === 3) zone.over3 += 1;
    }
  }

  const contributionType = isHit
    ? "hit"
    : error < 0
      ? "underestimation"
      : error > 0
        ? "overestimation"
        : "exact";

  console.log(
    "[SEN] saveAttemptToHistory: target=%d, guess=%d, error=%d, isHit=%s, range=%s, zone=%s, contribution=%s, zoneStats={under:%d, over:%d, missTotal:%d, under2:%d, under3:%d, over2:%d, over3:%d}, successStreak(range)=%d",
    target,
    guess,
    error,
    isHit,
    getProfileRangeKey(rangeMin, rangeMax),
    zoneName,
    contributionType,
    zone.under,
    zone.over,
    zone.missTotal,
    zone.under2,
    zone.under3,
    zone.over2,
    zone.over3,
    rangeProfile.successStreak
  );

  saveProfileData(biasProfile);
}



function getSmartWrongOption(target, currentRoundGuessesParam, rangeMin, rangeMax) {
  if (!Number.isFinite(target)) {
    return target;
  }

  const candidateOffsetsAll = [-3, -2, 2, 3];
  let direction = null; // "under", "over", or null when inconclusive
  let biasSource = "fallback"; // "layer1", "layer2", "fallback"

  // ----- Layer 1: Local session analysis (current round) -----
  const roundGuesses = Array.isArray(currentRoundGuessesParam)
    ? currentRoundGuessesParam
    : currentRoundGuesses;

    const relevantMisses = roundGuesses.filter((attempt) => {
    return (
      attempt &&
      attempt.target === target &&
      !attempt.isHit &&
      Number.isFinite(attempt.guess)
    );
  });

  const recentMisses = relevantMisses.slice(-4);
  const missCount = recentMisses.length;

  let localUnderRatio = 0;
  let localOverRatio = 0;
  let localUnder2Count = 0;
  let localUnder3Count = 0;
  let localOver2Count = 0;
  let localOver3Count = 0;

  if (missCount >= 3) {
    let under = 0;
    let over = 0;
    recentMisses.forEach((attempt) => {
      const err = attempt.guess - target;
      if (err < 0) {
        under += 1;
        if (err === -2) localUnder2Count += 1;
        else if (err === -3) localUnder3Count += 1;
      } else if (err > 0) {
        over += 1;
        if (err === 2) localOver2Count += 1;
        else if (err === 3) localOver3Count += 1;
      }
    });

    localUnderRatio = under / missCount;
    localOverRatio = over / missCount;

    if (localUnderRatio >= 0.6) {
      direction = "under";
      biasSource = "layer1";
    } else if (localOverRatio >= 0.6) {
      direction = "over";
      biasSource = "layer1";
    }

    console.log(
      "[SEN] Layer1 (current round) for target=%d: missCount=%d, under=%d (%.2f), over=%d (%.2f), localBuckets={under2:%d, under3:%d, over2:%d, over3:%d}, direction=%s",
      target,
      missCount,
      under,
      localUnderRatio,
      over,
      localOverRatio,
      localUnder2Count,
      localUnder3Count,
      localOver2Count,
      localOver3Count,
      direction
    );
  } else {
    console.log(
      "[SEN] Layer1 (current round) for target=%d: insufficient misses (missCount=%d) for a clear tendency",
      target,
      missCount
    );
  }

  // ----- Layer 2: Persistent profile analysis (historical context) -----
  let histUnderRatio = 0;
  let histOverRatio = 0;
  let histUnder2 = 0;
  let histUnder3 = 0;
  let histOver2 = 0;
  let histOver3 = 0;
  let zoneNameForLog = null;
  let zoneForLog = null;


    if (!direction) {
    const biasProfile = loadProfileData();
    const rangeProfile = ensureRangeProfile(biasProfile, rangeMin, rangeMax);
    const zoneName = getRangeZoneForTarget(target, rangeMin, rangeMax);
    const zone = rangeProfile.zones[zoneName];
    zoneNameForLog = zoneName;
    zoneForLog = zone;

    if (zone && zone.missTotal >= 3) {
      histUnderRatio = zone.under / zone.missTotal;
      histOverRatio = zone.over / zone.missTotal;
      histUnder2 = typeof zone.under2 === "number" ? zone.under2 : 0;
      histUnder3 = typeof zone.under3 === "number" ? zone.under3 : 0;
      histOver2 = typeof zone.over2 === "number" ? zone.over2 : 0;
      histOver3 = typeof zone.over3 === "number" ? zone.over3 : 0;

      if (histUnderRatio >= 0.6) {
        direction = "under";
        biasSource = "layer2";
      } else if (histOverRatio >= 0.6) {
        direction = "over";
        biasSource = "layer2";
      }

      if (biasSource === "layer2") {
        // Highlight that Layer 2 has actively influenced the bias decision
        // using a styled console message.
        console.log(
          "%c[SEN] Layer2 BIAS ACTIVE%c target=%d, range=%s, zone=%s, direction=%s",
          "color:#10b981;font-weight:bold;",
          "color:inherit;",
          target,
          getProfileRangeKey(rangeMin, rangeMax),
          zoneName,
          direction
        );
      }
    }

    console.log(
      "[SEN] Layer2 (historical) for target=%d, range=%s, zone=%s: missTotal=%d, under=%d (%.2f), over=%d (%.2f), buckets={under2:%d, under3:%d, over2:%d, over3:%d}, direction=%s",
      target,
      getProfileRangeKey(rangeMin, rangeMax),
      zoneName,
      zone ? zone.missTotal : 0,
      zone ? zone.under : 0,
      histUnderRatio,
      zone ? zone.over : 0,
      histOverRatio,
      histUnder2,
      histUnder3,
      histOver2,
      histOver3,
      direction
    );
  }




  if (!direction) {
    console.log(
      "[SEN] Bias direction fallback for target=%d: no clear tendency in Layer1 or Layer2",
      target
    );
  }

  // If both layers are inconclusive, fall back to a neutral random direction.
  let offsetPool;
  if (direction === "under") {
    offsetPool = [-3, -2];
  } else if (direction === "over") {
    offsetPool = [2, 3];
  } else {
    offsetPool = candidateOffsetsAll.slice();
  }

  function buildCandidates(offsets) {
    const vals = [];
    offsets.forEach((off) => {
      const val = target + off;
      if (val >= rangeMin && val <= rangeMax && val !== target) {
        vals.push(val);
      }
    });
    return vals;
  }

  // Prefer offsets that match the inferred bias direction.
  let candidates = buildCandidates(offsetPool);

  // Boundary clipping: if the preferred direction yields no valid options,
  // fall back to the full set of ±2/±3 offsets.
  if (!candidates.length) {
    console.log(
      "[SEN] Boundary clipping for target=%d: offsetPool=%j yielded no candidates within [%d,%d]; falling back to full offsets",
      target,
      offsetPool,
      rangeMin,
      rangeMax
    );
    candidates = buildCandidates(candidateOffsetsAll);
  }

    if (!candidates.length) {
    // Extreme edge case (very tiny range): choose the nearest boundary that
    // is not equal to the target.
    const fallback = [];
    if (rangeMin !== target) fallback.push(rangeMin);
    if (rangeMax !== target && rangeMax !== rangeMin) fallback.push(rangeMax);
    if (fallback.length) {
      const chosenBoundary = fallback[Math.floor(Math.random() * fallback.length)];
      console.log(
        "[SEN] Extreme range fallback for target=%d: candidates empty, choosing boundary %d within [%d,%d]",
        target,
        chosenBoundary,
        rangeMin,
        rangeMax
      );
      return chosenBoundary;
    }

    // As a last resort, clamp target ±2 into the valid range.
    let val = target + 2;
    if (val < rangeMin) val = rangeMin;
    if (val > rangeMax) val = rangeMax;
    console.log(
      "[SEN] Final clamp fallback for target=%d: returning %d within [%d,%d]",
      target,
      val,
      rangeMin,
      rangeMax
    );
    return val;
  }

  // Use weighted selection when we have a clear direction and bucket data,
  // otherwise fall back to uniform random choice.
  const weights = [];
  let totalWeight = 0;

  candidates.forEach((val) => {
    const off = val - target;
    let w = 1; // base weight

    if (direction === "under") {
      if (off === -2) {
        w += localUnder2Count + histUnder2;
      } else if (off === -3) {
        w += localUnder3Count + histUnder3;
      }
    } else if (direction === "over") {
      if (off === 2) {
        w += localOver2Count + histOver2;
      } else if (off === 3) {
        w += localOver3Count + histOver3;
      }
    }

    weights.push({ value: val, weight: w, offset: off });
    totalWeight += w;
  });

  let chosen = null;

  if (totalWeight > 0) {
    const r = Math.random() * totalWeight;
    let acc = 0;
    for (let i = 0; i < weights.length; i++) {
      acc += weights[i].weight;
      if (r <= acc) {
        chosen = weights[i].value;
        break;
      }
    }
  }

  if (chosen == null) {
    chosen = candidates[Math.floor(Math.random() * candidates.length)];
  }

  console.log(
    "[SEN] getSmartWrongOption result: target=%d, range=[%d,%d], biasSource=%s, direction=%s, offsetPool=%j, candidates=%j, weights=%j, chosen=%d",
    target,
    rangeMin,
    rangeMax,
    biasSource,
    direction,
    offsetPool,
    candidates,
    weights,
    chosen
  );

  // Randomly pick one smart wrong option from the candidate list.
  return chosen;
}





async function handleRestartRunClick() {
  if (victoryActionInFlight) {
    return;
  }
  victoryActionInFlight = true;
  const runGeneration = ++restartRunGeneration;
  setVictoryButtonsBusy(true);

  if (typeof window.stopVictorySuccessVoice === "function") {
    window.stopVictorySuccessVoice();
  }

  try {
    hideVictoryModal();

    if (typeof window.playClawSuccessBearExit === "function") {
      await window.playClawSuccessBearExit();
    }

    if (runGeneration !== restartRunGeneration) {
      return;
    }

    resetQuestionProgress();

    const { rangeMin, rangeMax, clampTolerance } = getCurrentRangeAndTolerance();

    if (window.gameCookie) {
      if (typeof window.gameCookie.resetRunStateForNewAttempt === "function") {
        window.gameCookie.resetRunStateForNewAttempt(rangeMax, clampTolerance, rangeMin);
      }
      if (typeof window.gameCookie.initRunState === "function") {
        window.gameCookie.initRunState(rangeMax, clampTolerance, rangeMin);
      }
    }

    resetHintState();
    spawnRandomGiftBox();
  } finally {
    if (runGeneration === restartRunGeneration) {
      victoryActionInFlight = false;
      setVictoryButtonsBusy(false);
    }
  }
}

function buildForcedFinalVictoryState() {
  let completedLevelIndex = 1;
  let totalLevels = 5;
  let totalAttempts = null;

  if (window.gameCookie) {
    const api = window.gameCookie;

    totalLevels = typeof api.LEVELS_PER_RUN === "number" && api.LEVELS_PER_RUN > 0
      ? api.LEVELS_PER_RUN
      : 5;

    if (typeof api.getRunState === "function" && typeof api.handleLevelCompleted === "function") {
      const maxIterations = totalLevels + 2;
      for (let i = 0; i < maxIterations; i += 1) {
        const state = api.getRunState();
        const levelsDone = state && typeof state.levelsCompleted === "number" ? state.levelsCompleted : 0;
        const isComplete = state && (state.status === "complete" || levelsDone >= totalLevels);
        if (isComplete) {
          break;
        }
        if (typeof api.startLevelTimer === "function") {
          api.startLevelTimer();
        }
        api.handleLevelCompleted();
      }
    }

    const state = typeof api.getRunState === "function" ? api.getRunState() : null;
    if (state) {
      completedLevelIndex =
        typeof state.levelsCompleted === "number" && state.levelsCompleted > 0
          ? state.levelsCompleted
          : (typeof state.currentLevelIndex === "number" ? state.currentLevelIndex : totalLevels);
    } else {
      completedLevelIndex = totalLevels;
    }

    if (typeof api.getTotalDropAttemptsForRun === "function") {
      totalAttempts = api.getTotalDropAttemptsForRun();
    }
  } else {
    completedLevelIndex = totalLevels;
  }

  if (completedLevelIndex < totalLevels) {
    completedLevelIndex = totalLevels;
  }

  return {
    completedLevelIndex,
    totalLevels,
    totalAttempts,
  };
}

function endOrangeGameDirectly() {
  if (victoryActionInFlight) {
    return false;
  }

  const { completedLevelIndex, totalLevels, totalAttempts } = buildForcedFinalVictoryState();

  if (typeof window.stopVictorySuccessVoice === "function") {
    window.stopVictorySuccessVoice();
  }

  hideVictoryModal();

  if (typeof window.playTotalVictory === "function") {
    window.playTotalVictory();
  }

  showVictoryModal(true, completedLevelIndex, totalLevels, totalAttempts);
  return true;
}

window.endOrangeGameDirectly = endOrangeGameDirectly;


function handleReturnToMenuClick() {
  if (typeof window.stopVictorySuccessVoice === "function") {
    window.stopVictorySuccessVoice();
  }

  // Clear hint ticks/labels when returning to the menu.
  resetHintState();

  returnToMenu();
}


function returnToMenu() {

  wipeTransientRunProgress();

  const targetUrl = new URL("menu_2.html", window.location.href);

  setTimeout(() => {
    window.location.href = targetUrl.toString();
  }, 1200);
}

// Bootstraps game-2 after all media and visual assets are ready.
// This restores level-setting handling (range/tolerance), number-line
// setup, run-state timer, and the first gift box.

function waitForDocumentMediaReady(timeoutMs = 8000) {
  const mediaElements = Array.from(document.querySelectorAll("audio, video"));
  if (!mediaElements.length) {
    return Promise.resolve();
  }

  const perElementPromises = mediaElements.map((el) => {
    return new Promise((resolve) => {
      let done = false;
      const handleReady = () => {
        if (done) return;
        done = true;
        el.removeEventListener("canplaythrough", handleReady);
        el.removeEventListener("loadeddata", handleReady);
        resolve();
      };
      el.addEventListener("canplaythrough", handleReady, { once: true });
      el.addEventListener("loadeddata", handleReady, { once: true });

      // Safety net: if a particular media element never reports ready,
      // continue after a timeout so the game can still start.
      setTimeout(handleReady, timeoutMs);
    });
  });

  return Promise.all(perElementPromises);
}

function waitForEssentialImageAssetsReady(timeoutMs = 8000) {
  const perImagePromises = essentialGameImageUrls.map((rawUrl) => {
    return Promise.race([
      preloadImageAsset(rawUrl),
      new Promise((resolve) => {
        window.setTimeout(resolve, timeoutMs);
      }),
    ]);
  });

  return Promise.all(perImagePromises);
}

function waitForGameAssetsReady(timeoutMs = 8000) {
  // Wait for both the canvas visuals (background image) and any
  // document-level audio/video elements to be ready.
  return Promise.all([
    visualAssetsReadyPromise,
    waitForDocumentMediaReady(timeoutMs),
    waitForEssentialImageAssetsReady(timeoutMs),
  ]).catch(() => {
    // If anything fails to load, continue anyway so the game remains playable.
  });
}

async function bootstrapGame2() {
  await waitForGameAssetsReady();

    initGameConfigFromUrl();
  initNumberLineFromGameConfig();
  initGiftControlPanel();
  resetQuestionProgress();

  // Preload fairy spritesheet/audio so guidance can appear without delay.
  initFairyMedia();

  const { rangeMin, rangeMax, clampTolerance } = getCurrentRangeAndTolerance();
  if (window.gameCookie) {
    if (typeof window.gameCookie.resetRunStateForNewAttempt === "function") {
      window.gameCookie.resetRunStateForNewAttempt(rangeMax, clampTolerance, rangeMin);
    }
    if (typeof window.gameCookie.initRunState === "function") {
      window.gameCookie.initRunState(rangeMax, clampTolerance, rangeMin);
    }
  }

  resetHintState();
  spawnRandomGiftBox();


  // Once the game has finished bootstrapping, hide the preparation overlay.
  if (typeof window.hidePrepOverlay === "function") {
    // When the overlay has completely disappeared, start looping background music.
    window.onPrepOverlayHidden = function () {
      if (typeof window.playPrepBgMusicLoop === "function") {
        window.playPrepBgMusicLoop();
      }
    };
    window.hidePrepOverlay();
  }
}




if (document.readyState === "complete") {
  // If the page has already finished loading, start the game bootstrap immediately.
  bootstrapGame2();
} else {
  window.addEventListener("load", () => {
    bootstrapGame2();
  });
}