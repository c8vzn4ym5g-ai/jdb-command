# JDB Command

JDB Command is the mobile-first command center for **Jason's Digital Brain** inside Obsidian.

It turns a `jdb-command` code block into one focused product screen:

- dictate or type one instruction;
- add photos, audio, PDFs, documents, text, or Markdown files;
- accumulate multiple iPhone selections;
- preview every selected image and remove individual files;
- submit once and receive a persistent receipt;
- store the command and attachments together in `inbox/commands/` for JDB Runtime.

## Installation

### Community Plugins directory

After the plugin is approved, open **Settings -> Community plugins -> Browse**, search for **JDB Command**, select **Install**, and then select **Enable**.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the matching GitHub release.
2. Create `<vault>/.obsidian/plugins/jdb-command/`.
3. Copy the three files into that folder.
4. Restart Obsidian, open **Settings -> Community plugins**, and enable **JDB Command**.

## Usage

1. Add this code block to the JDB home note:

````markdown
```jdb-command
```
````

2. Open the note in Reading view.
3. Type or dictate an instruction, add any photos or files, review the preview list, and select **Submit JDB** once.
4. Confirm that the persistent receipt appears. The command and attachments are stored together under `inbox/commands/` for JDB Runtime.

The plugin never sends vault content to a third-party service. It writes through Obsidian's Vault interface and is compatible with desktop and mobile (`isDesktopOnly: false`).

## Release assets

Each GitHub release must attach `main.js`, `manifest.json`, and `styles.css`, and its tag must exactly match the version in `manifest.json`.
