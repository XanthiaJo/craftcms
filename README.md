# CraftCMS

Craft CMS site for the Structured Chaos portfolio and KnitStitch Grid app.

## Layout

- `templates/` contains Twig templates and shared partials
- `web/` contains the shared site CSS/JS assets and the KnitStitch subproject
- `config/` holds Craft project config
- `scripts/` contains recovery and content-management helpers
- `AGENT.md` tracks repo-specific working notes and recovery guidance

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

## Notes

- Local secrets such as `config/license.key` should stay untracked
- Generated KnitStitch coverage and Vite timestamp files should stay untracked
- `.tmp_localhost_*.html` files are local snapshots and should not be committed
