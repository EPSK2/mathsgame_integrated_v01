(function () {
  const AudioContext = window.AudioContext || window.webkitAudioContext;

  if (!AudioContext) {
    const noop = function () {};
    window.playPlaceCorrectSfx = noop;
    window.playPlaceWrongSfx = noop;
    window.playCorrectHappySfx = noop;
    window.playMiddleLevelSuccessSfx = noop;
    window.playClawAttemptFail = noop;
    window.playClawAttemptSuccess = noop;
    window.playTotalVictory = noop;
    window.playRunningGearSegment = noop;
    window.playPanelButtonClick = noop;
    window.playVictorySuccessVoice = noop;
    window.stopVictorySuccessVoice = noop;
    window.stopHumanInputErrorVoice = noop;
    window.playHintVoiceRound1 = noop;
    window.playHintVoiceRound2 = noop;
    window.playVoiceRoboticInput = noop;
    window.playVoiceRoboticFail = noop;
    window.playMoreStarVoice = noop;
    window.stopAllAudio = noop;
    window.stopAllSfx = noop;
    window.stopAllVoice = noop;
    window.stopAllGameAudio = noop;
    console.warn("Web Audio API not supported; audio disabled.");
    return;
  }

  const audioContext = new AudioContext();
  const buffers = {};
  const loadingPromises = {};
  const activeWebAudioSources = [];
  const elementFallbacks = {};
  const audioFiles = {
    sfxPlaceCorrect: null,
    sfxPlaceWrong: null,
    sfxCorrectHappy: null,
    sfxMiddleLevelSuccess: "middle_level_success.mp3",
    voiceHumanFail: "voice_human_fail.mp3",
    voiceHumanHopefulFail: "voice_human_hopeful_fail.mp3",
    clawAttemptFail: "claw_attempt_fail.mp3",
    clawAttemptSuccess: "claw_attempt_success.mp3",
    totalVictory: "total_victory.mp3",
    runningGear: "running_gear.mp3",
    panelButton: "panel_button.mp3",
    voiceVictorySuccess01: "voice_human_success_01.mp3",
    voiceVictorySuccess02: "voice_human_success_02.mp3",
    voiceVictorySuccess03: "voice_human_success_03.mp3",
    voiceVictorySuccess04: "voice_human_success_04.mp3",
    voiceVictorySuccess05: "voice_human_success_05.mp3",
    voiceHumanInput: "voice_human_input.mp3",
    voiceHumanHint: "voice_human_hint.mp3",
    voiceHumanHint2: "voice_human_hint_2.mp3",
    voiceMoreStar: "voice_human_morestar.mp3"
  };

  const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/g;

  function sanitizeMediaUrl(raw) {
    if (typeof window.sanitizeMediaUrl === "function") {
      return window.sanitizeMediaUrl(raw);
    }

    if (typeof raw !== "string") return null;
    const cleaned = raw.replace(CONTROL_CHARS_REGEX, "").trim();
    if (!cleaned) return null;

    try {
      const baseDir = window.location.href.substring(0, window.location.href.lastIndexOf("/") + 1);
      const urlObj = new URL(cleaned, baseDir);
      const protocol = urlObj.protocol;
      if (protocol !== "http:" && protocol !== "https:" && protocol !== "file:" && protocol !== "blob:" && protocol !== "data:") {
        console.warn("[Audio] disallowed protocol", { url: urlObj.toString() });
        return null;
      }
      return urlObj.toString();
    } catch (e) {
      console.warn("[Audio] invalid URL", { raw, error: e });
      return null;
    }
  }

  if (!window.sanitizeMediaUrl) {
    window.sanitizeMediaUrl = sanitizeMediaUrl;
  }

  function unlockAudioContextOnFirstInteraction() {
    const unlock = function () {
      if (audioContext.state === "suspended") {
        audioContext.resume().catch(function () {});
      }
      document.removeEventListener("click", unlock);
      document.removeEventListener("keydown", unlock);
      document.removeEventListener("touchstart", unlock);
    };
    document.addEventListener("click", unlock);
    document.addEventListener("keydown", unlock);
    document.addEventListener("touchstart", unlock);
  }

  unlockAudioContextOnFirstInteraction();

  function registerActiveSource(source) {
    if (!source) return;
    activeWebAudioSources.push(source);
    source.onended = function () {
      const idx = activeWebAudioSources.indexOf(source);
      if (idx >= 0) activeWebAudioSources.splice(idx, 1);
    };
  }

  function loadBuffer(id) {
    if (buffers[id]) {
      return Promise.resolve(buffers[id]);
    }
    const rawUrl = audioFiles[id];
    if (!rawUrl) {
      return Promise.reject(new Error("No audio file configured for id: " + id));
    }

    const url = sanitizeMediaUrl(rawUrl);
    if (!url) {
      return Promise.reject(new Error("Invalid audio URL for id: " + id));
    }

    if (!loadingPromises[id]) {
      loadingPromises[id] = fetch(url, { cache: "no-store" })
        .then(function (response) {
          if (!response.ok && response.status !== 0) {
            throw new Error("HTTP " + response.status + " while loading " + id);
          }
          return response.arrayBuffer();
        })
        .then(function (data) {
          return new Promise(function (resolve, reject) {
            audioContext.decodeAudioData(
              data,
              function (buffer) {
                resolve(buffer);
              },
              function (err) {
                reject(err || new Error("decodeAudioData failed for " + id));
              }
            );
          });
        })
        .then(function (buffer) {
          buffers[id] = buffer;
          return buffer;
        })
        .catch(function (err) {
          console.error("[Audio] Failed to load", id, "from", url, err);
          buffers[id] = null;
          return null;
        });
    }

    return loadingPromises[id];
  }

  function playWithElementFallback(id, options) {
    options = options || {};
    const rawUrl = audioFiles[id];
    if (!rawUrl) return null;

    const url = sanitizeMediaUrl(rawUrl);
    if (!url) return null;

    if (!elementFallbacks[id]) {
      const el = new Audio();
      el.preload = "auto";
      elementFallbacks[id] = el;
    }

    const mediaEl = elementFallbacks[id];
    try { mediaEl.pause(); } catch (_) {}
    try { mediaEl.currentTime = typeof options.offset === "number" ? Math.max(0, options.offset) : 0; } catch (_) { mediaEl.currentTime = 0; }

    if (typeof window.safePlayMedia === "function") {
      window.safePlayMedia(mediaEl, url);
    } else {
      mediaEl.src = url;
      mediaEl.play().catch(function () {});
    }

    if (typeof options.onended === "function") {
      mediaEl.onended = options.onended;
    }

    return mediaEl;
  }

  function playBuffer(id, options) {
    options = options || {};
    loadBuffer(id)
      .then(function (buffer) {
        if (!buffer) {
          return playWithElementFallback(id, options);
        }

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        const offset = typeof options.offset === "number" ? options.offset : 0;
        const duration = options.duration;
        try {
          if (typeof duration === "number") {
            source.start(0, offset, duration);
          } else {
            source.start(0, offset);
          }
        } catch (e) {
          console.error("[Audio] bufferSource.start() failed for", id, e);
          return null;
        }

        registerActiveSource(source);
        if (typeof options.onended === "function") {
          source.onended = options.onended;
        }
        return source;
      })
      .catch(function (err) {
        console.error("[Audio] playBuffer error for", id, err);
      });
  }

  let currentInputErrorSource = null;
  let inputErrorPlaybackGeneration = 0;

  function playExclusiveInputErrorVoice(id, options) {
    options = options || {};
    inputErrorPlaybackGeneration += 1;
    const playbackGeneration = inputErrorPlaybackGeneration;

    if (currentInputErrorSource) {
      try { currentInputErrorSource.stop(); } catch (_) {}
      currentInputErrorSource = null;
    }

    loadBuffer(id)
      .then(function (buffer) {
        if (!buffer || playbackGeneration !== inputErrorPlaybackGeneration) {
          return null;
        }

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        const offset = typeof options.offset === "number" ? options.offset : 0;
        const duration = options.duration;
        try {
          if (typeof duration === "number") {
            source.start(0, offset, duration);
          } else {
            source.start(0, offset);
          }
        } catch (e) {
          console.error("[Audio] exclusive playBuffer.start() failed for", id, e);
          return null;
        }

        currentInputErrorSource = source;
        source.onended = function () {
          if (currentInputErrorSource === source) {
            currentInputErrorSource = null;
          }
          if (typeof options.onended === "function") {
            options.onended();
          }
        };
        registerActiveSource(source);
        return source;
      })
      .catch(function (err) {
        console.error("[Audio] exclusive playBuffer error for", id, err);
      });
  }

  function stopHumanInputErrorVoice() {
    inputErrorPlaybackGeneration += 1;

    if (currentInputErrorSource) {
      try { currentInputErrorSource.stop(); } catch (_) {}
      currentInputErrorSource = null;
    }

    ["voiceHumanFail", "voiceHumanHopefulFail"].forEach(function (id) {
      const mediaEl = elementFallbacks[id];
      if (!mediaEl) return;
      try {
        mediaEl.pause();
        mediaEl.currentTime = 0;
      } catch (_) {}
    });
  }

  function stopAllAudio() {
    activeWebAudioSources.slice().forEach(function (source) {
      try { source.stop(); } catch (_) {}
    });
    activeWebAudioSources.length = 0;

    Object.keys(elementFallbacks).forEach(function (id) {
      try {
        elementFallbacks[id].pause();
        elementFallbacks[id].currentTime = 0;
      } catch (_) {}
    });
  }

  function stopAllSfx() {
    stopAllAudio();
  }

  function stopAllVoice() {
    stopAllAudio();
  }

  Object.keys(audioFiles).forEach(function (id) {
    if (audioFiles[id]) {
      loadBuffer(id).catch(function () {});
    }
  });

  window.playPlaceCorrectSfx = function () { playBuffer("sfxPlaceCorrect"); };
  window.playPlaceWrongSfx = function () { playBuffer("sfxPlaceWrong"); };
  window.playCorrectHappySfx = function () { playBuffer("sfxCorrectHappy"); };
  window.playMiddleLevelSuccessSfx = function () { playBuffer("sfxMiddleLevelSuccess"); };
  window.playHumanInputError = function (diff) {
    const abs = typeof diff === "number" ? Math.abs(diff) : NaN;
    const id = !Number.isNaN(abs) && abs <= 3 ? "voiceHumanHopefulFail" : "voiceHumanFail";
    playExclusiveInputErrorVoice(id);
  };
  window.playClawAttemptFail = function () { playBuffer("clawAttemptFail"); };
  window.playClawAttemptSuccess = function () { playBuffer("clawAttemptSuccess"); };
  window.playTotalVictory = function () { playBuffer("totalVictory"); };
  window.playRunningGearSegment = function () {
    loadBuffer("runningGear")
      .then(function (buffer) {
        if (!buffer) {
          playBuffer("runningGear", { offset: 3.5 });
          return;
        }
        const tailDuration = 5.5;
        const offset = Math.max(0, buffer.duration - tailDuration);
        playBuffer("runningGear", { offset: offset, duration: tailDuration });
      })
      .catch(function () {
        playBuffer("runningGear", { offset: 3.5 });
      });
  };
  window.playPanelButtonClick = function () { playBuffer("panelButton"); };

  const victoryIds = [
    "voiceVictorySuccess01",
    "voiceVictorySuccess02",
    "voiceVictorySuccess03",
    "voiceVictorySuccess04",
    "voiceVictorySuccess05"
  ];
  const activeVictorySources = [];
  const activeVictoryVoiceEndPromises = new Set();

  window.playVictorySuccessVoice = function () {
    const idx = Math.floor(Math.random() * victoryIds.length);
    const chosenId = victoryIds[idx];
    return loadBuffer(chosenId)
      .then(function (buffer) {
        if (!buffer) return;
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);
        registerActiveSource(source);
        activeVictorySources.push(source);

        const endPromise = new Promise(function (resolve) {
          source.onended = function () {
            const pos = activeVictorySources.indexOf(source);
            if (pos >= 0) activeVictorySources.splice(pos, 1);
            resolve();
          };
        });

        activeVictoryVoiceEndPromises.add(endPromise);
        endPromise.finally(function () {
          activeVictoryVoiceEndPromises.delete(endPromise);
        });

        return endPromise;
      })
      .catch(function () {});
  };

  window.waitForVictorySuccessVoiceCompletion = function (timeoutMs) {
    const pending = Array.from(activeVictoryVoiceEndPromises);
    if (pending.length === 0) {
      return Promise.resolve();
    }

    const allPending = Promise.all(
      pending.map(function (promise) {
        return promise.catch(function () {});
      })
    );

    const maxWait = Number(timeoutMs);
    if (!Number.isFinite(maxWait) || maxWait <= 0) {
      return allPending;
    }

    return Promise.race([
      allPending,
      new Promise(function (resolve) {
        window.setTimeout(resolve, maxWait);
      }),
    ]);
  };

  window.stopVictorySuccessVoice = function () {
    activeVictorySources.slice().forEach(function (source) {
      try { source.stop(); } catch (_) {}
    });
    activeVictorySources.length = 0;
  };

  window.playHintVoiceRound1 = function () { playBuffer("voiceHumanHint"); };
  window.playHintVoiceRound2 = function () { playBuffer("voiceHumanHint2"); };
  window.playVoiceRoboticInput = function () { playExclusiveInputErrorVoice("voiceHumanInput"); };
  window.playVoiceRoboticFail = function (diff) { window.playHumanInputError(diff); };
  window.playMoreStarVoice = function () { playBuffer("voiceMoreStar"); };
  window.stopHumanInputErrorVoice = stopHumanInputErrorVoice;

  window.stopAllAudio = stopAllAudio;
  window.stopAllSfx = stopAllSfx;
  window.stopAllVoice = stopAllVoice;
  window.stopAllGameAudio = stopAllAudio;
})();
