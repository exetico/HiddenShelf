# To do

## Next up

1. Add license (add license + mention in README.md)
2. Add to docker hub?
3. Make restore function (database, or? It must be?)
4. Update data retention disclaimer
5. ~~Make the AI with Sonnet 4.5 check for SECURITY CONSERNS~~ Done (deploy readiness review)
6. Make Backup to cloud, or whatever?
7. Make "Bulk create", right? Instead of it having to loop through everyone, right?
8. Allow no OAUTH/Maybe local user+password login, or similar?
9. Migrate the link and category metadata/options to a solution, maybe like the one used in user settings? (or?)
10. Config for "site url" and "subpath"/subdomain, for people running it behind a proxy
11. ~~Consider moving the db migrations to another path, so it's not linked to the filesystem, like the `db`~~ Done: now in `migrations/`
12. ~~Possible take a look at the `debug.php` site: What needs to be done? Is it secure?~~ Done: only reachable with `DEBUG_MODE` on
13. ~~Check for SQL injection things, we don't want~~ Done: all queries use prepared statements
14. Make guide on how to deploy to PHP host, without using Docker (preparing -> deploy -> validate)
15. Add some logic so the user is redirected to front-page, if wrong uri used, or similar. If invalid link, make a toast about that, or? Something linke that?
16. SEO data for page (overall)
17. SEO friendly public link meta data on page
18. Make a "report public link" function.
19. Add basic visits count dashboard, maybe over period, and total count, or similar. Basic, on the frontpage. Maybe add a view count for a given link if opened in "edit mode", but prevent too much load of stats, so only show it in the edit link-popup.
20. Bulk "Direct redirect" set all links
21. Show "Direct redirect" option on the "Edit overview", for each link
22. ~~Validate that "Shared category" and "Direct redirect" is part of export->import logics~~ Done: direct redirect is exported and imported
23. ~~Export should not export "Shared links through categories". Maybe tell the user about that, instead.~~ Done: export skips them and says so

## Bugs

None defined right now

## Future Enhancements and Ideas

- Browser extension for quick saving
- Import from browser bookmarks
- Full-text search
- Link previews/thumbnails
- Archive.org integration
