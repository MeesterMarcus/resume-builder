import { useLayoutEffect, useRef } from "react";
import { renderPreview } from "../resume-renderer.js";

// Pagination moves measured blocks between pages. Keep that print DOM isolated
// from React reconciliation; React owns its container and input data.
export default function ResumePreview({
  data,
  zoom,
  textScale,
  theme,
  layout,
}) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    document.documentElement.dataset.resumeTheme = theme;
    document.documentElement.dataset.resumeLayout = layout;
    document.documentElement.style.setProperty(
      "--resume-type-scale",
      textScale,
    );
    let active = true;
    const render = () => {
      if (active) renderPreview(ref.current, data, zoom, textScale);
    };
    render();
    document.fonts?.ready.then(render);
    window.addEventListener("beforeprint", render);
    return () => {
      active = false;
      window.removeEventListener("beforeprint", render);
    };
  }, [data, zoom, textScale, theme, layout]);
  return <div className="paper-stack" id="resumePreview" ref={ref} />;
}
