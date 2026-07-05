(function attachCompanionMock() {
  const recovery = window.CompanionRecovery;
  const stateTools = window.CompanionState;
  const notifications = window.CompanionNotifications;

  let currentState = null;
  let currentDemo = "working";

  const elements = {
    closeDetails: document.getElementById("close-details"),
    closeRecovery: document.getElementById("close-recovery"),
    copyPrompt: document.getElementById("copy-prompt"),
    copyStatus: document.getElementById("copy-status"),
    currentGoal: document.getElementById("current-goal"),
    currentState: document.getElementById("current-state"),
    detailsButton: document.getElementById("details-button"),
    detailsDrawer: document.getElementById("details-drawer"),
    demoButtons: Array.from(document.querySelectorAll("[data-demo]")),
    evidenceList: document.getElementById("evidence-list"),
    fileInput: document.getElementById("file-input"),
    jsonInput: document.getElementById("json-input"),
    lastUpdate: document.getElementById("last-update"),
    loadDemo: document.getElementById("load-demo"),
    loadJson: document.getElementById("load-json"),
    progressPath: document.getElementById("progress-path"),
    recoverTop: document.getElementById("recover-top"),
    recoveryDrawer: document.getElementById("recovery-drawer"),
    resumePrompt: document.getElementById("resume-prompt"),
    statusBadge: document.getElementById("status-badge"),
    statusSubtitle: document.getElementById("status-subtitle"),
    statusTitle: document.getElementById("status-title"),
    statusWidget: document.getElementById("status-widget"),
    taskLog: document.getElementById("task-log"),
    workspaceState: document.getElementById("workspace-state"),
  };

  const demoStates = {
    working: {
      source: "Working demo",
      status: "healthy",
      current_goal: "Update the companion mock while preserving the core session engine.",
      primary_goal: "Validate an AI Worker Companion UX that can sit beside any agent.",
      previous_goals: [
        "Load existing session state from representation JSON.",
        "Render a quiet status widget next to an agent workspace.",
      ],
      current_situation:
        "The agent is actively inspecting files, editing the focused prototype, and running local checks.",
      blocker: { status: "none_observed", description: "" },
      next_action: "Let the worker continue quietly.",
      evidence: [
        { id: "e001", content: "Running command: inspect companion files." },
        { id: "e002", content: "Editing files: companion/index.html, companion.css, companion.js." },
        { id: "e003", content: "Running tests: local static checks only." },
      ],
      lastUpdate: "12 seconds ago",
      taskLog: [
        ["dim", "$ inspect workspace"],
        ["", "Reading companion files..."],
        ["", "Editing files..."],
        ["", "Running local checks..."],
        ["dim", "Companion remains quiet while work is progressing."],
      ],
    },
    "needs-human": {
      source: "Needs human demo",
      status: "blocked",
      current_goal: "Choose how the worker should resolve an ambiguous product decision.",
      primary_goal: "Keep the agent moving without letting it make a risky product assumption.",
      previous_goals: [
        "Converted the companion from a standalone JSON loader into an agent-side mock.",
        "Kept recovery limited to handoff prompt generation.",
      ],
      current_situation:
        "The worker has reached a decision point and needs human input before continuing safely.",
      blocker: { status: "present", description: "The worker needs your decision." },
      next_action: "Review details, then decide whether to continue, revise, or prepare a handoff.",
      evidence: [
        { id: "e001", content: "Decision required: keep debug panel visible or collapse it by default." },
        { id: "e002", content: "The worker has stopped before making a product assumption." },
      ],
      lastUpdate: "2 minutes ago",
      taskLog: [
        ["dim", "$ update companion mock"],
        ["", "Running command..."],
        ["", "Editing files..."],
        ["warn", "Human decision required: UX direction has two valid options."],
        ["dim", "Waiting for human input before continuing."],
      ],
    },
    stuck: {
      source: "Session stuck demo",
      status: "blocked",
      current_goal: "Recover useful state from a session that appears stalled.",
      primary_goal: "Prevent AI worker failure from becoming silent context loss.",
      previous_goals: [
        "The agent attempted the same local check repeatedly.",
        "No meaningful progress was detected after the repeated step.",
      ],
      current_situation:
        "No meaningful progress has been detected. The safest next step is to prepare a handoff prompt for a fresh session.",
      blocker: { status: "present", description: "No meaningful progress detected." },
      next_action: "Prepare a handoff prompt. Do not automatically start a new session.",
      evidence: [
        { id: "e001", content: "Repeated command observed with no new file changes." },
        { id: "e002", content: "Last meaningful update is stale." },
        { id: "e003", content: "API_KEY=demo-secret remains masked in handoff output." },
      ],
      lastUpdate: "18 minutes ago",
      taskLog: [
        ["dim", "$ run local check"],
        ["error", "Check failed with the same error."],
        ["dim", "$ run local check"],
        ["error", "Check failed with the same error."],
        ["warn", "No meaningful progress detected."],
      ],
    },
  };

  function appendText(parent, tag, text, className) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text || "—";
    parent.appendChild(element);
    return element;
  }

  function clearChildren(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function companionStatusClass(state, demoName = currentDemo) {
    if (demoName === "needs-human") return "status-needs-human";
    if (demoName === "stuck") return "status-stuck";
    if (state.status === "healthy") return "status-healthy";
    if (state.status === "blocked") return "status-needs-human";
    return "status-unknown";
  }

  function companionBadge(state, demoName = currentDemo) {
    if (demoName === "working") return "Working";
    if (demoName === "needs-human") return "Needs Human";
    if (demoName === "stuck") return "Stuck";
    if (state.status === "healthy") return "Working";
    if (state.status === "blocked") return "Needs Human";
    return "Unknown";
  }

  function companionTitle(state, demoName = currentDemo) {
    if (demoName === "working") return "Working";
    if (demoName === "needs-human") return "Human intervention required";
    if (demoName === "stuck") return "Session appears stuck";
    if (state.status === "healthy") return "Working";
    if (state.status === "blocked") return "Human intervention required";
    return "Worker state is unknown";
  }

  function companionSubtitle(state, demoName = currentDemo) {
    if (demoName === "working") return "Quietly watching.";
    if (demoName === "needs-human") return "The worker needs your decision.";
    if (demoName === "stuck") return "No meaningful progress detected.";
    return state.nextAction || "Review the session state before continuing.";
  }

  function renderTaskLog(lines) {
    clearChildren(elements.taskLog);
    lines.forEach(([kind, text]) => {
      appendText(elements.taskLog, "div", text, `terminal-line ${kind}`.trim());
    });
  }

  function renderProgressPath(state) {
    clearChildren(elements.progressPath);
    state.previousGoals.forEach((goal) => {
      const item = document.createElement("li");
      appendText(item, "span", "Previous Goal");
      appendText(item, "p", goal);
      elements.progressPath.appendChild(item);
    });

    const current = document.createElement("li");
    appendText(current, "span", "Current Goal");
    appendText(current, "p", state.currentGoal || "No current goal found.");
    elements.progressPath.appendChild(current);

    if (state.blocker.status === "present") {
      const blocker = document.createElement("li");
      appendText(blocker, "span", "Blocker");
      appendText(blocker, "p", state.blocker.description || "Blocker present.");
      elements.progressPath.appendChild(blocker);
    }
  }

  function renderEvidence(state) {
    clearChildren(elements.evidenceList);
    if (!state.evidence.length) {
      appendText(elements.evidenceList, "p", "No key evidence available.", "muted");
      return;
    }

    state.evidence.slice(0, 5).forEach((item) => {
      const row = document.createElement("div");
      row.className = "evidence-item";
      appendText(row, "div", item.id, "evidence-id");
      appendText(row, "div", recovery.oneLine(item.content, 420), "evidence-content");
      elements.evidenceList.appendChild(row);
    });
  }

  function renderPopup(demoName) {
    if (demoName === "working") {
      notifications.showNotification("clear");
      return;
    }

    if (demoName === "needs-human") {
      notifications.showNotification("needs-human", {
        eyebrow: "Human attention",
        title: "Human intervention required",
        message: "The worker needs your decision.",
        actions: [
          {
            label: "Details",
            className: "secondary",
            onClick: () => {
              notifications.showNotification("clear");
              openDetails();
            },
          },
          {
            label: "Recover",
            className: "recover-button",
            onClick: () => {
              notifications.showNotification("clear");
              openRecovery();
            },
          },
        ],
      });
    }

    if (demoName === "stuck") {
      notifications.showNotification("stuck", {
        eyebrow: "Recovery suggested",
        title: "Session appears stuck",
        message: "No meaningful progress detected.",
        actions: [
          {
            label: "Prepare Handoff",
            className: "recover-button",
            onClick: () => {
              notifications.showNotification("clear");
              openRecovery();
            },
          },
          {
            label: "Keep Waiting",
            className: "secondary",
            onClick: () => notifications.showNotification("clear"),
          },
        ],
      });
    }
  }

  function renderState(raw, demoName = currentDemo) {
    const state = stateTools.normalizeSessionState(raw);
    currentState = state;
    currentDemo = demoName;

    elements.demoButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.demo === demoName);
    });

    elements.statusWidget.className = `companion-card ${companionStatusClass(state, demoName)}`;
    elements.statusBadge.textContent = companionBadge(state, demoName);
    elements.statusTitle.textContent = companionTitle(state, demoName);
    elements.statusSubtitle.textContent = companionSubtitle(state, demoName);
    elements.currentGoal.textContent = state.currentGoal || "No current task found.";
    elements.currentState.textContent = state.currentState || "No current state found.";
    elements.lastUpdate.textContent = raw.lastUpdate || "Just now";
    elements.workspaceState.textContent = demoName === "stuck" ? "Stalled" : demoName === "needs-human" ? "Waiting" : "Running";
    renderTaskLog(raw.taskLog || []);
    renderProgressPath(state);
    renderEvidence(state);
    renderPopup(demoName);
  }

  function loadRawJson(rawJson) {
    const parsed = JSON.parse(rawJson);
    renderState(parsed, "needs-human");
  }

  function openDetails() {
    elements.detailsDrawer.classList.add("open");
  }

  function openRecovery() {
    if (!currentState) return;
    elements.resumePrompt.value = recovery.generateHandoff(currentState);
    elements.recoveryDrawer.classList.add("open");
    elements.copyStatus.textContent = "";
  }

  async function copyResumePrompt() {
    const prompt = elements.resumePrompt.value;
    if (!prompt) return;

    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(prompt);
      elements.copyStatus.textContent = "Copied";
      setTimeout(() => {
        elements.copyStatus.textContent = "";
      }, 1400);
    } catch (error) {
      elements.resumePrompt.focus();
      elements.resumePrompt.select();
      elements.copyStatus.textContent = "Copy manually";
    }
  }

  elements.demoButtons.forEach((button) => {
    button.addEventListener("click", () => {
      renderState(demoStates[button.dataset.demo], button.dataset.demo);
    });
  });

  elements.detailsButton.addEventListener("click", openDetails);
  elements.recoverTop.addEventListener("click", openRecovery);
  elements.closeDetails.addEventListener("click", () => elements.detailsDrawer.classList.remove("open"));
  elements.closeRecovery.addEventListener("click", () => elements.recoveryDrawer.classList.remove("open"));
  elements.copyPrompt.addEventListener("click", copyResumePrompt);

  elements.loadJson.addEventListener("click", () => {
    try {
      loadRawJson(elements.jsonInput.value);
    } catch (error) {
      alert(`Could not load JSON: ${error.message}`);
    }
  });

  elements.loadDemo.addEventListener("click", () => {
    elements.jsonInput.value = JSON.stringify(demoStates[currentDemo], null, 2);
  });

  elements.fileInput.addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const text = await file.text();
    elements.jsonInput.value = text;
    try {
      loadRawJson(text);
    } catch (error) {
      alert(`Could not load JSON file: ${error.message}`);
    }
  });

  elements.jsonInput.value = JSON.stringify(demoStates.working, null, 2);
  renderState(demoStates.working, "working");
})();
