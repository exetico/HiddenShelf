# To do

## Next up

1. Add license (add license + mention in README.md)
2. Add to docker hub?
3. Make restore function
4. Update data retention disclaimer
5. Make the AI with Sonnet 4.5 check for SECURITY CONSERNS
6. Make Backup to cloud, or whatever?
7. Make "Bulk create", right? Instead of it having to loop through everyone, right?
8. Allow no OAUTH/Maybe local user+password login, or similar?
9. Migrate the link and category metadata/options to a solution, maybe like the one used in user settings? (or?)
10. Config for "site url" and "subpath"/subdomain, for people running it behind a proxy
11. Consider moving the db migrations to another path, so it's not linked to the filesystem, like the `db`
12. Possible take a look at the `debug.php` site: What needs to be done? Is it secure?
13. Check for SQL injection things, we don't want
14. Make guide on how to deploy to PHP host, without using Docker (preparing -> deploy -> validate)
15. Add some logic so the user is redirected to front-page, if wrong uri used, or similar. If invalid link, make a toast about that, or? Something linke that?
16. SEO data, and SEO friendly public link meta data on page
17. Make a "report public link" function.

## Bugs

None defined right now

## Future Enhancements and Ideas

- Browser extension for quick saving
- Import from browser bookmarks
- Full-text search
- Link previews/thumbnails
- Archive.org integration
