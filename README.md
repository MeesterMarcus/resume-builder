# CV Studio

A privacy-first HTML/CSS resume editor with a polished, ATS-friendly two-page layout. Changes update the preview instantly and save in the browser.

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

## Preview

```bash
npm run preview
```

Then open the local server URL shown in the terminal.

## Build PDF

```bash
npm run build
```

The generated file is saved to `dist/marcus-lorenzana-resume.pdf`. You can also use **Export PDF** in the app and choose “Save as PDF” in the browser print dialog.

## Cloudflare Pages

The production build uses static assets plus Pages Functions for the AI routes.

```bash
nvm use
npm install
npm run build:pages
npm run preview:pages
```

For Cloudflare Git integration:

- Build command: `npm run build:pages`
- Build output directory: `dist/site`
- Root directory: `/`
- Node version: `22`

Add `OPENAI_API_KEY` as an encrypted secret and `OPENAI_MODEL` as a variable under **Workers & Pages → resume-builder → Settings → Variables and Secrets**. Configure both Preview and Production.

AI revisions are temporarily restricted to the comma-separated IP addresses in `AI_ALLOWED_IPS`. The checked-in Wrangler configuration currently allows `136.50.177.197`. Update that value whenever the trusted public IP changes. Localhost remains allowed for development.

For local Pages Functions development, copy `.dev.vars.example` to `.dev.vars` and supply development credentials. Never commit `.dev.vars` or `.env`.

After creating the Pages project, deploy from the CLI with:

```bash
npm run deploy:pages
```
