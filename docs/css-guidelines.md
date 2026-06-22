# CSS Guidelines

This project keeps styling centralized in `web/css/site.css`.

## Rules

- Put shared styles in `web/css/site.css`.
- Avoid inline styles in Twig templates.
- Use inline styles only when the value is genuinely dynamic and cannot be expressed cleanly in shared CSS.
- Prefer semantic HTML elements first, then shared utility classes, then component classes.
- Do not create one-off style blocks in templates for layout, spacing, color, or typography.

## Typography

Use the shared semantic type scale:

- `h1` through `h6`
- `.body`
- `.subtitle`
- `.caption`
- `.button`

If a page needs custom typography, add a reusable class to `site.css` instead of duplicating font rules inside a template.

## Colors

The site palette is defined in CSS variables at `:root`.

Use the semantic color tokens:

- `--body`
- `--primary`
- `--secondary`
- `--tertiary`
- plus their `-light` and `-dark` variants

Do not hardcode new color values in templates.

## Layout

The shared layout already includes:

- site header
- page subheader
- content width
- card styles
- sidebar panel styles
- footer

Before adding a new wrapper or spacing rule, check whether an existing layout class can be reused.

## Markdown And Rich Text

Markdown and long-form content should use the shared `.body` styles in `site.css`.

That file already handles:

- paragraphs
- headings
- lists
- blockquotes
- code blocks
- tables
- images

If a page needs a special content treatment, add a scoped class in `site.css` and keep the template markup clean.

## Cards And Chips

Cards should use the shared card classes and chip classes rather than per-template styling.

Use the existing pattern:

- `.card`
- `.card-content`
- `.card-heading`
- `.card-chips`
- `.card-type-chip`
- `.card-design-source-chip`

If a new chip color is needed, add a named variant in `site.css` rather than using inline background colors.

## Templates

When editing a template:

1. Prefer semantic HTML.
2. Reuse existing classes.
3. Add shared styles to `site.css` when the pattern may repeat elsewhere.
4. Avoid local `<style>` blocks unless you are prototyping and immediately removing them.

