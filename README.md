# JDB Command

JDB Command is the mobile-first command center for **Jason's Digital Brain** inside Obsidian.

It turns a `jdb-command` code block into one focused product screen:

- type, dictate, paste a public link, or record one instruction in the same command input;
- import an instruction source such as a video, Word document, PDF, presentation, spreadsheet, text file, or existing audio recording; JDB stores it separately for content extraction;
- see an immediate red recording indicator, elapsed timer, and prominent stop control, then play the voice instruction back before submission;
- add photos and reference files below as work attachments rather than instructions;
- accumulate multiple iPhone selections;
- preview every selected image and remove individual files;
- submit once and receive a persistent receipt;
- store the command and attachments together in `inbox/commands/` for JDB Runtime.

## Installation

### Beta installation while directory review is pending

Until JDB Command appears in Obsidian's official Community Plugins search:

1. Install and enable **BRAT** from **Settings -> Community plugins -> Browse**.
2. Open this link on the device: `obsidian://brat?plugin=c8vzn4ym5g-ai/jdb-command`.
3. Confirm the repository, then enable **JDB Command** under Community plugins.

The BRAT channel installs the same signed-off GitHub release assets documented below. It is a temporary installation path, not evidence that official directory review has completed.

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
3. Use the command input to type, dictate, paste a link, select **開始錄音**, or choose **匯入指令檔案**. While recording, confirm the red indicator and elapsed timer, then select **停止錄音** and play back the preview. Add photos or other supporting materials below with **加入照片／檔案**; these are stored separately as work attachments.
4. Review the complete preview list and select **Submit JDB** once.
5. Confirm that the persistent receipt appears. The command and attachments are stored together under `inbox/commands/` for JDB Runtime.

If direct recording is unavailable, JDB Command keeps two fallbacks on the same screen: use the iPhone keyboard microphone to dictate the instruction, or use **加入照片／檔案** to attach an existing recording. A microphone denial never discards the typed command or files already selected.

The plugin never sends vault content to a third-party service. It writes through Obsidian's Vault interface and is compatible with desktop and mobile (`isDesktopOnly: false`).

## Release assets

Each GitHub release must attach `main.js`, `manifest.json`, and `styles.css`, and its tag must exactly match the version in `manifest.json`.
