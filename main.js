const { Plugin, Notice, normalizePath } = require("obsidian");

const SYNC_SAFE_CHUNK_BYTES = 4 * 1024 * 1024;

function splitArrayBuffer(buffer, maximumBytes = SYNC_SAFE_CHUNK_BYTES) {
  if (!(maximumBytes > 0)) throw new Error("Chunk size must be positive");
  const parts = [];
  for (let offset = 0; offset < buffer.byteLength; offset += maximumBytes) {
    parts.push(buffer.slice(offset, Math.min(offset + maximumBytes, buffer.byteLength)));
  }
  return parts;
}

async function sha256Hex(buffer) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const ROUTES = [
  { id: "travel-os", label: "Travel OS", pattern: /(travel|trip|coffee|cafe|café|旅遊|旅行|咖啡|遊記)/i },
  { id: "ai-family-book", label: "AI Family Book", pattern: /(ai family book|maya|manuscript|chapter|book|章節|書)/i },
  { id: "jdb-runtime", label: "JDB Runtime", pattern: /(jdb|runtime|obsidian|digital brain|數位大腦|收件箱)/i }
];

function routeCommand(text) {
  return ROUTES.find((route) => route.pattern.test(text)) || { id: "auto", label: "JDB 自動判斷" };
}

class JdbCommandPlugin extends Plugin {
  onload() {
    this.addCommand({
      id: "open-jdb-home",
      name: "Open JDB command center",
      callback: async () => {
        const file = this.app.vault.getAbstractFileByPath("inbox/JDB.md");
        if (file) await this.app.workspace.getLeaf(false).openFile(file);
      }
    });

    const registerCommandBlock = () => {
      this.registerMarkdownCodeBlockProcessor("jdb-command", (_source, element) => {
        try {
          this.renderForm(element);
        } catch (error) {
          console.error("JDB Command render failed", error);
          element.empty();
          element.createDiv({
            cls: "jdb-command-error",
            text: "JDB Command could not render this page. Reopen the note or restart Obsidian."
          });
        }
      });
    };

    if (this.app.workspace.layoutReady) registerCommandBlock();
    else this.app.workspace.onLayoutReady(registerCommandBlock);
  }

  renderForm(element) {
    const wrapper = element.createDiv({ cls: "jdb-command" });
    wrapper.createEl("h2", { text: "交代 JDB 工作" });
    wrapper.createDiv({ cls: "jdb-command-version", text: `JDB Command v${this.manifest.version}` });
    wrapper.createEl("p", { cls: "jdb-command-intro", text: "一句話交代工作，需要時加入照片、語音或檔案。JDB 會自動判斷 Project。" });

    const textarea = wrapper.createEl("textarea", { cls: "jdb-command-text" });
    textarea.placeholder = "例如：把這 17 張照片放入 Travel OS 的 Coffee，製作 3 篇遊記。";
    textarea.rows = 5;
    textarea.setAttribute("aria-label", "JDB 工作指令");
    const route = wrapper.createDiv({ cls: "jdb-command-route", text: "Project：JDB 自動判斷" });
    textarea.addEventListener("input", () => { route.textContent = `Project：${routeCommand(textarea.value).label}`; });

    const selectedFiles = [];
    const fileInput = wrapper.createEl("input", { cls: "jdb-command-files", type: "file" });
    fileInput.multiple = true;
    fileInput.accept = "image/*,audio/*,.pdf,.doc,.docx,.txt,.md";
    fileInput.setAttribute("aria-label", "選擇照片、語音或檔案");
    const addFiles = wrapper.createEl("button", { cls: "jdb-command-add-files", text: "加入照片／檔案" });
    addFiles.type = "button";
    const selection = wrapper.createDiv({ cls: "jdb-command-selection", text: "尚未加入檔案" });
    const preview = wrapper.createDiv({ cls: "jdb-command-preview" });
    const clearFiles = wrapper.createEl("button", { cls: "jdb-command-clear-files", text: "清除已選檔案" });
    clearFiles.type = "button";
    clearFiles.hidden = true;

    const renderSelection = () => {
      selection.empty();
      preview.empty();
      if (!selectedFiles.length) {
        selection.setText("尚未加入檔案");
        clearFiles.hidden = true;
        return;
      }
      selection.createEl("strong", { text: `已加入 ${selectedFiles.length} 個檔案` });
      for (const entry of selectedFiles) {
        const item = preview.createDiv({ cls: "jdb-command-preview-item" });
        if (entry.file.type.startsWith("image/")) {
          const image = item.createEl("img", { attr: { alt: entry.file.name } });
          image.src = URL.createObjectURL(entry.file);
          image.addEventListener("load", () => URL.revokeObjectURL(image.src), { once: true });
        } else {
          item.createDiv({ cls: "jdb-command-preview-file", text: "檔案" });
        }
        item.createEl("span", { text: entry.file.name, attr: { title: entry.file.name } });
        const remove = item.createEl("button", { cls: "jdb-command-remove-file", text: "移除" });
        remove.type = "button";
        remove.setAttribute("aria-label", `移除 ${entry.file.name}`);
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

    const submit = wrapper.createEl("button", { cls: "mod-cta jdb-command-submit", text: "送交 JDB" });
    const status = wrapper.createDiv({ cls: "jdb-command-status", attr: { role: "status", "aria-live": "polite" } });
    const receipt = wrapper.createDiv({ cls: "jdb-command-receipt" });
    receipt.hidden = true;

    const renderReceipt = (result) => {
      receipt.empty();
      receipt.hidden = false;
      receipt.createEl("h3", { text: "JDB 收件回執" });
      receipt.createDiv({ cls: "receipt-status", text: "處理狀態：已進入 JDB 收件箱" });
      receipt.createDiv({ cls: "receipt-id", text: `收件編號：${result.id}` });
      receipt.createDiv({ cls: "receipt-project", text: `Project：${result.projectLabel}` });
      receipt.createDiv({ cls: "receipt-file-count", text: `已收到 ${result.savedFiles.length} 個檔案` });
      if (result.savedFiles.length) {
        const savedPreview = receipt.createDiv({ cls: "jdb-command-preview jdb-command-receipt-preview" });
        for (const file of result.savedFiles) {
          const item = savedPreview.createDiv({ cls: "jdb-command-preview-item" });
          if (file.resourceUrl) item.createEl("img", { attr: { src: file.resourceUrl, alt: file.name } });
          else item.createDiv({ cls: "jdb-command-preview-file", text: "檔案" });
          item.createEl("span", { text: file.name });
        }
      }
      const openReceipt = receipt.createEl("button", { text: "開啟收件回執" });
      openReceipt.type = "button";
      openReceipt.addEventListener("click", async () => {
        const note = this.app.vault.getAbstractFileByPath(result.notePath);
        if (note) await this.app.workspace.getLeaf(false).openFile(note);
      });
    };
    submit.addEventListener("click", async () => {
      const command = textarea.value.trim();
      if (!command) { new Notice("請先輸入要交代 JDB 的工作。"); textarea.focus(); return; }
      submit.disabled = true;
      status.textContent = "正在送交…";
      try {
        const result = await this.submit(command, selectedFiles.map((entry) => entry.file));
        textarea.value = "";
        selectedFiles.splice(0, selectedFiles.length);
        renderSelection();
        route.textContent = "Project：JDB 自動判斷";
        status.textContent = `送交成功：${result.id}`;
        renderReceipt(result);
        new Notice(`JDB 已收到任務與 ${result.savedFiles.length} 個檔案。`);
      } catch (error) {
        console.error("JDB command submission failed", error);
        status.textContent = "送交失敗；指令與檔案仍保留，請檢查同步後再試一次。";
        new Notice("JDB 送交失敗。");
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
    const createdPaths = [];
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const safeName = file.name.replace(/[\\/:*?"<>|]/g, "-");
        const path = normalizePath(`${commandFolder}/${id}-${index + 1}-${safeName}`);
        const buffer = await file.arrayBuffer();
        let resourceUrl = "";
        if (buffer.byteLength <= SYNC_SAFE_CHUNK_BYTES) {
          const created = await this.app.vault.createBinary(path, buffer);
          createdPaths.push(path);
          const verified = this.app.vault.getAbstractFileByPath(path);
          if (!verified || verified.stat.size !== file.size) throw new Error(`Attachment verification failed: ${path}`);
          links.push(`- [[${path}]]`);
          resourceUrl = file.type.startsWith("image/") ? this.app.vault.getResourcePath(created) : "";
        } else {
          const parts = splitArrayBuffer(buffer);
          const manifestPath = normalizePath(`${path}.jdbparts.json`);
          const manifestParts = [];
          for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
            const partPath = normalizePath(`${path}.jdbpart-${String(partIndex + 1).padStart(3, "0")}-of-${String(parts.length).padStart(3, "0")}`);
            await this.app.vault.createBinary(partPath, parts[partIndex]);
            createdPaths.push(partPath);
            const verifiedPart = this.app.vault.getAbstractFileByPath(partPath);
            if (!verifiedPart || verifiedPart.stat.size !== parts[partIndex].byteLength) throw new Error(`Chunk verification failed: ${partPath}`);
            manifestParts.push({ path: partPath, size: parts[partIndex].byteLength });
          }
          const manifest = JSON.stringify({ version: 1, originalPath: path, name: file.name, type: file.type, size: file.size, sha256: await sha256Hex(buffer), parts: manifestParts }, null, 2);
          await this.app.vault.create(manifestPath, manifest);
          createdPaths.push(manifestPath);
          if (!this.app.vault.getAbstractFileByPath(manifestPath)) throw new Error(`Manifest verification failed: ${manifestPath}`);
          links.push(`- [[${manifestPath}]]`);
          resourceUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
        }
        savedFiles.push({
          path,
          name: file.name,
          size: file.size,
          type: file.type,
          resourceUrl
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
      for (const path of createdPaths) {
        const partial = this.app.vault.getAbstractFileByPath(path);
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
module.exports.__test = { splitArrayBuffer, SYNC_SAFE_CHUNK_BYTES };
