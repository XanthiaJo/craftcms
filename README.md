# CraftCMS

Craft CMS site for the Structured Chaos portfolio and KnitStitch Grid app.

## Layout

- `templates/` contains Twig templates and shared partials
- `web/` contains the shared site CSS/JS assets and the KnitStitch subproject
- `config/` holds Craft project config
- `scripts/` contains recovery and content-management helpers
- `docs/` contains site structure, CSS, and recovery notes
- `AGENTS.md` tracks repo-specific working notes and recovery guidance

## Documentation

Start here when working on the site shell or content model:

- [Site Structure](docs/site-structure.md)
- [CSS Guidelines](docs/css-guidelines.md)
- [Content Recovery Notes](docs/content-recovery.md)

## KnitStitch Grid

The KnitStitch Grid editor lives at `/knitstitch`.

Source and build files:

- `web/knitstitch/src/`
- `web/knitstitch/css/app.css`
- `web/knitstitch/README.md`

Commands, run from `web/knitstitch/`:

```bash
npm install
npm run dev
npm run build
npm test
```
