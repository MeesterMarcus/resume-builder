# CV Studio

A React + Vite résumé editor with an ATS-friendly two-page layout and a Cloudflare Worker API. Changes update the preview instantly; the Save button persists the draft and version history in the browser.

## AI features

Create a `.env` file in the project root:

```bash
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=your_model
```

The Node server keeps the API key out of the browser. The AI assistant can optimize the current résumé, follow a freeform editing request, or use an uploaded résumé and job description as additional context.

## Install

```bash
npm install
```

## Development

```bash
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://127.0.0.1:5173/app/`). This starts Vite with React Fast Refresh and the local Node API on port 8080. Vite proxies `/api/*` to that API. Local AI credentials come from `.env`; without a configured key, you can still edit résumés and use the per-tab BYOK option.

To preview the production build with the Node API:

```bash
npm run preview
```

For production-equivalent Worker behavior, use `npm run preview:cloudflare` with `.dev.vars`.

## Frontend structure

- `src/App.jsx` owns the résumé draft, saves, backups, and version history.
- `src/components/` contains the editor, toolbar, preview, gallery, AI drawer, history, and confirmation modal.
- `src/resume-renderer.js` retains measured two-page pagination inside an isolated React preview container.
- Public landing, roadmap, and legal pages remain static HTML, processed by Vite as separate entry points.
- `public/` contains stable asset URLs, robots, sitemap, and the web manifest.
- `worker/` remains the deployed API. Vite builds into `dist/site`; the build script also produces the `.page` aliases used by the Worker.

Existing `cv-studio-*` storage keys and backup formats remain compatible. Authentication and cloud persistence are not configured yet.

## Verification

```bash
npm test
npm run test:browser
```

Browser checks use Puppeteer and a local server, cover the main editor flows, and mock AI responses without spending API credits. Install its browser once with `npx puppeteer browsers install chrome`, or set `PUPPETEER_EXECUTABLE_PATH` to an installed Chrome executable. Screenshots and a test PDF are written under `tmp/`.


## Build PDF

```bash
npm run build:pdf
```

The generated file is saved to `dist/marcus-lorenzana-resume.pdf`. You can also use **Export PDF** in the app and choose “Save as PDF” in the browser print dialog.

## Cloudflare

The production build deploys a Cloudflare Worker and static assets as one unit. The Worker handles `/api/*`; matching files are served directly from Cloudflare's asset infrastructure.

```bash
nvm use
npm install
npm run build
npm run preview:cloudflare
```

For Cloudflare Builds:

- Build command: `npm run build`
- Root directory: `/`
- Node version: `22`
- Deploy command: `npx wrangler deploy`

Add `OPENAI_API_KEY` as an encrypted **Worker runtime secret** under **Workers & Pages → Overview → resume-builder → Settings → Variables and Secrets**. Do not add it under Workers Builds → Build configuration; Workers Builds variables are not available to the running Worker. `OPENAI_MODEL` and `AI_ALLOWED_IPS` are non-secret values managed in `wrangler.jsonc`.

AI revisions are temporarily restricted to the comma-separated IP addresses in `AI_ALLOWED_IPS`. The checked-in Wrangler configuration currently allows `136.50.177.197`. Update that value whenever the trusted public IP changes. Localhost remains allowed for development.

For local Worker development, copy `.dev.vars.example` to `.dev.vars` and supply development credentials. Never commit `.dev.vars` or `.env`.

Deploy from the CLI with:

```bash
npm run deploy:cloudflare
```

If Cloudflare asks for a deploy command in its build settings, use:

```bash
npx wrangler deploy
```
