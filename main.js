const { Plugin, Notice, normalizePath } = require("obsidian");

const ROUTES = [
  { id: "travel-os", label: "Travel OS", pattern: /(travel|trip|coffee|cafe|caf矇|??|??|?|??)/i },
  { id: "ai-family-book", label: "AI Family Book", pattern: /(ai family book|maya|manuscript|chapter|book|蝡?|??/i },
  { id: "jdb-runtime", label: "JDB Runtime", pattern: /(jdb|runtime|obsidian|digital brain|?訾?憭扯|?嗡辣蝞?/i }
];

function routeCommand(text) {
  return ROUTES.find((route) => route.pattern.test(text)) || { id: "auto", label: "JDB ?芸??斗" };
}

class JdbCommandPlugin extends Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor("jdb-command", (_source, element) => this.renderForm(element));
    this.addCommand({
      id: "open-jdb-home",
      name: "Open JDB command center",
      callback: async () => {
        const file = this.app.vault.getAbstractFileByPath("inbox/JDB.md");
        if (file) await this.app.workspace.getLeaf(false).openFile(file);
      }
    });
  }

  renderForm(element) {
    const wrapper = element.createDiv({ cls: "jdb-command" });
    wrapper.createEl("h2", { text: "鈭支誨 JDB 撌乩?" });
    wrapper.createDiv({ cls: "jdb-command-version", text: `JDB Command v${this.manifest.version}` });
    wrapper.createEl("p", { cls: "jdb-command-intro", text: "銝?亥店鈭支誨撌乩?嚗?閬???抒????單?瑼??DB ????Project?? });

    const textarea = wrapper.createEl("textarea", { cls: "jdb-command-text" });
    textarea.placeholder = "靘?嚗???17 撘萇???Travel OS ??Coffee嚗ˊ雿?3 蝭?閮?;
    textarea.rows = 5;
    textarea.setAttribute("aria-label", "JDB 撌乩??誘");
    const route = wrapper.createDiv({ cls: "jdb-command-route", text: "Project嚗DB ?芸??斗" });
    textarea.addEventListener("input", () => { route.textContent = `Project嚗?{routeCommand(textarea.value).label}`; });

    const selectedFiles = [];
    const fileInput = wrapper.createEl("input", { cls: "jdb-command-files", type: "file" });
    fileInput.multiple = true;
    fileInput.accept = "image/*,audio/*,.pdf,.doc,.docx,.txt,.md";
    fileInput.setAttribute("aria-label", "?豢??抒????單?瑼?");
    const addFiles = wrapper.createEl("button", { cls: "jdb-command-add-files", text: "??抒?嚗?獢? });
    addFiles.type = "button";
    const selection = wrapper.createDiv({ cls: "jdb-command-selection", text: "撠?瑼?" });
    const preview = wrapper.createDiv({ cls: "jdb-command-preview" });
    const clearFiles = wrapper.createEl("button", { cls: "jdb-command-clear-files", text: "皜撌脤瑼?" });
    clearFiles.type = "button";
    clearFiles.hidden = true;

    const renderSelection = () => {
      selection.empty();
      preview.empty();
      if (!selectedFiles.length) {
        selection.setText("撠?瑼?");
        clearFiles.hidden = true;
        return;
      }
      selection.createEl("strong", { text: `撌脣???${selectedFiles.length} ??獢 });
      for (const entry of selectedFiles) {
        const item = preview.createDiv({ cls: "jdb-command-preview-item" });
        if (entry.file.type.startsWith("image/")) {
          const image = item.createEl("img", { attr: { alt: entry.file.name } });
          image.src = URL.createObjectURL(entry.file);
          image.addEventListener("load", () => URL.revokeObjectURL(image.src), { once: true });
        } else {
          item.createDiv({ cls: "jdb-command-preview-file", text: "瑼?" });
        }
        item.createEl("span", { text: entry.file.name, attr: { title: entry.file.name } });
        const remove = item.createEl("button", { cls: "jdb-command-remove-file", text: "蝘駁" });
        remove.type = "button";
        remove.setAttribute("aria-label", `蝘駁 ${entry.file.name}`);
        remove.addEventListener("click", () => {
          const index = selectedFiles.findIndex((selected) => selected.key === entry.key);
          if (index >= 0) selectedFiles.splice(index, 1);
          renderSelection();
        });
      }
      clearFiles.hidden = false;
    };

    addFiles.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      for (const file of Array.from(fileInput.files || [])) {
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        if (!selectedFiles.some((entry) => entry.key === key)) selectedFiles.push({ key, file });
      }
      fileInput.value = "";
      renderSelection();
    });
    clearFiles.addEventListener("click", () => {
      selectedFiles.splice(0, selectedFiles.length);
      renderSelection();
    });

    const submit = wrapper.createEl("button", { cls: "mod-cta jdb-command-submit", text: "?漱 JDB" });
    const status = wrapper.createDiv({ cls: "jdb-command-status", attr: { role: "status", "aria-live": "polite" } });
    const receipt = wrapper.createDiv({ cls: "jdb-command-receipt" });
    receipt.hidden = true;

    const renderReceipt = (result) => {
      receipt.empty();
      receipt.hidden = false;
      receipt.createEl("h3", { text: "JDB ?嗡辣?" });
      receipt.createDiv({ cls: "receipt-status", text: "?????撌脤脣 JDB ?嗡辣蝞? });
      receipt.createDiv({ cls: "receipt-id", text: `?嗡辣蝺刻?嚗?{result.id}` });
      receipt.createDiv({ cls: "receipt-project", text: `Project嚗?{result.projectLabel}` });
      receipt.createDiv({ cls: "receipt-file-count", text: `撌脫??${result.savedFiles.length} ??獢 });
      if (result.savedFiles.length) {
        const savedPreview = receipt.createDiv({ cls: "jdb-command-preview jdb-command-receipt-preview" });
        for (const file of result.savedFiles) {
          const item = savedPreview.createDiv({ cls: "jdb-command-preview-item" });
          if (file.resourceUrl) item.createEl("img", { attr: { src: file.resourceUrl, alt: file.name } });
          else item.createDiv({ cls: "jdb-command-preview-file", text: "瑼?" });
          item.createEl("span", { text: file.name });
        }
      }
      const openReceipt = receipt.createEl("button", { text: "???嗡辣?" });
      openReceipt.type = "button";
      openReceipt.addEventListener("click", async () => {
        const note = this.app.vault.getAbstractFileByPath(result.notePath);
        if (note) await this.app.workspace.getLeaf(false).openFile(note);
      });
    };
    submit.addEventListener("click", async () => {
      const command = textarea.value.trim();
      if (!command) { new Notice("隢?頛詨閬漱隞?JDB ?極雿?); textarea.focus(); return; }
      submit.disabled = true;
      status.textContent = "甇??漱??;
      try {
        const result = await this.submit(command, selectedFiles.map((entry) => entry.file));
        textarea.value = "";
        selectedFiles.splice(0, selectedFiles.length);
        renderSelection();
        route.textContent = "Project嚗DB ?芸??斗";
        status.textContent = `?漱??嚗?{result.id}`;
        renderReceipt(result);
        new Notice(`JDB 撌脫?唬遙?? ${result.savedFiles.length} ??獢);
      } catch (error) {
        console.error("JDB command submission failed", error);
        status.textContent = "?漱憭望?嚗?隞方?瑼?隞???隢炎?亙?甇亙??岫銝甈～?;
        new Notice("JDB ?漱憭望???);
      } finally {
        submit.disabled = false;
      }
    });
  }

  async submit(command, files) {
    const now = new Date();
    const stamp = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 17);
    const random = Math.random().toString(16).slice(2, 10);
    const id = `${stamp}-${random}`;
    const routed = routeCommand(command);
    const commandFolder = normalizePath("inbox/commands");
    await this.ensureFolder("inbox/commands");
    const links = [];
    const savedFiles = [];
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const safeName = file.name.replace(/[\\/:*?"<>|]/g, "-");
        const path = normalizePath(`${commandFolder}/${id}-${index + 1}-${safeName}`);
        const created = await this.app.vault.createBinary(path, await file.arrayBuffer());
        const verified = this.app.vault.getAbstractFileByPath(path);
        if (!verified || verified.stat.size !== file.size) throw new Error(`Attachment verification failed: ${path}`);
        links.push(`- [[${path}]]`);
        savedFiles.push({
          path,
          name: file.name,
          size: file.size,
          type: file.type,
          resourceUrl: file.type.startsWith("image/") ? this.app.vault.getResourcePath(created) : ""
        });
      }
      const note = [
        "---", `id: ${id}`, "type: mission", "status: queued", `project: ${routed.id}`,
        `created: ${now.toISOString()}`, "source: jdb-command", `attachment_count: ${links.length}`, "---", "",
        "# JDB Command", "", command, "", "## Attachments", "", ...(links.length ? links : ["- None"]), ""
      ].join("\n");
      const notePath = normalizePath(`${commandFolder}/${id}.md`);
      await this.app.vault.create(notePath, note);
      if (!this.app.vault.getAbstractFileByPath(notePath)) throw new Error(`Receipt verification failed: ${notePath}`);
      return { id, project: routed.id, projectLabel: routed.label, notePath, savedFiles };
    } catch (error) {
      for (const saved of savedFiles) {
        const partial = this.app.vault.getAbstractFileByPath(saved.path);
        if (partial) await this.app.vault.delete(partial, true);
      }
      throw error;
    }
  }

  async ensureFolder(path) {
    const normalized = normalizePath(path);
    if (!this.app.vault.getAbstractFileByPath(normalized)) await this.app.vault.createFolder(normalized);
  }
}

module.exports = JdbCommandPlugin;
