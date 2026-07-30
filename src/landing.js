const root = document.documentElement;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

root.classList.add("motion-ready");

const revealGroups = [
  { selector: ".proof-strip > *", direction: "up", step: 90 },
  { selector: ".steps .section-heading", direction: "left" },
  { selector: ".step-grid article", direction: "up", step: 110 },
  { selector: ".feature-copy > *", direction: "left", step: 80 },
  { selector: ".feature-grid article", direction: "right", step: 90 },
  { selector: ".final-cta > *", direction: "up", step: 100 },
  { selector: ".support-inner > div:not(.support-mark)", direction: "up", step: 100 },
];

const revealElements = revealGroups.flatMap(({ selector, direction = "up", step = 0 }) =>
  [...document.querySelectorAll(selector)].map((element, index) => {
    element.dataset.reveal = direction;
    element.style.setProperty("--reveal-delay", `${index * step}ms`);
    return element;
  }),
);

function revealEverything() {
  revealElements.forEach((element) => element.classList.add("is-visible"));
}

if (reduceMotion.matches || !("IntersectionObserver" in window)) {
  root.classList.add("page-loaded");
  revealEverything();
} else {
  requestAnimationFrame(() => root.classList.add("page-loaded"));
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
  );
  revealElements.forEach((element) => observer.observe(element));
}

reduceMotion.addEventListener?.("change", (event) => {
  if (event.matches) revealEverything();
});
