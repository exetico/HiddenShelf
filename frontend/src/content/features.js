// What Hidden Shelf does, in users' words. The front page shows the
// features marked `front`; the Help page (/help) shows them all, plus the
// FAQ. Keep this in step with the app: see CLAUDE.md.

export const FEATURE_GROUPS = [
  {
    title: "Save and organize",
    features: [
      {
        icon: "mdi-folder-multiple-outline",
        title: "Categories and tags",
        text: "Group links into categories with their own icon and color, and tag them across categories.",
        front: true,
      },
      {
        icon: "mdi-plus-circle-outline",
        title: "Add from anywhere",
        text: "Add a link from any page in the app (or press N), or with the bookmarklet from any website. Addresses without http:// work too.",
      },
      {
        icon: "mdi-eye-off-outline",
        title: "Hidden categories",
        text: "Hide a category so its links only show when you ask for them, for example a friend's copy of the same services.",
      },
      {
        icon: "mdi-drag",
        title: "Your own order",
        text: "Drag links into the order you want, put your categories in order, and mark favorites.",
      },
      {
        icon: "mdi-delete-restore",
        title: "Trash with undo",
        text: "Deleted links go to the trash first, so you can restore them.",
      },
    ],
  },
  {
    title: "Find",
    features: [
      {
        icon: "mdi-magnify",
        title: "Find anything fast",
        text: "Search titles, URLs, descriptions and tags, with results as you type. Press / to jump to the search box.",
        front: true,
      },
      {
        icon: "mdi-sort",
        title: "Sort your way",
        text: "Sort by your own order, newest or oldest, title, or most visited.",
      },
      {
        icon: "mdi-link-box-variant-outline",
        title: "Links to your filters",
        text: "Filters and sorting live in the address, so you can bookmark a tag or category view, or open it in a new tab.",
      },
    ],
  },
  {
    title: "Share",
    features: [
      {
        icon: "mdi-account-group-outline",
        title: "Share collections",
        text: "Share a category with a code or link. Others see it read-only and you can revoke access any time.",
        front: true,
      },
      {
        icon: "mdi-link-variant",
        title: "Public short links",
        text: "Make a link public to get a short URL and a QR code, with optional direct redirect and visit counts.",
        front: true,
      },
      {
        icon: "mdi-code-tags",
        title: "Embed on a website",
        text: "Show a public link as a small card on another website, with one line of iframe code.",
      },
    ],
  },
  {
    title: "Tools",
    features: [
      {
        icon: "mdi-toolbox-outline",
        title: "Link tools",
        text: "Make QR codes, encode and decode URLs, strip tracking parameters and inspect a link. All in your browser.",
        front: true,
      },
      {
        icon: "mdi-swap-horizontal",
        title: "Import and export",
        text: "Export everything as JSON, and import it again on this or another Hidden Shelf.",
      },
    ],
  },
  {
    title: "Your shelf, your way",
    features: [
      {
        icon: "mdi-cellphone",
        title: "Built for your phone",
        text: "A compact layout for mobile, plus light and dark themes in your own brand color. Add it to your home screen like an app.",
        front: true,
      },
      {
        icon: "mdi-lock-outline",
        title: "Private by default",
        text: "Links are only visible to you until you choose to share or publish them. No password to create or remember.",
        front: true,
      },
      {
        icon: "mdi-server-outline",
        title: "Self-hosted",
        text: "Runs on your own server with one Docker container and a SQLite file.",
      },
    ],
  },
];

export const FRONT_FEATURES = FEATURE_GROUPS.flatMap((g) => g.features).filter((f) => f.front);

export const FAQ = [
  {
    q: "How do I sign in?",
    a: "Enter your email and we send you a sign-in link; there's no password. If the server has it set up, you can also sign in with Google.",
  },
  {
    q: "Who can see my links?",
    a: "Only you. A link becomes visible to others only when you make it public, or share the category it's in.",
  },
  {
    q: "What's the difference between a category and a tag?",
    a: "A link is in one category, like a folder. It can have many tags, which cut across categories. Tap a tag to see every link that has it.",
  },
  {
    q: "What does a hidden category do?",
    a: "Its links stay out of lists and search until you choose to show them. Handy for duplicates, like the same services on a friend's server.",
  },
  {
    q: "How do I share a whole category?",
    a: "Open Manage categories on the Edit page and share the category. You get a code and a link; people who open it can see the category read-only until you revoke it.",
  },
  {
    q: "What is a public link?",
    a: "A short address (/h/…) for one link that anyone can open. You can show it as a QR code, embed it as a card on a website, or make it redirect straight to the target. Visits are counted.",
  },
  {
    q: "Can I save a link while I'm on another site?",
    a: "Yes. Drag the bookmarklet from your profile to your browser's bookmarks bar. Clicking it on any page opens the add form with that page filled in.",
  },
  {
    q: "Are my links stored in the browser?",
    a: "No. The app loads your shelf when you open it and keeps it only while the tab is open, so a shared computer doesn't keep a copy. Search and filters then work on that, so they don't wait for the server.",
  },
  {
    q: "Do the tools send what I type anywhere?",
    a: "No. QR codes, encoding, cleaning and inspecting links all happen in your browser. Nothing leaves it unless you save the link to your shelf.",
  },
  {
    q: "Are there keyboard shortcuts?",
    a: "Press / to search and N to add a link. Esc closes dialogs; if a link form has unsaved changes, it asks first.",
  },
  {
    q: "I run my own Hidden Shelf. Can I update it from the app?",
    a: "Yes. List the admins in UPDATE_ADMIN_EMAILS (see the README) and they get Server updates on their profile, with the new changes listed and Update and Roll back buttons. The database is backed up before every update, and a version that doesn't start is undone by itself.",
  },
  {
    q: "Can I get my data out?",
    a: "Yes. Profile → Import / export downloads all your links, categories and tags as JSON. You can also delete everything from your profile.",
  },
];
