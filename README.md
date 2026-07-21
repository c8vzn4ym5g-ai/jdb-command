# JDB Command

JDB Command is the mobile-first command center for **Jason's Digital Brain** inside Obsidian.

It turns a `jdb-command` code block into one focused product screen:

- dictate or type one instruction;
- add photos, audio, PDFs, documents, text, or Markdown files;
- accumulate multiple iPhone selections;
- preview every selected image and remove individual files;
- submit once and receive a persistent receipt;
- store the command and attachments together in `inbox/commands/` for JDB Runtime.

## Use

Add this code block to the JDB home note:

````markdown
```jdb-command
```
````

The plugin never sends vault content to a third-party service. It writes through Obsidian's Vault interface and is compatible with desktop and mobile (`isDesktopOnly: false`).

## Release assets

Each GitHub release must attach `main.js`, `manifest.json`, and `styles.css`, and its tag must exactly match the version in `manifest.json`.
