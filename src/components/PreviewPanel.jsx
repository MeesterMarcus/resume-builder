import { useState } from "react";
import { RESUME_LAYOUTS } from "../resume-designs.js";
import ResumePreview from "./ResumePreview.jsx";
export default function PreviewPanel({
  data,
  textScale,
  theme,
  layout,
  changeTextScale,
  changeTheme,
  setDesignOpen,
}) {
  const [zoom, setZoom] = useState(0.82);
  return (
    <section className="preview-panel" aria-label="Resume preview">
      <div className="preview-toolbar">
        <div>
          <p className="eyebrow">Live preview</p>
          <p className="preview-note">
            <span></span> ATS-friendly text
          </p>
        </div>
        <div className="preview-actions">
          <button
            className="design-button"
            id="openDesignButton"
            onClick={() => setDesignOpen(true)}
            type="button"
            aria-haspopup="dialog"
          >
            <span className="design-button-icon">▦</span>
            <span>
              <small>Design</small>
              <strong id="currentDesignName">
                {RESUME_LAYOUTS.find((item) => item.id === layout)?.name}
              </strong>
            </span>
          </button>
          <div className="type-size-control" aria-label="Resume text size">
            <span>Text</span>
            <button
              id="textSizeDown"
              disabled={textScale <= 0.875}
              onClick={() => changeTextScale(textScale - 0.0625)}
              aria-label="Decrease resume text size"
            >
              A−
            </button>
            <output id="textSizeValue">
              {Math.round((textScale / 1.25) * 100)}%
            </output>
            <button
              id="textSizeUp"
              disabled={textScale >= 1.5}
              onClick={() => changeTextScale(textScale + 0.0625)}
              aria-label="Increase resume text size"
            >
              A+
            </button>
          </div>
          <div className="color-picker" aria-label="Resume accent color">
            <span>Color</span>
            <button
              className={`color-swatch ${theme === "blue" ? "active" : ""}`}
              data-theme="blue"
              onClick={() => changeTheme("blue")}
              style={{ "--swatch": "#3564cc" }}
              aria-label="Blue"
            ></button>
            <button
              className={`color-swatch ${theme === "slate" ? "active" : ""}`}
              data-theme="slate"
              onClick={() => changeTheme("slate")}
              style={{ "--swatch": "#44546f" }}
              aria-label="Slate"
            ></button>
            <button
              className={`color-swatch ${theme === "teal" ? "active" : ""}`}
              data-theme="teal"
              onClick={() => changeTheme("teal")}
              style={{ "--swatch": "#167d7f" }}
              aria-label="Teal"
            ></button>
            <button
              className={`color-swatch ${theme === "green" ? "active" : ""}`}
              data-theme="green"
              onClick={() => changeTheme("green")}
              style={{ "--swatch": "#287a52" }}
              aria-label="Green"
            ></button>
            <button
              className={`color-swatch ${theme === "plum" ? "active" : ""}`}
              data-theme="plum"
              onClick={() => changeTheme("plum")}
              style={{ "--swatch": "#76507c" }}
              aria-label="Plum"
            ></button>
          </div>
          <div className="zoom-controls" aria-label="Preview zoom">
            <button
              id="zoomOut"
              onClick={() => setZoom(Math.max(0.58, zoom - 0.06))}
              aria-label="Zoom out"
            >
              −
            </button>
            <output id="zoomValue">{Math.round(zoom * 100)}%</output>
            <button
              id="zoomIn"
              onClick={() => setZoom(Math.min(1, zoom + 0.06))}
              aria-label="Zoom in"
            >
              +
            </button>
          </div>
        </div>
      </div>
      <div className="paper-stage">
        <ResumePreview
          data={data}
          zoom={zoom}
          textScale={textScale}
          theme={theme}
          layout={layout}
        />
      </div>
    </section>
  );
}
