(function attachNotifications(global) {
  function clearChildren(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function button(label, className, onClick) {
    const element = document.createElement("button");
    element.textContent = label;
    if (className) element.className = className;
    element.addEventListener("click", (event) => {
      event.preventDefault();
      if (typeof onClick === "function") onClick(event);
    });
    return element;
  }

  function showNotification(type, payload = {}) {
    const popup = document.getElementById("attention-popup");
    const actions = document.getElementById("popup-actions");
    const eyebrow = document.getElementById("popup-eyebrow");
    const message = document.getElementById("popup-message");
    const title = document.getElementById("popup-title");

    if (!popup) return;

    if (type === "clear") {
      if (popup.open) popup.close();
      return;
    }

    clearChildren(actions);
    eyebrow.textContent = payload.eyebrow || "Human attention";
    title.textContent = payload.title || "Human intervention required";
    message.textContent = payload.message || "The worker needs your decision.";

    (payload.actions || []).forEach((action) => {
      actions.appendChild(button(action.label, action.className, action.onClick));
    });

    if (typeof popup.showModal === "function" && !popup.open) {
      popup.showModal();
    }
  }

  global.CompanionNotifications = {
    showNotification,
  };
})(window);
