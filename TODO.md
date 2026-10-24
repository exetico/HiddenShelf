# To do

## High Priority

1. Add restore function (database backup restoration)
2. Add backup to cloud functionality
3. Config for "site url" and "subpath" for users running behind proxy
4. Make guide on how to deploy without Docker (preparing → deploy → validate)

## Features & Enhancements

### Link Management

- Bulk create functionality (avoid looping through individual creations)
- Bulk "Direct redirect" toggle for all links

### Import/Export

- Bulk create for imports (performance improvement)

### Authentication & Security

- Allow no-OAuth option / local user+password login

### SEO & Public Links

- Add "report public link" function

### Architecture & Technical Debt

- Migrate link and category metadata/options to settings-like JSON solution
- Consider consolidating backend to same port with `/api` subpath (maintain proxy support)

## Future Enhancements and Ideas

- Browser extension for quick saving
- Import from browser bookmarks
- Full-text search
- Link previews/thumbnails
- Archive.org integration
