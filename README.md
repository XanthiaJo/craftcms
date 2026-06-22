# Structured Chaos

A personal portfolio site covering the things I actually make — crocheted garments and accessories, sewn pieces, parametric 3D models, and the occasional software tool that exists because I needed it to.

The site is built on Craft CMS and is itself a running project. The content model, templates, and archive UI have all been shaped iteratively alongside the portfolio entries they serve. Building the site *is* part of the portfolio.

## What's in the archive

### Crochet & fibre

Garments, accessories, and household items worked up from published patterns and my own drafts. Entries cover yarn choices, construction notes, and any modifications made along the way. The archive is filterable by project type, category, tag, and year — handy when I want to look back at everything I made in a particular season or with a particular technique.

### Sewing & textiles

Sewn pieces from fashion fabric and quilting cotton alike. Some follow commercial patterns closely; others are hacked together from multiple sources or drafted from scratch. Process notes live on each post so the decisions are recorded somewhere other than my head.

### Parametric modelling

3D models built in Fusion 360, mostly functional objects designed to solve a specific problem. Parametric modelling means the dimensions are driven by variables rather than fixed geometry, so a bracket or an organiser can be resized cleanly without rebuilding from scratch. Project entries usually include the design rationale and any iteration the model went through before it was printed or fabricated.

### Tools & software

Software I have built because I needed it — including [KnitStitch Grid](#knitstitch-grid), a browser-based stitch chart editor for knitting and crochet. Development on these tools is documented alongside the other project work rather than in a separate engineering blog.

## How the site is built

The front end is Craft CMS with Twig templates. Content modelling — sections, fields, taxonomies — is managed through Craft project config and version-controlled alongside the templates. Archive filtering is handled server-side; the sidebar form submits back to `/posts` and Twig does the query logic.

Most of the development has been done with AI coding tools in the loop. The agent notes that shape how those sessions run are in `AGENTS.md`. The site is hosted on a VPS and deploys automatically when commits land on the main branch via a GitHub webhook.

## KnitStitch Grid

A browser-based grid editor for charting stitch patterns. Lives at `/knitstitch` on the site and has its own source tree under `web/knitstitch/`.

```bash
# from web/knitstitch/
npm install
npm run dev
npm run build
npm test
```

## Repository layout

- `templates/` — Twig templates and shared partials
- `web/` — public CSS/JS assets and the KnitStitch subproject
- `config/project/` — Craft project config (sections, fields, entry types, volumes)
- `scripts/` — recovery and content-management helpers
- `docs/` — site structure notes, CSS guidelines, and content recovery history
- `AGENTS.md` — working rules and conventions for agent-assisted development sessions
