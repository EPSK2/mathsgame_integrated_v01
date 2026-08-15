(function () {
  "use strict";

  const DEFAULTS = {
    rootSelector: "#questionProgress",
    fillSelector: "#questionProgressFill",
    circlesSelector: ".question-progress-circle",
    tokenSelector: "#questionProgressToken",
    particleLayerSelector: ".question-progress-fill-particles",
    centeredClass: "is-centered-transition",
    filledClass: "is-filled",
    startClass: "is-start",
    tokenHiddenClass: "is-hidden-during-return",
    transitionSlowdown: 1.5,
    particleRefreshMs: 2600,
    particleCount: 34,
    tokenMoveTransition: "left 0.9s ease-in-out, top 0.9s ease-in-out",
  };

  function waitMs(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function createOrangeProgressBarController(options) {
    const cfg = Object.assign({}, DEFAULTS, options || {});

    const root = document.querySelector(cfg.rootSelector);
    const fill = document.querySelector(cfg.fillSelector);
    const circles = Array.from(document.querySelectorAll(cfg.circlesSelector));
    const token = document.querySelector(cfg.tokenSelector);
    const particleLayer = document.querySelector(cfg.particleLayerSelector);

    const totalSteps = Math.max(1, circles.length - 1);

    let step = 0;
    let sequence = Promise.resolve();
    let particleRefreshTimer = null;

    function setTokenToCircle(circleIndex, withTransition) {
      if (!token || !circles.length) {
        return;
      }

      const safeIndex = clamp(circleIndex, 0, circles.length - 1);
      const targetCircle = circles[safeIndex];
      if (!targetCircle) {
        return;
      }

      const rootRect = token.offsetParent
        ? token.offsetParent.getBoundingClientRect()
        : token.parentElement.getBoundingClientRect();
      const circleRect = targetCircle.getBoundingClientRect();

      token.style.transition = withTransition ? cfg.tokenMoveTransition : "none";
      token.style.left = (circleRect.left - rootRect.left + circleRect.width / 2) + "px";
      token.style.top = (circleRect.top - rootRect.top + circleRect.height / 2) + "px";

      if (!withTransition) {
        void token.offsetHeight;
        token.style.transition = cfg.tokenMoveTransition;
      }
    }

    function buildRandomProgressParticles() {
      if (!particleLayer) {
        return;
      }

      particleLayer.innerHTML = "";

      const colors = [
        "rgba(255, 248, 196, 0.95)",
        "rgba(254, 215, 102, 0.88)",
        "rgba(251, 146, 60, 0.82)",
        "rgba(248, 113, 113, 0.86)",
      ];

      for (let i = 0; i < cfg.particleCount; i += 1) {
        const dot = document.createElement("span");
        dot.className = "question-progress-particle";

        const left = Math.random() * 100;
        const size = 0.26 + Math.random() * 0.56;
        const duration = 1.2 + Math.random() * 2.2;
        const delay = -Math.random() * 2.8;
        const drift = -16 + Math.random() * 32;
        const opacity = 0.55 + Math.random() * 0.4;
        const color = colors[Math.floor(Math.random() * colors.length)];

        dot.style.setProperty("--particle-left", left + "%");
        dot.style.setProperty("--particle-size", size + "vh");
        dot.style.setProperty("--particle-duration", duration + "s");
        dot.style.setProperty("--particle-delay", delay + "s");
        dot.style.setProperty("--particle-drift-x", drift + "px");
        dot.style.setProperty("--particle-opacity", String(opacity));
        dot.style.setProperty("--particle-color", color);

        particleLayer.appendChild(dot);
      }
    }

    function initParticles() {
      buildRandomProgressParticles();

      if (particleRefreshTimer != null) {
        window.clearInterval(particleRefreshTimer);
        particleRefreshTimer = null;
      }

      particleRefreshTimer = window.setInterval(() => {
        buildRandomProgressParticles();
      }, cfg.particleRefreshMs);
    }

    function render(nextStep) {
      const safeStep = clamp(Number(nextStep) || 0, 0, totalSteps);

      if (fill) {
        fill.style.width = ((safeStep / totalSteps) * 90) + "%";
      }

      circles.forEach((circle, index) => {
        if (!circle) {
          return;
        }

        if (index === 0) {
          circle.classList.add(cfg.startClass);
        }

        if (index > 0 && index <= safeStep) {
          circle.classList.add(cfg.filledClass);
          return;
        }

        circle.classList.remove(cfg.filledClass);
        const fillEl = circle.querySelector(".question-progress-circle-fill");
        if (fillEl) {
          fillEl.style.animation = "none";
          void fillEl.offsetHeight;
          fillEl.style.animation = "";
        }
      });

      setTokenToCircle(Math.min(safeStep, circles.length - 1), false);
      step = safeStep;
    }

    function reset() {
      step = 0;
      sequence = Promise.resolve();
      initParticles();
      render(0);
      return step;
    }

    function advance() {
      if (!fill || !circles.length) {
        return Promise.resolve(step);
      }

      if (step >= totalSteps) {
        return sequence.then(() => step);
      }

      sequence = sequence.then(async () => {
        if (step >= totalSteps) {
          return;
        }

        const nextStep = step + 1;
        const slowdown = cfg.transitionSlowdown;

        if (root) {
          root.classList.add(cfg.centeredClass);
        }
        await waitMs(Math.round(350 * slowdown));

        if (token) {
          token.style.setProperty("--question-progress-token-scale", "1.5");
        }

        fill.style.width = ((nextStep / totalSteps) * 90) + "%";
        const destinationIndex = Math.min(nextStep, circles.length - 1);
        const circle = circles[destinationIndex];
        setTokenToCircle(destinationIndex, true);

        if (circle) {
          const fillEl = circle.querySelector(".question-progress-circle-fill");
          if (fillEl) {
            fillEl.style.animation = "none";
            void fillEl.offsetHeight;
            fillEl.style.animation = "";
          }
          if (destinationIndex > 0) {
            circle.classList.add(cfg.filledClass);
          }
        }

        if (typeof window.playVictorySuccessVoice === "function") {
          window.playVictorySuccessVoice();
        }

        await waitMs(Math.round(950 * slowdown));

        if (token) {
          token.style.setProperty("--question-progress-token-scale", "1");
        }

        await waitMs(Math.round(220 * slowdown));

        if (root) {
          if (token) {
            token.classList.add(cfg.tokenHiddenClass);
          }
          root.classList.remove(cfg.centeredClass);
        }

        await waitMs(Math.round(350 * slowdown));
        setTokenToCircle(destinationIndex, false);

        if (token) {
          token.classList.remove(cfg.tokenHiddenClass);
        }

        step = nextStep;
      });

      return sequence.then(() => step);
    }

    function setStep(nextStep) {
      render(nextStep);
      return step;
    }

    function destroy() {
      if (particleRefreshTimer != null) {
        window.clearInterval(particleRefreshTimer);
        particleRefreshTimer = null;
      }
    }

    return {
      getStep: () => step,
      getTotalSteps: () => totalSteps,
      reset,
      advance,
      setStep,
      destroy,
    };
  }

  window.createOrangeProgressBarController = createOrangeProgressBarController;
})();
