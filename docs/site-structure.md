# Site Structure

This repository has two page systems:

- the main Craft CMS site
- the KnitStitch app at `/knitstitch`

This document covers the Craft CMS site.

## Shared Page Shell

Every public Craft page should use the same shell:

1. `templates/_partials/site-header.twig`
2. `templates/_partials/page-subheader.twig`
3. page-specific content
4. `templates/_partials/site-footer.twig`

The only exception is the homepage, which uses a larger hero instead of the shared subheader.

If you create a new page template, it should follow that pattern unless there is a very clear reason not to.

## Shared Layout Rules

- Use `web/css/site.css` for the shared layout and typography.
- Keep page width consistent by using the shared `.container` and page layout classes.
- Avoid per-template spacing, width, and color rules unless the page is truly unique.
- Prefer semantic markup over template-specific presentation hooks.

## Current Page Types

### Homepage

- Template: `templates/index.twig`
- Purpose: portfolio landing page
- Uses:
  - shared header and footer
  - custom hero section
  - project card grid

### Posts Archive

- Template: `templates/posts.twig`
- Purpose: project archive and filter page
- Uses:
  - shared header and footer
  - shared page subheader
  - archive grid
  - shared sidebar filters

### Post Entry

- Template: `templates/_entries/post.twig`
- Purpose: full post/project detail page
- Uses:
  - shared header and footer
  - shared page subheader
  - main content column
  - shared sidebar partial

### Category and Tag Archive Pages

- Templates: `templates/category.twig`, `templates/tag.twig`
- Purpose: taxonomy archive views
- Uses:
  - shared header and footer
  - shared page subheader
  - shared archive layout

### Markdown Page

- Template: `templates/_entries/markdown-page.twig`
- Purpose: reusable page for rendering remote Markdown content
- Uses:
  - shared header and footer
  - shared page subheader
  - the same content shell as a post detail page

### KnitStitch

- Template: `templates/knitstitch.twig`
- Purpose: separate app view for the KnitStitch editor
- Uses:
  - shared site header and footer
  - shared page subheader
  - KnitStitch-specific app shell and JS bundle

## Content Model

### Global Sets

- `siteHeader`
  - site name
  - top navigation
  - project links
- `home`
  - homepage hero content
  - homepage cards

### Sections

- `posts`
  - entry type: `post`
  - archive and detail content
- `projectsArchive`
  - archive metadata and sidebar text
- `markdownPage`
  - entry type: `markdownPage`
  - reusable remote Markdown pages

### Taxonomy Groups

- `postCategories`
- `postTags`
- `designSources`
- `projectTypes`

## Field Usage Notes

- Keep field names descriptive and stable.
- If a page needs a new field, add it in project config and document the purpose here.
- Prefer reusing an existing field or taxonomy group before adding a new one.
- Do not hide content structure inside template-local variables when it belongs in Craft config.

## Adding A New Page

When adding a page:

1. Create the Craft section or entry type first.
2. Add the fields needed in project config.
3. Add or update the Twig template.
4. Make it use the shared header, subheader, and footer.
5. Add styling to `web/css/site.css` instead of inlining it in the template.
6. Document the new page in this file.

