(() => {
  const SETTINGS_KEY = "ps_settings";

  function loadSettings() {
    const defaults = {
      operationMode: "add", // add | sub | mixed
      addMaxSum: 10,
      subMaxMinuend: 10,
      addAutoMode: false,
      subAutoMode: false,
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

  function saveSettings(settings) {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      // Ignore storage errors.
    }
  }

  function init() {
    const opButtons = document.querySelectorAll("#operation-buttons .pill-button[data-operation]");
    const addButtons = document.querySelectorAll("#addition-difficulty-buttons .pill-button[data-add-max-sum]");
    const subButtons = document.querySelectorAll("#subtraction-difficulty-buttons .pill-button[data-sub-max-minuend]");
    const addAutoButton = document.querySelector("#addition-difficulty-buttons .pill-button[data-add-auto-mode]");
    const subAutoButton = document.querySelector("#subtraction-difficulty-buttons .pill-button[data-sub-auto-mode]");

    if (!opButtons.length) return;

    let settings = loadSettings();

    function syncUi() {
      opButtons.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.operation === settings.operationMode);
      });

      addButtons.forEach((btn) => {
        const maxSum = Number(btn.dataset.addMaxSum || 10);
        btn.classList.toggle("active", !settings.addAutoMode && maxSum === settings.addMaxSum);
      });

      if (addAutoButton) {
        addAutoButton.classList.toggle("active", settings.addAutoMode === true);
      }

      subButtons.forEach((btn) => {
        const maxMinuend = Number(btn.dataset.subMaxMinuend || 10);
        btn.classList.toggle("active", !settings.subAutoMode && maxMinuend === settings.subMaxMinuend);
      });

      if (subAutoButton) {
        subAutoButton.classList.toggle("active", settings.subAutoMode === true);
      }
    }

    function updateSettings(patch) {
      settings = { ...settings, ...patch };
      saveSettings(settings);
      syncUi();
    }

    opButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const operationMode = btn.dataset.operation;
        if (!operationMode || operationMode === settings.operationMode) return;
        updateSettings({ operationMode });
      });
    });

    addButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const maxSum = Number(btn.dataset.addMaxSum || 10);
        if (!settings.addAutoMode && maxSum === settings.addMaxSum) return;
        updateSettings({ addMaxSum: maxSum, addAutoMode: false });
      });
    });

    if (addAutoButton) {
      addAutoButton.addEventListener("click", () => {
        if (settings.addAutoMode) return;
        updateSettings({ addAutoMode: true });
      });
    }

    subButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const maxMinuend = Number(btn.dataset.subMaxMinuend || 10);
        if (!settings.subAutoMode && maxMinuend === settings.subMaxMinuend) return;
        updateSettings({ subMaxMinuend: maxMinuend, subAutoMode: false });
      });
    });

    if (subAutoButton) {
      subAutoButton.addEventListener("click", () => {
        if (settings.subAutoMode) return;
        updateSettings({ subAutoMode: true });
      });
    }

    syncUi();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
