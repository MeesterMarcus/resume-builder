export function createActionModal() {
  const modal = document.querySelector("#actionModal");
  const backdrop = document.querySelector("#actionModalBackdrop");
  const field = document.querySelector("#actionModalField");
  const input = document.querySelector("#actionModalInput");
  const confirmButton = document.querySelector("#actionModalConfirmButton");
  const cancelButton = document.querySelector("#actionModalCancelButton");
  const inputHint = document.querySelector("#actionModalInputHint");
  let resolver = null;
  let options = null;
  let previousFocus = null;

  function close(result) {
    if (!resolver) return;
    const resolve = resolver;
    resolver = null;
    options = null;
    modal.classList.remove("open");
    backdrop.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    modal.inert = true;
    field.classList.remove("invalid");
    setTimeout(() => previousFocus?.focus(), 0);
    resolve(result);
  }

  function show(nextOptions) {
    if (resolver) close(null);
    options = nextOptions;
    previousFocus = document.activeElement;
    modal.dataset.tone = options.tone ?? "primary";
    document.querySelector("#actionModalIcon").textContent = options.icon ?? "?";
    document.querySelector("#actionModalEyebrow").textContent = options.eyebrow ?? "Please confirm";
    document.querySelector("#actionModalTitle").textContent = options.title;
    document.querySelector("#actionModalDescription").textContent = options.description;
    confirmButton.textContent = options.confirmLabel ?? "Confirm";
    field.hidden = !options.input;
    field.classList.remove("invalid");
    if (options.input) {
      document.querySelector("#actionModalInputLabel").textContent = options.input.label;
      inputHint.textContent = options.input.hint ?? "";
      input.value = options.input.value ?? "";
      input.placeholder = options.input.placeholder ?? "";
    }
    modal.classList.add("open");
    backdrop.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    modal.inert = false;
    requestAnimationFrame(() => (options.input ? input : cancelButton).focus());
    return new Promise((resolve) => {
      resolver = resolve;
    });
  }

  confirmButton.addEventListener("click", () => {
    if (options?.input) {
      const value = input.value.trim();
      if (options.input.required && !value) {
        field.classList.add("invalid");
        inputHint.textContent = options.input.requiredMessage ?? "Please enter a value.";
        input.focus();
        return;
      }
      close(value);
      return;
    }
    close(true);
  });
  cancelButton.addEventListener("click", () => close(null));
  backdrop.addEventListener("click", () => close(null));
  input.addEventListener("input", () => field.classList.remove("invalid"));
  modal.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && options?.input && event.target === input) {
      event.preventDefault();
      confirmButton.click();
    }
    if (event.key !== "Tab") return;
    const focusable = [...modal.querySelectorAll("button:not([hidden]), input:not([hidden])")]
      .filter((element) => !element.closest("[hidden]"));
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && resolver) close(null);
  });

  return show;
}
