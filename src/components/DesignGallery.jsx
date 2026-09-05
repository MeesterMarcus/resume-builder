import { useEffect, useRef } from "react";
import { RESUME_LAYOUTS } from "../resume-designs.js";
import {
  galleryPreviewDocument,
  fitGallerySample,
} from "../resume-renderer.js";

export default function DesignGallery({ theme, layout, close, select }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current.querySelector(".selected")?.focus();
  }, []);
  return (
    <>
      <div
        className="design-backdrop open"
        id="designBackdrop"
        onClick={close}
      />
      <section
        className="design-modal open"
        id="designModal"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="designModalTitle"
      >
        <header className="design-modal-header">
          <div>
            <p className="eyebrow">Résumé gallery</p>
            <h2 id="designModalTitle">Choose your design</h2>
            <p>
              Every design works with your selected color palette and remains
              ATS-friendly.
            </p>
          </div>
          <button
            className="icon-button"
            id="closeDesignButton"
            type="button"
            aria-label="Close design gallery"
            onClick={close}
          >
            ×
          </button>
        </header>
        <div className="design-grid" id="designGrid">
          {RESUME_LAYOUTS.map(({ id, name, description }) => (
            <button
              key={id}
              className={`design-card ${id === layout ? "selected" : ""}`}
              type="button"
              data-select-layout={id}
              aria-label={`Use ${name} design`}
              aria-pressed={id === layout}
              onClick={() => select(id)}
            >
              <span className="design-live-preview" aria-hidden="true">
                <iframe
                  className="design-live-frame"
                  title={`${name} résumé preview`}
                  tabIndex={-1}
                  srcDoc={galleryPreviewDocument(id, theme)}
                  onLoad={(event) => {
                    const frame = event.currentTarget;
                    fitGallerySample(frame);
                    frame.contentDocument?.fonts?.ready.then(() => {
                      if (frame.isConnected) fitGallerySample(frame);
                    });
                  }}
                />
              </span>
              <span className="design-card-copy">
                <strong>{name}</strong>
                <small>{description}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
