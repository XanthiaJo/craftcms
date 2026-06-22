# Content Recovery and Script Notes

This document is for recovery, import, and drift-repair work. It is not the normal operating guide for the repository.

Use it only when database content has been lost, canonical relations have drifted, field layouts no longer match project config, or post media/taxonomy content needs to be reconstructed.

## Recovery Risks

The main historical drift risks in this repository are:

- canonical post titles diverging from expected values
- featured-image relations existing on revisions or non-canonical entries instead of canonical entries
- taxonomy relations existing on revisions or with bad site context
- live field layouts diverging from [config/project/](</E:/Coding Projects/craftcms/config/project/>)
- asset path configuration no longer matching the intended uploads structure

## Recovery Reference

### Title Storage

Post titles are ultimately read from `elements_sites.title`.

Known-good title recovery source:

- [/.db-sync/craft-local-20260531-220306.sql.gz](</E:/Coding Projects/craftcms/.db-sync/craft-local-20260531-220306.sql.gz>)

Recovery helper:

- [scripts/restore_post_titles.php](</E:/Coding Projects/craftcms/scripts/restore_post_titles.php>)

Verification helpers:

- [scripts/dump_post_titles.php](</E:/Coding Projects/craftcms/scripts/dump_post_titles.php>)
- [scripts/dump_post_titles_raw.php](</E:/Coding Projects/craftcms/scripts/dump_post_titles_raw.php>)

Known drift trigger:

- scripts that call `saveElement()` on `post` entries can blank canonical titles if they do not explicitly preserve `entry.title` before saving

### Featured Image Structure

There are two separate concerns:

1. asset file paths
2. entry-to-asset relations

Asset path invariant:

- `web/uploads/posts/<canonicalId>/<filename>`

Known-good config:

- [config/project/volumes/postImages--56b64bf1-40b8-4808-a076-f845aced2527.yaml](</E:/Coding Projects/craftcms/config/project/volumes/postImages--56b64bf1-40b8-4808-a076-f845aced2527.yaml>)
- [config/project/fields/featuredImage--29579835-63db-4481-b347-52f1852e0eb9.yaml](</E:/Coding Projects/craftcms/config/project/fields/featuredImage--29579835-63db-4481-b347-52f1852e0eb9.yaml>)

Important:

- do not put `{canonicalId}` directly in the volume subpath

Recovery helpers:

- [scripts/restore_post_featured_images.php](</E:/Coding Projects/craftcms/scripts/restore_post_featured_images.php>)
- [scripts/debug_featured_images.php](</E:/Coding Projects/craftcms/scripts/debug_featured_images.php>)

Current recovery behavior of `restore_post_featured_images.php`:

- seed canonical featured images from revision relations first
- if no revision relation is available, fall back to the first asset found in the matching post folder
- write the `featuredImage` value via Craft element saves on canonical posts so the field appears correctly in the Control Panel
- preserve `entry.title` before saving
- normalize inserted relation rows with `sortOrder: 1`

### Post Gallery Structure

Additional post galleries use the `postImages` asset field.

Relevant files:

- [config/project/fields/postImages--895989d9-cefc-4582-bbad-6736c0c471b8.yaml](</E:/Coding Projects/craftcms/config/project/fields/postImages--895989d9-cefc-4582-bbad-6736c0c471b8.yaml>)
- [config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml](</E:/Coding Projects/craftcms/config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml>)
- [templates/_entries/post.twig](</E:/Coding Projects/craftcms/templates/_entries/post.twig>)

Original source of extra gallery images:

- WordPress Elementor `_elementor_data` in the original WordPress DB on `localhost`

Gallery import helper:

- [scripts/import_wp_post_galleries.php](</E:/Coding Projects/craftcms/scripts/import_wp_post_galleries.php>)

Important:

- exclude the featured image from `postImages`
- preserve `entry.title` before saving

### Field Layout Risk

Craft stores live field layout config in the database, not just in YAML.

Relevant places:

- [config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml](</E:/Coding Projects/craftcms/config/project/entryTypes/post--d7835db0-9bc7-4ee6-8ad8-acd09625daf0.yaml>)
- live DB `fieldlayouts.config`

Known drift seen here:

- live `fieldlayouts.config` for the `post` entry type contained an older layout with taxonomy-only fields
- saving a partial layout can leave only `postCategories` and `postTags` active, dropping `featuredImage`, `body`, `resourceLinks`, and `postImages` at runtime

Recovery helper:

- [scripts/restore_post_entry_layout.php](</E:/Coding Projects/craftcms/scripts/restore_post_entry_layout.php>)

Warning:

- `fieldlayouts.config` is a JSON object; do not double-encode it into a JSON string

### Taxonomy Relation Drift

Known failure modes seen here:

- taxonomy relations existed only on revision element IDs
- relations existed on non-canonical entries where `elements.canonicalId != elements.id`
- relations had null or empty `sourceSiteId` values

Important:

- restore canonical taxonomy relations first
- ensure `sourceSiteId` is set to the primary site ID
- use Craft's API with `setFieldValue` plus `saveElement`, not direct DB updates, when rebuilding relations

Recovery helpers:

- [scripts/restore_post_taxonomy_relations.php](</E:/Coding Projects/craftcms/scripts/restore_post_taxonomy_relations.php>)
- `ddev exec php craft resave/entries --section posts --type post`

## Script Inventory

### Essential Recovery Scripts

- `create_design_source_taxonomy.php`
- `create_taxonomies.php`
- `import_wordpress_posts.php`
- `import_wp_post_galleries.php`
- `normalize_posts_content.php`
- `restore_post_content_from_revisions.php`
- `restore_post_entry_layout.php`
- `restore_post_featured_images.php`
- `restore_post_taxonomy_relations.php`
- `restore_post_titles.php`
- `fix_asset_folders.php`

### Content Creation Scripts

- `create_home_content.php`
- `create_projects_archive_single.php`
- `create_site_header.php`

### Deployment Helper

- `push-local-db-to-live.ps1`

### Temporary Debugging Scripts

Temporary debugging scripts such as `check_*.php`, `debug_*.php`, and `inspect_*.php` should be deleted after use and should not be committed as part of the normal project state.

## Useful Recovery Order

If content drifts again, use this order:

1. Verify titles on canonical entries with `scripts/dump_post_titles.php`
2. Verify the `post` entry type layout still contains `featuredImage`
3. Verify asset URLs resolve under `/uploads/posts/<id>/...`
4. Verify `featuredImage` relations point at canonical post entry IDs, not only revision IDs
5. Reapply project config if the YAML is correct: `ddev craft project-config/apply`
6. Restore titles if needed: `ddev exec php scripts/restore_post_titles.php`
7. Restore featured-image relations if needed: `ddev exec php scripts/restore_post_featured_images.php`
8. Restore taxonomy relations if categories are missing on canonical posts: `ddev exec php scripts/restore_post_taxonomy_relations.php`
9. Rebuild relations using Craft's API to fix `sourceSiteId`: `ddev exec php craft resave/entries --section posts --type post`
10. Restore the full post entry layout from project config if taxonomy/image/body fields are invalid at runtime: `ddev exec php scripts/restore_post_entry_layout.php`
11. Restore body and resource links from revision rows if needed: `ddev exec php scripts/restore_post_content_from_revisions.php`
12. Import extra WordPress gallery images if needed: `ddev exec php scripts/import_wp_post_galleries.php`
