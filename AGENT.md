# AGENT Notes

This repository is a Craft CMS site. The root agent file should describe the intended live setup, where behavior is implemented, and what the front end is supposed to do. Recovery history and one-off import scripts belong in a separate recovery document.

## Implementation Preference

Prefer modeling content and behavior in Craft CMS itself when that is a viable option.

- prefer Craft fields, entry types, sections, category/tag groups, globals, volumes, and project config over hard-coded structure in Twig
- treat Twig as the presentation layer first, not the primary source of content modeling
- only hard-code logic in Twig when the behavior is clearly presentation-specific or there is no sensible Craft-native model for it
- when choosing between a Craft config change and a Twig-only workaround, prefer the Craft change unless it would create disproportionate complexity or risk

## App-Specific Agent Files

Keep root guidance DRY and repository-wide. When working inside a sub-project that has its own agent notes, use that file together with this root file.

Current app-specific agent file:

- KnitStitch Grid:
  - [web/knitstitch/AGENT.md](</E:/Coding Projects/craftcms/web/knitstitch/AGENT.md>)

## Repository Structure

Primary ownership in this repository:

- [config/project/](</E:/Coding Projects/craftcms/config/project/>) - Craft project config for sections, entry types, fields, globals, sites, and volumes
- [templates/](</E:/Coding Projects/craftcms/templates/>) - Twig templates for page rendering
- [web/](</E:/Coding Projects/craftcms/web/>) - public assets and the KnitStitch front-end app
- [scripts/](</E:/Coding Projects/craftcms/scripts/>) - maintenance, recovery, and import scripts; not part of the normal request path
  - `GenerateBuildInfo.php` - cross-platform build info generator. Reads git tags and conventional commit messages to derive a version. Supports `--format=js` (outputs `window.BUILD_INFO` object) and `--format=csharp` (outputs C# `BuildInfo` class). Run via `composer build-info` from the repo root. Also runs automatically after `composer install` via `post-install-cmd`.
  - `GenerateBuildInfo.ps1` - original PowerShell version (Windows-only). Kept for reference; the PHP version is the canonical one used by composer scripts.
- [web/webhook.php](</E:/Coding Projects/craftcms/web/webhook.php>) - GitHub webhook listener for VPS auto-deploy. GitHub sends a push event, the VPS verifies the signature and runs `git pull` + `composer install`. Requires `GITHUB_WEBHOOK_SECRET` in `.env`. See deploy section below.
- [README.md](</E:/Coding Projects/craftcms/README.md>) - project bootstrap notes

## Target Craft Setup

The site should be driven by Craft content and project config, with templates consuming that content cleanly.

Key expectations:

- section and field structure should come from [config/project/](</E:/Coding Projects/craftcms/config/project/>), not ad hoc template assumptions
- templates should read stable field handles and relations that exist in the live field layout
- archive and detail pages should work from canonical Craft entries, not drafts or revisions
- asset volumes and upload locations should resolve to real public file paths under [web/uploads/](</E:/Coding Projects/craftcms/web/uploads/>)
- taxonomy and archive filtering should work from real Craft relations and entry dates

## Core Content Model

### Posts

Posts are the main editorial/project content type.

- section handle: `posts`
- entry type handle: `post`
- section config: [config/project/sections/posts--7e05d885-8a22-4531-b57e-12f3e9d7f469.yaml](</E:/Coding Projects/craftcms/config/project/sections/posts--7e05d885-8a22-4531-b57e-12f3e9d7f469.yaml>)
- entry type config: [config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml](</E:/Coding Projects/craftcms/config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml>)

Expected `post` fields:

- `featuredImage`
- `body`
- `resourceLinks`
- `postImages`
- `designSource`
- `projectTypes`
- `postCategories`
- `postTags`

If these fields disappear from the live entry layout, the front end will behave as if the content is missing even when data still exists elsewhere.

### Posts Archive

The posts archive is a single filtered page.

- archive URL: `/posts`
- archive template: [templates/posts.twig](</E:/Coding Projects/craftcms/templates/posts.twig>)
- single post template: [templates/_entries/post.twig](</E:/Coding Projects/craftcms/templates/_entries/post.twig>)

Archive chrome and editable copy come from the `projectsArchive` Single:

- section handle: `projectsArchive`
- section config: [config/project/sections/projectsArchive--6a47cd07-ec9e-460f-999f-081f64ceeb62.yaml](</E:/Coding Projects/craftcms/config/project/sections/projectsArchive--6a47cd07-ec9e-460f-999f-081f64ceeb62.yaml>)
- entry type config: [config/project/entryTypes/projectsArchive--fd9b9dfd-058f-4810-a86c-3f74aa2d8f4c.yaml](</E:/Coding Projects/craftcms/config/project/entryTypes/projectsArchive--fd9b9dfd-058f-4810-a86c-3f74aa2d8f4c.yaml>)

Editable archive fields:

- `projectsArchiveHeading`
- `projectsArchiveMetaDescription`
- `projectsArchiveSidebarIntro`

### Project Type and Taxonomy

Project classification is handled through Craft taxonomy relations, not separate archive templates.

- `projectTypes` drives the project-type filter and card chip
- `postCategories` drives category filters and post/category links
- `postTags` drives tag filters and post/tag links
- `postDate` drives the year filter

The intended UX is one filtered `/posts` page, not separate category or tag destination pages, even though [templates/category.twig](</E:/Coding Projects/craftcms/templates/category.twig>) and [templates/tag.twig](</E:/Coding Projects/craftcms/templates/tag.twig>) still exist.

## Target Front-End Behavior

### Archive Filtering

Supported filter forms:

- `/posts?projectType[]=<slug>`
- `/posts?category[]=<slug>`
- `/posts?tag[]=<slug>`
- `/posts?year[]=<YYYY>`

Behavior contract:

- clicking category, tag, project type, or year filters should stay on `/posts`
- the archive page chrome should stay fixed while the result set changes
- filter groups combine with `AND` logic across groups
- selections within a single group combine with `OR` logic
- years are derived from `postDate`, not from category terms
- visible category lists should not show year-like terms such as `2023`

### Archive Cards

Expected card behavior in [templates/posts.twig](</E:/Coding Projects/craftcms/templates/posts.twig>):

- show a `Design Source` chip when a `designSource` relation exists
- show a `Project Type` chip when a `projectTypes` relation exists
- prefer `entry.body` for excerpt text
- fall back to a resource-link label or a generic prompt when body content is empty
- render a thumbnail from `featuredImage` when available
- fall back to the first asset in the post image folder when the relation is missing at runtime

### Single Post Pages

Expected detail-page behavior in [templates/_entries/post.twig](</E:/Coding Projects/craftcms/templates/_entries/post.twig>):

- show the main featured image when available
- render `postImages` as a gallery below the body content
- show project type, categories, tags, and year in the sidebar/details area
- emit archive links using array-style query parameters so they seed the same `/posts` filtering UI

## File Ownership

Use these files as the first place to look when behavior changes:

- [templates/posts.twig](</E:/Coding Projects/craftcms/templates/posts.twig>) - archive layout, filter UI, archive card rendering, year extraction
- [templates/_entries/post.twig](</E:/Coding Projects/craftcms/templates/_entries/post.twig>) - single post rendering, post meta, taxonomy links, gallery output
- [templates/knitstitch.twig](</E:/Coding Projects/craftcms/templates/knitstitch.twig>) - Craft template wrapper for the KnitStitch page
- [config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml](</E:/Coding Projects/craftcms/config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml>) - source-of-truth field layout for posts
- [config/project/fields/featuredImage--29579835-63db-4481-b347-52f1852e0eb9.yaml](</E:/Coding Projects/craftcms/config/project/fields/featuredImage--29579835-63db-4481-b347-52f1852e0eb9.yaml>) - featured image field config
- [config/project/fields/postImages--895989d9-cefc-4582-bbad-6736c0c471b8.yaml](</E:/Coding Projects/craftcms/config/project/fields/postImages--895989d9-cefc-4582-bbad-6736c0c471b8.yaml>) - gallery field config
- [config/project/fields/projectTypes--c8ae7352-3ab5-47e7-b586-a001fbe07430.yaml](</E:/Coding Projects/craftcms/config/project/fields/projectTypes--c8ae7352-3ab5-47e7-b586-a001fbe07430.yaml>) - project type taxonomy field
- [config/project/fields/postCategories--52d25c97-f091-4cfb-84f6-e2529d60f743.yaml](</E:/Coding Projects/craftcms/config/project/fields/postCategories--52d25c97-f091-4cfb-84f6-e2529d60f743.yaml>) - category taxonomy field
- [config/project/fields/postTags--5cfa4a6e-5fa2-43f3-a646-d35ea81d5d63.yaml](</E:/Coding Projects/craftcms/config/project/fields/postTags--5cfa4a6e-5fa2-43f3-a646-d35ea81d5d63.yaml>) - tag taxonomy field
- [config/project/volumes/postImages--56b64bf1-40b8-4808-a076-f845aced2527.yaml](</E:/Coding Projects/craftcms/config/project/volumes/postImages--56b64bf1-40b8-4808-a076-f845aced2527.yaml>) - post image volume pathing

## Browser-Level Verification

High-signal checks for the live site:

- `/posts` should show the sidebar sections `Project Type`, `Categories`, `Tags`, and `Year`
- `/posts` should render populated cards with non-empty titles
- `/posts` should render image thumbnails even if `featuredImage` resolution is partially broken, via the per-post folder fallback
- `/posts?category[]=crochet&year[]=2023` should stay on `/posts` and combine filters
- `/posts?projectType[]=<slug>` should stay on `/posts` and filter by project type
- `/posts?category[]=accessories&category[]=crochet&year[]=2023` should stay on `/posts` and return the union of those categories inside the selected year
- `/posts?year[]=2023` should stay on `/posts` and filter by `postDate`
- `/posts?category[]=<slug>` should stay on `/posts` and filter by taxonomy relation
- `/posts?tag[]=<slug>` should stay on `/posts` and filter by taxonomy relation

If the page renders no `<img>` tags but asset files exist on disk, or taxonomy appears empty despite known content, treat that as content/config drift first rather than a template-only problem.

## Recovery and Script History

Old import helpers, recovery scripts, and drift-repair notes live in [docs/content-recovery.md](</E:/Coding Projects/craftcms/docs/content-recovery.md>).

Use that document only when content has been lost, relations have drifted, field layouts no longer match project config, or the database needs to be rebuilt from recovery data.

## VPS Deploy via GitHub Webhook

The VPS auto-deploys when GitHub receives a push to `master`.

### Manual deploy (fallback)

SSH into the VPS and run:

```
cd /var/www/craftcms
git pull origin master
composer install --no-dev --optimize-autoloader
```

`composer build-info` runs automatically via `post-install-cmd`.
