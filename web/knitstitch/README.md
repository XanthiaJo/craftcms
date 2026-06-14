# KnitStichGrid Web

Konva.js web conversion of the KnitStichGrid WPF desktop app.

## Layout

- `src/main.js` boots the app, wires the sidebar, and attaches the shared store
- `src/konva/` contains the canvas layers and stage wrapper
- `src/services/` holds the grid, sketch, size, and persistence logic
- `src/models/` contains the plain data objects used by the store and services
- `css/app.css` is the app stylesheet imported by `src/main.js`
- `tests/` contains Vitest coverage for the app services and store

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Testing

```bash
npm test
```

## Build

```bash
npm run build
```

## Notes

- `web/dist/main.js` and `web/dist/main.css` are the built outputs consumed by `templates/knitstitch.twig`
- `coverage/` and Vite timestamp files are generated locally and should stay untracked
- `../tests/e2e/` contains the Playwright archive checks for the wider Craft CMS site
