(function attachState(global) {
  function normalizeSessionState(raw) {
    if (!global.CompanionRecovery) {
      throw new Error("CompanionRecovery must be loaded before CompanionState.");
    }
    return global.CompanionRecovery.normalizeState(raw);
  }

  global.CompanionState = {
    normalizeSessionState,
  };
})(window);
