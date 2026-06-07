# AGENT Notes

This repository is a Craft CMS site. The main drift risk in this project is that post entry metadata, featured-image relations, and asset-path config can fall out of sync independently.

## Implementation Preference

Prefer modeling content and behavior in Craft CMS itself when that is a viable option.

- prefer Craft fields, entry types, sections, category/tag groups, globals, volumes, and project config over hard-coding structure into Twig
- treat Twig as the presentation layer first, not the primary source of content modeling
- only hard-code logic in Twig when the behavior is clearly presentation-specific or there is no sensible Craft-native model for it
- when choosing between a Craft config change and a Twig-only workaround, prefer the Craft change unless it would create disproportionate complexity or risk

## Post Structure

- Section handle: `posts`
- Entry type handle: `post`
- Canonical post entries use even-numbered IDs in the current recovered dataset: `2, 4, 6, ... 86`
- Revision/draft-style rows currently exist for many posts as separate element IDs whose `elements.canonicalId` points back to the canonical post

Relevant config:

- [config/project/sections/posts--7e05d885-8a22-4531-b57e-12f3e9d7f469.yaml](</E:/Coding Projects/craftcms/config/project/sections/posts--7e05d885-8a22-4531-b57e-12f3e9d7f469.yaml>)
- [config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml](</E:/Coding Projects/craftcms/config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml>)

Critical post fields expected on the `post` entry type:

- `featuredImage`
- `body`
- `resourceLinks`
- `postImages`
- `designSource`
- `projectTypes`
- `postCategories`
- `postTags`

If `featuredImage` disappears from the live entry type layout, the front end may render no images even if assets and relations still exist.
If `postCategories` or `postTags` disappear from the live entry type layout, the archive cards and filters will behave as if posts have no taxonomy even when `relations` rows still exist.
If `projectTypes` disappears from the live entry type layout, the archive chip and project-type sidebar filter will behave as if projects are untyped.

## Archive Filtering Structure

The posts archive is now a single-page filtered view:

- archive URL: `https://craftcms.ddev.site/posts`
- template: [templates/posts.twig](</E:/Coding Projects/craftcms/templates/posts.twig>)
- single post template: [templates/_entries/post.twig](</E:/Coding Projects/craftcms/templates/_entries/post.twig>)
- archive page chrome is backed by the `projectsArchive` Single section, not hard-coded copy

Relevant archive content model:

- section handle: `projectsArchive`
- section type: `single`
- section URI: `posts`
- entry type handle: `projectsArchive`
- editable archive fields:
  - `projectsArchiveHeading`
  - `projectsArchiveMetaDescription`
  - `projectsArchiveSidebarIntro`

Relevant config:

- [config/project/sections/projectsArchive--6a47cd07-ec9e-460f-999f-081f64ceeb62.yaml](</E:/Coding Projects/craftcms/config/project/sections/projectsArchive--6a47cd07-ec9e-460f-999f-081f64ceeb62.yaml>)
- [config/project/entryTypes/projectsArchive--fd9b9dfd-058f-4810-a86c-3f74aa2d8f4c.yaml](</E:/Coding Projects/craftcms/config/project/entryTypes/projectsArchive--fd9b9dfd-058f-4810-a86c-3f74aa2d8f4c.yaml>)
- [config/project/fields/projectsArchiveHeading--79c2cc19-c161-4916-b859-98f211c101b5.yaml](</E:/Coding Projects/craftcms/config/project/fields/projectsArchiveHeading--79c2cc19-c161-4916-b859-98f211c101b5.yaml>)
- [config/project/fields/projectsArchiveMetaDescription--b38efefa-beb0-4839-9347-42377ec6746d.yaml](</E:/Coding Projects/craftcms/config/project/fields/projectsArchiveMetaDescription--b38efefa-beb0-4839-9347-42377ec6746d.yaml>)
- [config/project/fields/projectsArchiveSidebarIntro--7a2cc7d6-44ed-42f9-ba98-82d4a58c0590.yaml](</E:/Coding Projects/craftcms/config/project/fields/projectsArchiveSidebarIntro--7a2cc7d6-44ed-42f9-ba98-82d4a58c0590.yaml>)

Supported archive filters:

- `/posts?projectType[]=<project-type-slug>&projectType[]=<project-type-slug>`
- `/posts?category[]=<category-slug>&category[]=<category-slug>`
- `/posts?tag[]=<tag-slug>&tag[]=<tag-slug>`
- `/posts?year[]=<YYYY>&year[]=<YYYY>`

Behavior contract:

- clicking a category, tag, or year should stay on `/posts`
- the page chrome stays the same
- only the queried posts change
- categories, tags, and years are multi-selectable and combine with `AND` logic across groups
- within a single group, selected values use `OR` logic

Current implementation detail:

- [templates/posts.twig](</E:/Coding Projects/craftcms/templates/posts.twig>) now renders one GET form with checkbox groups for project types, categories, tags, and years
- filtering is applied in Twig against the ordered post list rather than by switching to separate Craft element queries per taxonomy
- post cards and single-post taxonomy links should emit the array-style query format so they seed the same multiselect UI
- categories should render on archive cards and single-post pages again once canonical relations and the full post layout are both restored

Current archive card behavior:

- cards render a `Design Source` chip when a `designSource` relation exists
- cards render a `Project Type` chip when a `projectTypes` relation exists
- card excerpts prefer `entry.body`
- if `entry.body` is empty, cards fall back to the first resource-link label or a generic archive prompt
- if `entry.featuredImage` fails to resolve at runtime, the archive falls back to the first asset in `postImages` volume folder `posts/<canonicalId>/`

If category or tag clicks start navigating to separate archive templates again, check links in both:

- [templates/posts.twig](</E:/Coding Projects/craftcms/templates/posts.twig>)
- [templates/_entries/post.twig](</E:/Coding Projects/craftcms/templates/_entries/post.twig>)

Separate category/tag templates still exist:

- [templates/category.twig](</E:/Coding Projects/craftcms/templates/category.twig>)
- [templates/tag.twig](</E:/Coding Projects/craftcms/templates/tag.twig>)

But the current intended UX is the filtered `/posts` page, not those separate archive pages.

## Year Handling

Years are no longer a first-class taxonomy in the UI.

Current intended behavior:

- the sidebar section label is `Year`
- the year list is derived from post `postDate`
- year filtering uses `/posts?year[]=<YYYY>`
- visible category lists should not show 4-digit year terms

Implementation detail:

- [templates/posts.twig](</E:/Coding Projects/craftcms/templates/posts.twig>) builds the year list by iterating posts and extracting `postDate|date('Y')`
- year counts are based on `postDate` ranges, not category relations
- [templates/_entries/post.twig](</E:/Coding Projects/craftcms/templates/_entries/post.twig>) shows `Year` in the sidebar using the entry `postDate`

Important: old year-like categories such as `2023` may still exist in `postCategories` data, but the UI intentionally filters them out. Do not reintroduce them into the visible category lists unless that is an explicit product decision.

## Title Storage

Post titles are ultimately read from `elements_sites.title`.

Known-good title recovery source:

- [/.db-sync/craft-local-20260531-220306.sql.gz](</E:/Coding Projects/craftcms/.db-sync/craft-local-20260531-220306.sql.gz>)

Recovery helper:

- [scripts/restore_post_titles.php](</E:/Coding Projects/craftcms/scripts/restore_post_titles.php>)

Verification helpers:

- [scripts/dump_post_titles.php](</E:/Coding Projects/craftcms/scripts/dump_post_titles.php>)
- [scripts/dump_post_titles_raw.php](</E:/Coding Projects/craftcms/scripts/dump_post_titles_raw.php>)

If the admin shows `Untitled entry`, check `elements_sites.title` for the canonical post rows first.

Known drift trigger:

- scripts that call `saveElement()` on `post` entries can blank canonical titles in this repo if they do not explicitly preserve `entry.title` before saving
- [scripts/import_wp_post_galleries.php](</E:/Coding Projects/craftcms/scripts/import_wp_post_galleries.php>) needed this safeguard after gallery imports caused partial title drift
- [scripts/restore_post_content_from_revisions.php](</E:/Coding Projects/craftcms/scripts/restore_post_content_from_revisions.php>) also needs this safeguard because it saves canonical entries while rebuilding `body` and `resourceLinks`

## Featured Image Structure

There are two separate concerns:

1. Asset file paths
2. Entry-to-asset relations

### Asset path invariants

The intended storage layout is:

- `web/uploads/posts/<canonicalId>/<filename>`

Known-good config:

- [config/project/volumes/postImages--56b64bf1-40b8-4808-a076-f845aced2527.yaml](</E:/Coding Projects/craftcms/config/project/volumes/postImages--56b64bf1-40b8-4808-a076-f845aced2527.yaml>)
  - `subpath: posts`
- [config/project/fields/featuredImage--29579835-63db-4481-b347-52f1852e0eb9.yaml](</E:/Coding Projects/craftcms/config/project/fields/featuredImage--29579835-63db-4481-b347-52f1852e0eb9.yaml>)
  - `defaultUploadLocationSubpath: '{canonicalId}'`

Important: do not put `{canonicalId}` directly in the volume subpath. That caused asset URLs like `/uploads/posts/{canonicalId}/2/file.jpg`.

### Relation invariants

Featured image relations must point from the canonical post entry ID to the asset ID in `relations` for field handle `featuredImage`.

Known failure mode seen here:

- relations existed only on revision rows where `elements.canonicalId = <canonical post id>`
- canonical post rows then returned no `featuredImage` on the front end
- after canonical relations were recreated, Craft still only resolved some `featuredImage` assets at runtime even though `relations` rows existed for all canonical posts
- the practical front-end fallback in this repo is to use the first asset from `web/uploads/posts/<canonicalId>/` when the `featuredImage` field returns nothing

Recovery helper:

- [scripts/restore_post_featured_images.php](</E:/Coding Projects/craftcms/scripts/restore_post_featured_images.php>)

Verification helper:

- [scripts/debug_featured_images.php](</E:/Coding Projects/craftcms/scripts/debug_featured_images.php>)

Current recovery behavior of `restore_post_featured_images.php`:

- seeds canonical featured images from revision relations first
- if no revision relation is available, falls back to the first asset found in the matching post folder
- writes the `featuredImage` value via Craft element saves on canonical posts so the field appears correctly in the Control Panel
- preserves `entry.title` before saving to avoid title drift
- normalizes inserted relation rows with `sortOrder: 1`

## Post Gallery Structure

Additional post galleries use the `postImages` asset field.

Current intended behavior:

- `postImages` is available on every `post`
- uploaded gallery assets live in the same volume path pattern as featured images: `web/uploads/posts/<canonicalId>/...`
- the post detail template renders `postImages` as a gallery below the body and above resource-link buttons

Relevant files:

- [config/project/fields/postImages--895989d9-cefc-4582-bbad-6736c0c471b8.yaml](</E:/Coding Projects/craftcms/config/project/fields/postImages--895989d9-cefc-4582-bbad-6736c0c471b8.yaml>)
- [config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml](</E:/Coding Projects/craftcms/config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml>)
- [templates/_entries/post.twig](</E:/Coding Projects/craftcms/templates/_entries/post.twig>)

Original source of extra gallery images:

- WordPress Elementor `_elementor_data` in the original WordPress DB on `localhost`
- extra images are not reliably represented in the normalized body text, and often are not recoverable from the simplified REST body alone

Gallery import helper:

- [scripts/import_wp_post_galleries.php](</E:/Coding Projects/craftcms/scripts/import_wp_post_galleries.php>)

Important: when importing or updating galleries, exclude the featured image from `postImages` and preserve `entry.title` before saving the Craft entry.

## Field Layout Risk

Craft stores live field layout config in the database, not just in YAML.

Relevant places:

- project config file:
  - [config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml](</E:/Coding Projects/craftcms/config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml>)
- live DB:
  - `fieldlayouts.config`

Known drift seen here:

- live `fieldlayouts.config` for the `post` entry type contained an older layout with taxonomy-only fields
- once that happened, `featuredImage` stopped being a valid field handle at runtime
- a later recovery attempt also proved the inverse risk: saving a partial layout can leave only `postCategories` and `postTags` active, dropping `featuredImage`, `body`, `resourceLinks`, and `postImages` at runtime

Recovery helper:

- [scripts/restore_post_entry_layout.php](</E:/Coding Projects/craftcms/scripts/restore_post_entry_layout.php>)

Warning: `fieldlayouts.config` is a JSON object. Do not double-encode it into a JSON string.

Current intended `post` field layout in project config:

- [config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml](</E:/Coding Projects/craftcms/config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml>)
- custom fields in order:
  - `featuredImage`
  - `body`
  - `resourceLinks`
  - `postImages`
  - `projectTypes`
  - `postCategories`
  - `postTags`

Taxonomy field config must also exist in project config:

- [config/project/fields/projectTypes--c8ae7352-3ab5-47e7-b586-a001fbe07430.yaml](</E:/Coding Projects/craftcms/config/project/fields/projectTypes--c8ae7352-3ab5-47e7-b586-a001fbe07430.yaml>)
- [config/project/fields/postCategories--52d25c97-f091-4cfb-84f6-e2529d60f743.yaml](</E:/Coding Projects/craftcms/config/project/fields/postCategories--52d25c97-f091-4cfb-84f6-e2529d60f743.yaml>)
- [config/project/fields/postTags--5cfa4a6e-5fa2-43f3-a646-d35ea81d5d63.yaml](</E:/Coding Projects/craftcms/config/project/fields/postTags--5cfa4a6e-5fa2-43f3-a646-d35ea81d5d63.yaml>)

## Taxonomy Relation Drift

Known failure mode seen here:

- `postCategories` relations existed only on revision element IDs such as `475`, `477`, `482`
- canonical posts such as `2`, `4`, `8` then looked uncategorized on the front end
- sidebar counts based on canonical entry queries returned `0` even though revision relations existed

Additional failure mode discovered (June 2026):

- Relations existed on non-canonical entries (where `elements.canonicalId != elements.id`)
- These non-canonical entries had IDs like 769, 798, 799, etc. pointing to canonical IDs like 767, 2, 4, etc.
- Relations had null or empty `sourceSiteId` values
- Even after moving relations to canonical entries, Craft's element query wouldn't load them until `sourceSiteId` was set to the primary site ID
- Direct database manipulation of relations is unreliable - must use Craft's API (`setFieldValue` + `saveElement`) to properly rebuild relations

Recovery helpers:

- [scripts/restore_post_taxonomy_relations.php](</E:/Coding Projects/craftcms/scripts/restore_post_taxonomy_relations.php>) - Restores relations from revision entries to canonical entries
- For full recovery including sourceSiteId fixes, use: `ddev exec php craft resave/entries --section posts --type post` after restoring relations

Important:

- restore the canonical taxonomy relations first
- ensure `sourceSiteId` is set to the primary site ID (typically 1)
- use Craft's element API to rebuild relations, not direct DB updates
- then restore the full `post` field layout from project config
- both pieces must be correct before categories show up reliably in templates and filters

Current state (June 2026):

- `featuredImage`: 43/43 entries have images restored
- `projectTypes`: 43 entries with relations restored
- `postCategories`: 9 entries with relations restored (some posts may have no categories)
- `designSource`: 0 relations (data never imported from WordPress)
- `postTags`: 0 relations (data never imported from WordPress)

## Helper Scripts

### Essential Recovery Scripts (keep these)

- `create_design_source_taxonomy.php` - Creates design source taxonomy if needed
- `create_taxonomies.php` - Creates category/tag taxonomies and seeds from HTML snapshot
- `import_wordpress_posts.php` - Main WordPress import script
- `import_wp_post_galleries.php` - Imports post galleries from WordPress Elementor data
- `normalize_posts_content.php` - Normalizes post content and extracts resource links
- `restore_post_content_from_revisions.php` - Restores body and resourceLinks from revision rows
- `restore_post_entry_layout.php` - Restores field layout from project config
- `restore_post_featured_images.php` - Restores featured images from revision relations
- `restore_post_taxonomy_relations.php` - Restores taxonomy relations from revision entries
- `restore_post_titles.php` - Restores post titles from DB snapshot
- `fix_asset_folders.php` - Fixes asset folder structure

### Content Creation Scripts (keep these)

- `create_home_content.php` - Creates home page content
- `create_projects_archive_single.php` - Creates projects archive single entry
- `create_site_header.php` - Creates site header global set

### Deployment Script (keep this)

- `push-local-db-to-live.ps1` - PowerShell script for pushing local DB to live

### Temporary Debugging Scripts (delete these after use)

If you create temporary debugging scripts (e.g., `check_*.php`, `debug_*.php`, `inspect_*.php`), delete them after resolving the issue. These scripts are not part of the recovery workflow and should not be committed.

## Project Type Taxonomy

`Project Type` is a category-style taxonomy used to classify software projects independently from topical categories.

Current intended behavior:

- the archive sidebar shows `Project Type` above `Categories`
- archive cards show the first assigned project type as a chip above the title/date block
- single-post pages show `Project Type` in the right-hand details sidebar
- filtering uses `/posts?projectType[]=<slug>`

Relevant files:

- [templates/posts.twig](</E:/Coding Projects/craftcms/templates/posts.twig>)
- [templates/_entries/post.twig](</E:/Coding Projects/craftcms/templates/_entries/post.twig>)
- [scripts/create_taxonomies.php](</E:/Coding Projects/craftcms/scripts/create_taxonomies.php>)

## Useful Recovery Order

If this drifts again, use this order:

1. Verify titles on canonical entries with `scripts/dump_post_titles.php`
2. Verify the `post` entry type layout still contains `featuredImage`
3. Verify asset URLs resolve under `/uploads/posts/<id>/...`
4. Verify `featuredImage` relations point at canonical post entry IDs, not only revision IDs
5. Reapply project config if the YAML is correct: `ddev craft project-config/apply`
6. Restore titles if needed: `ddev php scripts/restore_post_titles.php`
7. Restore featured-image relations if needed: `ddev php scripts/restore_post_featured_images.php`
8. Restore taxonomy relations if categories are missing on canonical posts: `ddev php scripts/restore_post_taxonomy_relations.php`
9. **CRITICAL**: After restoring relations, rebuild them using Craft's API to fix sourceSiteId: `ddev exec php craft resave/entries --section posts --type post`
10. Restore the full post entry layout from project config if taxonomy/image/body fields are invalid at runtime: `ddev php scripts/restore_post_entry_layout.php`
11. Restore body/resource links from revision rows if needed: `ddev php scripts/restore_post_content_from_revisions.php`
12. Import extra WordPress gallery images if needed: `ddev php scripts/import_wp_post_galleries.php`
13. If archive cards still lack images after relation repair, verify the template-level asset-folder fallback in [templates/posts.twig](</E:/Coding Projects/craftcms/templates/posts.twig>) and [templates/_entries/post.twig](</E:/Coding Projects/craftcms/templates/_entries/post.twig>)

## Browser-Level Verification

The posts archive should show image tags on:

- `https://craftcms.ddev.site/posts`

If the page renders no `<img>` tags but asset files exist on disk, check field layout drift and relation drift before touching templates.

Current high-signal browser checks:

- `/posts` should show the sidebar sections `Project Type`, `Categories`, `Tags`, and `Year`
- `/posts` should show populated project cards with non-empty title links
- `/posts` should render image thumbnails even if `featuredImage` field resolution is partially broken, via the per-post folder fallback
- `/posts?category[]=crochet&year[]=2023` should stay on the posts archive and combine filters
- `/posts?projectType[]=<slug>` should stay on the posts archive and filter by project-type relation
- `/posts?category[]=accessories&category[]=crochet&year[]=2023` should stay on the posts archive and return the union of those categories inside the selected year
- `/posts?year[]=2023` should stay on the posts archive and filter by `postDate`
- `/posts?category[]=<slug>` should stay on the posts archive and filter by taxonomy relation
- `/posts?tag[]=<slug>` should stay on the posts archive and filter by taxonomy relation
