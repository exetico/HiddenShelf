# To do

## Bugs

1. Public links redirect instantly - users need to see it's a redirect (visibility issue)
2. Visit stats exist but need better visibility in the UI
3. Dashboard stat cards (Links, Categories, Tags) are not clickable - should navigate to related pages
4. Categories count on dashboard shows "1" but doesn't include shared categories (should show 2+)

## High Priority

1. Add license file and mention in README.md
2. Update data retention disclaimer for beta service
3. Add restore function (database backup restoration)
4. Add backup to cloud functionality
5. Config for "site url" and "subpath" for users running behind proxy
6. Invalid URI handling - redirect to front-page with toast notification
7. Make guide on how to deploy without Docker (preparing → deploy → validate)

## Features & Enhancements

### Statistics & Monitoring

- Add basic visits count dashboard (period + total count)
- Show visit count in edit link popup (avoid overloading with stats)

### Link Management

- Bulk create functionality (avoid looping through individual creations)
- Bulk "Direct redirect" toggle for all links
- Show "Direct redirect" option in edit overview for each link

### Import/Export

- Validate that "Shared category" and "Direct redirect" are included in export/import
- Export should exclude "Shared links through categories" - notify user about this
- Bulk create for imports (performance improvement)
- Does the system work, in a fresh newly created docker container?

### Authentication & Security

- Allow no-OAuth option / local user+password login
- Review `debug.php` security (if still exists)
- Verify SQL injection protection (likely covered in security audit)

### SEO & Public Links

- Add SEO meta data for overall page
- Add SEO-friendly meta data for public links
- Add "report public link" function

### Architecture & Technical Debt

- Migrate link and category metadata/options to settings-like JSON solution
- Consider moving db migrations to different path (not filesystem `db/`)
- Consider consolidating backend to same port with `/api` subpath (maintain proxy support)

### Legacy PHP Cleanup

- Determine if PHP deployment guide is still needed (post-Hono migration)

## Future Enhancements and Ideas

- Browser extension for quick saving
- Import from browser bookmarks
- Full-text search
- Link previews/thumbnails
- Archive.org integration
