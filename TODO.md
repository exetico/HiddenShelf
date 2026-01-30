# To do

## Next up

1. Add license (add license + mention in README.md)
2. Add to docker hub?
3. Make restore function
4. Update data retention disclaimer
5. ~~Fix Apple related colors in browser, logo and branding things~~ ✅ Done - Added theme-color meta tags and Apple-specific meta tags
6. Make the AI with Sonnet 4.5 check for SECURITY CONSERNS
7. Make Backup to cloud, or whatever?
8. Make "Bulk create", right? Instead of it having to loop through everyone, right?
9. Allow no OAUTH/Maybe local user+password login, or similar?
10. ~~At "View" consider adding a collapse function for each Category... Right? I'm not sure... Possibly~~ ✅ Done - Added collapsible categories with chevron toggles
11. ~~Make it possible to share categories with other users, possible by sharing a secret long code, or similar, or a invite link, which can be shared. If it is better, it's also fine to have "collections" with multiple categories, which can be shared. But I think it's fine to only have "categories". If so, the user on the other end, should somehow "accept" the share, so it's not listed in the GUI, through that. here, I'm open for your best suggestion, but do not over-do it.~~ ✅ Done - Added category sharing with share codes, member management, and accept flow
12. Migrate the link and category metadata/options to a solution, maybe like the one used in user settings? (or?)
13. Config for "site url" and "subpath"/subdomain, for people running it behind a proxy
14. Consider moving the db migrations to another path, so it's not linked to the filesystem, like the `db`
15. Possible take a look at the `debug.php` site: What needs to be done? Is it secure?
16. Check for SQL injection things, we don't want
17. Make guide on how to deploy to PHP host, without using Docker (preparing -> deploy -> validate)
18. Add some logic so the user is redirected to front-page, if wrong uri used, or similar. If invalid link, make a toast about that, or? Something linke that?
19. SEO data, and SEO friendly public link meta data on page
20. Make a "report public link" function.

## Bugs

None defined right now

## Future Enhancements and Ideas

- Browser extension for quick saving
- Import from browser bookmarks
- Full-text search
- Link previews/thumbnails
- Archive.org integration
