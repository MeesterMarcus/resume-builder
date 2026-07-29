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
