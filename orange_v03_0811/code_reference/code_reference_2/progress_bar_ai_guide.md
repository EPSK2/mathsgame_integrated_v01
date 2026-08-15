# Orange Game Progress Bar: AI Implementation Guide

This guide describes how to reproduce the same progress bar behavior used in the orange game.

Scope:
- Visual structure (track + circles + token)
- Animation sequence for each completed question
- State model and queueing (to avoid overlapping animations)
- Reusable helper API with advance(), reset(), setStep()
- Asset list used by this progress bar

## 1) Reference implementation in this workspace

The live implementation is in:
- game_2.html (markup)
- game_style_2.css (styles + keyframes)
- game_script_2.js (runtime logic)

For reusable use in other pages, this workspace now also includes:
- progress_bar_orange_helper.js

## 2) Required DOM structure

Use this markup exactly (or equivalent selectors):

```html
<div id="questionProgress" class="question-progress" aria-hidden="true">
  <div class="question-progress-track">
    <div id="questionProgressFill" class="question-progress-fill">
      <div class="question-progress-fill-particles"></div>
    </div>
  </div>

  <div class="question-progress-circles">
    <div class="question-progress-circle" data-step="1"><div class="question-progress-circle-fill"></div></div>
    <div class="question-progress-circle" data-step="2"><div class="question-progress-circle-fill"></div></div>
    <div class="question-progress-circle" data-step="3"><div class="question-progress-circle-fill"></div></div>
    <div class="question-progress-circle" data-step="4"><div class="question-progress-circle-fill"></div></div>
    <div class="question-progress-circle" data-step="5"><div class="question-progress-circle-fill"></div></div>
    <div class="question-progress-circle" data-step="6"><div class="question-progress-circle-fill"></div></div>
  </div>

  <div id="questionProgressToken" class="question-progress-token" aria-hidden="true">
    <img src="./orange_head.png" alt="" />
    <span class="question-progress-token-arrow">&#9658;</span>
  </div>
</div>
```

Important:
- Total progress steps = circleCount - 1.
- First circle is a START marker, not a completed step.
- Fill width uses 90% max by design so the glowing bar stays inside the outer border.

## 3) Visual behavior requirements

1. Track and fill:
- Outer track is centered horizontally and vertically inside the progress root.
- Fill starts at 0 and animates width to target percentage.
- Fill has orange/red gradient and glow.

2. Milestone circles:
- Start circle has class is-start and a white arrow symbol.
- Each completed step adds class is-filled on destination circle.
- Circle fill animation must be restartable by resetting animation style and forcing reflow.

3. Token (orange head):
- Token moves to the destination circle center.
- During main motion: animated transition.
- During snap-back/position correction: transition disabled, then restored.

4. Particle layer:
- Progress fill has floating particles.
- Particle set is periodically rebuilt to reduce visible repetition.

5. Centered transition cue:
- On each step increment, temporarily add class is-centered-transition to root.
- This enlarges + centers the bar and adds a translucent overlay card effect.
- After animation, remove this class and return to normal top layout.

## 4) Runtime state model

You need these state variables:

- step: current completed step (0..totalSteps)
- totalSteps: Math.max(1, circles.length - 1)
- sequence: Promise chain used as animation queue
- particleRefreshTimer: interval handle for particle re-seeding

Why sequence queue matters:
- If advance() is called multiple times quickly, each call waits for previous animation to finish.
- This prevents token jumps, class race conditions, and incorrect final step counts.

## 5) Core function contract

Minimum API:

- reset():
  - step = 0
  - restart particles
  - render initial UI

- advance(): Promise<number>
  - no-op when step >= totalSteps
  - otherwise queue one increment animation
  - resolves with the new step index

- setStep(stepNumber): number
  - instant render without full cinematic
  - returns clamped step

- destroy():
  - clear interval timers (particle refresh)

## 6) Animation sequence for one increment

Use this order to match orange game feel:

1. Add centered class to root.
2. Wait ~350ms * slowdown.
3. Scale token up to 1.5.
4. Start fill-width update and token move together.
5. Mark destination circle as filled and replay its fill animation.
6. Optionally play success voice cue.
7. Wait ~950ms * slowdown.
8. Scale token back to 1.
9. Wait ~220ms * slowdown.
10. Hide token briefly + remove centered class.
11. Wait ~350ms * slowdown.
12. Snap token to destination anchor (no movement transition), then unhide.
13. Commit step = nextStep.

The helper uses slowdown = 1.5 by default.

## 7) Ready-to-use helper in this workspace

File:
- progress_bar_orange_helper.js

Global factory exposed:

```js
const progress = window.createOrangeProgressBarController();
progress.reset();

await progress.advance();
await progress.advance();

progress.setStep(3);
const current = progress.getStep();
const total = progress.getTotalSteps();

progress.destroy();
```

## 8) Integration checklist for a new AI

1. Ensure the page includes the progress DOM block.
2. Ensure CSS classes from the orange game are present.
3. Load progress_bar_orange_helper.js after the DOM exists.
4. Call reset() when a run starts.
5. Call await advance() only after a successful question/catch.
6. Do not manually mutate fill width or circle classes outside this controller.
7. Call destroy() if the page/view is being removed.

## 9) Assets used by this progress bar

Direct visual assets:
- orange_head.png (token image)

Style resource that affects overall page typography (not required for token/track mechanics):
- allseto_subset.woff2

Audio cue triggered during advance() if available:
- voice_human_success_01.mp3
- voice_human_success_02.mp3
- voice_human_success_03.mp3
- voice_human_success_04.mp3
- voice_human_success_05.mp3

Notes:
- The success voice files are selected through window.playVictorySuccessVoice() in audio_manager.js.
- The particle effect, circle fills, and bar glow use CSS only (no extra image assets).
