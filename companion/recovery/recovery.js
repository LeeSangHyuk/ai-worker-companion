(function attachRecovery(global) {
  const REDACTION = "****REDACTED****";

  const privateKeyBlock = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;
  const bearerToken = /\b(Bearer)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
  const sensitiveAssignment = /\b(api[_-]?key|juso[_-]?key|servicekey|confmkey|access[_\s-]?token|bearer[_\s-]?token|password|secret|private[_\s-]?key|token)\b(\s*[:=]\s*)(["']?)([^"'\s&;,<>]+)(["']?)/gi;
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

  function asObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function textValue(value) {
    if (value == null) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object") {
      for (const key of ["value", "summary", "description", "content", "text"]) {
        if (typeof value[key] === "string") return value[key];
      }
    }
    return String(value);
  }

  function sanitizeText(value) {
    if (!value) return "";
    return String(value)
      .replace(privateKeyBlock, REDACTION)
      .replace(bearerToken, `$1 ${REDACTION}`)
      .replace(sensitiveAssignment, (match, key, separator, openQuote, secret, closeQuote) => {
        const quote = openQuote || closeQuote || "";
        return quote
          ? `${key}${separator}${quote}${REDACTION}${quote}`
          : `${key}${separator}${REDACTION}`;
      })
      .replace(emailPattern, "****REDACTED_EMAIL****");
  }

  function oneLine(value, limit = 180) {
    const compact = String(value || "").replace(/\s+/g, " ").trim();
    if (compact.length <= limit) return compact;
    return `${compact.slice(0, limit - 1).trim()}…`;
  }

  function goalStack(raw) {
    return asObject(raw.goal_stack || raw.goal || {});
  }

  function blocker(raw) {
    const item = asObject(raw.blocker);
    const status = textValue(item.status) || "unknown";
    const description = textValue(item.description || item.value || item.summary);
    return { status, description };
  }

  function evidenceItems(raw) {
    return asArray(raw.evidence || raw.evidence_items).map((item, index) => {
      const object = asObject(item);
      return {
        id: textValue(object.id || object.evidence_id || `e${String(index + 1).padStart(3, "0")}`),
        content: sanitizeText(textValue(object.content || object.quote || object.snippet || object.text || object.summary)),
      };
    });
  }

  function detectStatus(raw, activeGoal, evidence) {
    if (raw.status === "blocked") return "blocked";
    if (raw.status === "healthy") return "healthy";
    if (raw.status === "low-context" || raw.status === "low_context") return "low-context";
    if (raw.status === "unknown") return "unknown";

    const currentBlocker = blocker(raw);
    if (currentBlocker.status === "present") return "blocked";
    if (currentBlocker.status === "unknown") return "unknown";
    if (!activeGoal || evidence.length <= 1) return "low-context";
    return "healthy";
  }

  function normalizeState(rawInput) {
    const raw = Array.isArray(rawInput) ? rawInput[0] || {} : asObject(rawInput);
    const stack = goalStack(raw);
    const situation = asObject(raw.current_situation || raw.situation);
    const currentBlocker = blocker(raw);
    const evidence = evidenceItems(raw);
    const previousGoals = asArray(raw.previous_goals || stack.previous_goals)
      .map((goal) => textValue(goal))
      .filter(Boolean);

    const currentGoal = textValue(raw.current_goal || raw.active_goal || stack.active_goal);
    const primaryGoal = textValue(raw.primary_goal || stack.primary_goal);
    const currentState = textValue(raw.current_situation || situation.summary || situation.value);
    const status = detectStatus(raw, currentGoal, evidence);

    return {
      source: textValue(raw.source || raw.id || raw.title || "Unspecified session"),
      status,
      currentGoal,
      primaryGoal,
      previousGoals,
      currentState,
      blocker: currentBlocker,
      nextAction: textValue(raw.next_action) || defaultNextAction(status, currentGoal),
      evidence,
    };
  }

  function defaultNextAction(status, currentGoal) {
    if (status === "blocked") return "Resolve or clarify the blocker before continuing.";
    if (currentGoal) return "Continue from the current goal without restarting from scratch.";
    return "Review the session state and identify the current goal.";
  }

  function buildResumePrompt(state) {
    const previous = state.previousGoals.length
      ? state.previousGoals.map((goal) => `- ${goal}`).join("\n")
      : "- None";
    const evidence = state.evidence.slice(0, 5).length
      ? state.evidence.slice(0, 5).map((item) => `- ${item.id}: ${item.content || "No evidence content."}`).join("\n")
      : "- None";

    return [
      "You are continuing an AI agent session.",
      "",
      "Current Goal:",
      state.currentGoal || "Not specified.",
      "",
      "Primary Goal:",
      state.primaryGoal || "Not specified.",
      "",
      "Previous Goals:",
      previous,
      "",
      "Current Situation:",
      state.currentState || "Not specified.",
      "",
      "Blocker:",
      `status: ${state.blocker.status || "unknown"}`,
      `description: ${state.blocker.description || "Not specified."}`,
      "",
      "Key Evidence:",
      evidence,
      "",
      "Instructions:",
      "Continue from this state. Do not restart from scratch. Use the current goal and blocker as the immediate context.",
    ].join("\n");
  }

  function generateHandoff(sessionState) {
    const state = sessionState && Array.isArray(sessionState.evidence)
      ? sessionState
      : normalizeState(sessionState);
    return buildResumePrompt(state);
  }

  global.CompanionRecovery = {
    buildResumePrompt,
    generateHandoff,
    normalizeState,
    oneLine,
    sanitizeText,
  };
})(window);
