import { useEffect, useRef, useState } from "react";

export default function ActionModal({ options, resolve }) {
  const [value, setValue] = useState(options.input?.value ?? "");
  const [invalid, setInvalid] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const modal = ref.current;
    (options.input
      ? modal.querySelector("input")
      : modal.querySelector("#actionModalCancelButton")
    ).focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [options]);
  function confirm() {
    if (options.input?.required && !value.trim()) {
      setInvalid(true);
      ref.current.querySelector("input").focus();
      return;
    }
    resolve(options.input ? value.trim() : true);
  }
  function keydown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      resolve(null);
    }
    if (event.key === "Enter" && event.target.tagName === "INPUT") {
      event.preventDefault();
      confirm();
    }
    if (event.key !== "Tab") return;
    const items = [...ref.current.querySelectorAll("input, button")];
    const first = items[0],
      last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  return (
    <>
      <div
        className="action-modal-backdrop open"
        id="actionModalBackdrop"
        onClick={() => resolve(null)}
      />
      <section
        className="action-modal open"
        id="actionModal"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="actionModalTitle"
        aria-describedby="actionModalDescription"
        data-tone={options.tone ?? "primary"}
        onKeyDown={keydown}
      >
        <div
          className="action-modal-icon"
          id="actionModalIcon"
          aria-hidden="true"
        >
          {options.icon ?? "?"}
        </div>
        <p className="eyebrow" id="actionModalEyebrow">
          {options.eyebrow ?? "Please confirm"}
        </p>
        <h2 id="actionModalTitle">{options.title}</h2>
        <p className="action-modal-description" id="actionModalDescription">
          {options.description}
        </p>
        {options.input && (
          <label
            className={`action-modal-field ${invalid ? "invalid" : ""}`}
            id="actionModalField"
          >
            <span id="actionModalInputLabel">{options.input.label}</span>
            <input
              id="actionModalInput"
              type="text"
              autoComplete="off"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setInvalid(false);
              }}
              placeholder={options.input.placeholder ?? ""}
            />
            <small id="actionModalInputHint">
              {invalid
                ? (options.input.requiredMessage ?? "Please enter a value.")
                : options.input.hint}
            </small>
          </label>
        )}
        <div className="action-modal-actions">
          <button
            className="action-modal-cancel"
            id="actionModalCancelButton"
            type="button"
            onClick={() => resolve(null)}
          >
            Cancel
          </button>
          <button
            className="action-modal-confirm"
            id="actionModalConfirmButton"
            type="button"
            onClick={confirm}
          >
            {options.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </section>
    </>
  );
}
