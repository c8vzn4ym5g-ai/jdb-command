const { Plugin, Notice, normalizePath, requestUrl } = require("obsidian");

// Base64 expands bytes by roughly one third. Three MiB source chunks remain
// four MiB Markdown files, safely below Sync Standard's five MiB file limit.
const SYNC_SAFE_CHUNK_BYTES = 3 * 1024 * 1024;
const DEFAULT_SETTINGS = Object.freeze({ wakeEndpoint: "" });
const COMMAND_ID_PATTERN = /^\d{17}-[a-f0-9]{8}$/;

function validateCommandId(id) {
  if (!COMMAND_ID_PATTERN.test(id)) throw new Error(`Invalid JDB command id: ${id}`);
  return id;
}

function buildWakeRequest(endpoint, id) {
  if (!endpoint) return null;
  const url = new URL(endpoint);
  if (url.protocol !== "https:") throw new Error("JDB wake endpoint must use HTTPS");
  return {
    url: url.toString(),
    method: "POST",
    contentType: "text/plain; charset=utf-8",
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      Firebase: "no"
    },
    body: validateCommandId(id),
    throw: false
  };
}

function splitArrayBuffer(buffer, maximumBytes = SYNC_SAFE_CHUNK_BYTES) {
  if (!(maximumBytes > 0)) throw new Error("Chunk size must be positive");
  const parts = [];
  for (let offset = 0; offset < buffer.byteLength; offset += maximumBytes) {
    parts.push(buffer.slice(offset, Math.min(offset + maximumBytes, buffer.byteLength)));
  }
  return parts;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const blockSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += blockSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + blockSize, bytes.length)));
  }
  return globalThis.btoa(binary);
}

function formatRecordingTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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

    const commandInput = wrapper.createDiv({ cls: "jdb-command-input" });
    const textarea = commandInput.createEl("textarea", { cls: "jdb-command-text" });
    textarea.placeholder = "例如：把這 17 張照片放入 Travel OS 的 Coffee，製作 3 篇遊記。";
    textarea.rows = 5;
    textarea.setAttribute("aria-label", "JDB 工作指令");
    const route = wrapper.createDiv({ cls: "jdb-command-route", text: "Project：JDB 自動判斷" });
    textarea.addEventListener("input", () => { route.textContent = `Project：${routeCommand(textarea.value).label}`; });

    const selectedInstructionFiles = [];
    const selectedFiles = [];
    const fileInput = wrapper.createEl("input", { cls: "jdb-command-files", type: "file" });
    fileInput.multiple = true;
    fileInput.accept = "image/*,audio/*,.pdf,.doc,.docx,.txt,.md";
    fileInput.setAttribute("aria-label", "選擇照片、語音或檔案");
    const addFiles = wrapper.createEl("button", { cls: "jdb-command-add-files", text: "加入照片／檔案" });
    addFiles.type = "button";
    const voiceActions = commandInput.createDiv({ cls: "jdb-command-voice-actions" });
    const recordVoice = voiceActions.createEl("button", { cls: "jdb-command-record-voice", text: "開始錄音" });
    recordVoice.type = "button";
    const stopVoice = voiceActions.createEl("button", { cls: "jdb-command-stop-voice", text: "停止錄音" });
    stopVoice.type = "button";
    stopVoice.hidden = true;
    const recordingStatus = commandInput.createDiv({ cls: "jdb-command-recording-status", text: "可輸入文字，或按麥克風錄製語音指令", attr: { role: "status", "aria-live": "polite" } });
    const instructionFileInput = commandInput.createEl("input", { cls: "jdb-command-instruction-files", type: "file" });
    instructionFileInput.multiple = true;
    instructionFileInput.accept = "audio/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md";
    instructionFileInput.setAttribute("aria-label", "選擇包含指令的檔案");
    const addInstructionFiles = commandInput.createEl("button", { cls: "jdb-command-add-instruction-files", text: "匯入指令檔案" });
    addInstructionFiles.type = "button";
    const instructionSelection = commandInput.createDiv({ cls: "jdb-command-instruction-selection", text: "尚未匯入指令檔案" });
    const instructionPreview = commandInput.createDiv({ cls: "jdb-command-preview jdb-command-instruction-preview" });
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
        } else if (entry.file.type.startsWith("audio/")) {
          const audio = item.createEl("audio", { attr: { controls: "", preload: "metadata" } });
          audio.src = URL.createObjectURL(entry.file);
          audio.addEventListener("loadedmetadata", () => URL.revokeObjectURL(audio.src), { once: true });
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

    let recorder = null;
    let recordingStream = null;
    let recordingChunks = [];
    let recordingTimer = null;
    let elapsedSeconds = 0;
    const clearRecordingTimer = () => {
      if (recordingTimer) clearInterval(recordingTimer);
      recordingTimer = null;
    };

    const renderInstructionSelection = () => {
      instructionSelection.empty();
      instructionPreview.empty();
      if (!selectedInstructionFiles.length) {
        instructionSelection.setText("尚未匯入指令檔案");
        return;
      }
      instructionSelection.createEl("strong", { text: `已匯入 ${selectedInstructionFiles.length} 個指令來源` });
      for (const entry of selectedInstructionFiles) {
        const item = instructionPreview.createDiv({ cls: "jdb-command-preview-item" });
        if (entry.file.type.startsWith("audio/")) {
          const audio = item.createEl("audio", { attr: { controls: "", preload: "metadata" } });
          audio.src = URL.createObjectURL(entry.file);
          audio.addEventListener("loadedmetadata", () => URL.revokeObjectURL(audio.src), { once: true });
        } else {
          item.createDiv({ cls: "jdb-command-preview-file", text: "指令檔案" });
        }
        item.createEl("span", { text: entry.file.name, attr: { title: entry.file.name } });
        const remove = item.createEl("button", { cls: "jdb-command-remove-file", text: "移除" });
        remove.type = "button";
        remove.addEventListener("click", () => {
          const index = selectedInstructionFiles.findIndex((selected) => selected.key === entry.key);
          if (index >= 0) selectedInstructionFiles.splice(index, 1);
          renderInstructionSelection();
        });
      }
    };

    addInstructionFiles.addEventListener("click", () => instructionFileInput.click());
    instructionFileInput.addEventListener("change", () => {
      for (const file of Array.from(instructionFileInput.files || [])) {
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        if (!selectedInstructionFiles.some((entry) => entry.key === key)) selectedInstructionFiles.push({ key, file });
      }
      instructionFileInput.value = "";
      renderInstructionSelection();
    });
    const showRecordingProgress = () => {
      recordingStatus.textContent = `正在錄音 ${formatRecordingTime(elapsedSeconds)} · 完成後按「停止錄音」`;
    };
    const releaseMicrophone = () => {
      if (recordingStream) recordingStream.getTracks().forEach((track) => track.stop());
      recordingStream = null;
    };
    recordVoice.addEventListener("click", async () => {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        recordingStatus.textContent = "此裝置不支援頁面錄音；可使用鍵盤麥克風口述指令，或加入既有錄音檔。";
        new Notice("目前裝置不支援直接錄音。仍可使用鍵盤口述或加入錄音檔。");
        return;
      }
      try {
        recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recordingChunks = [];
        recorder = new MediaRecorder(recordingStream);
        recorder.addEventListener("dataavailable", (event) => {
          if (event.data?.size) recordingChunks.push(event.data);
        });
        recorder.addEventListener("stop", () => {
          clearRecordingTimer();
          recordingStatus.classList.remove("is-recording");
          const type = recorder.mimeType || recordingChunks[0]?.type || "audio/webm";
          const extension = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
          const blob = new Blob(recordingChunks, { type });
          if (blob.size) {
            const stamp = new Date().toISOString().replace(/[:.]/g, "-");
            const file = new File([blob], `JDB-voice-${stamp}.${extension}`, { type, lastModified: Date.now() });
            const key = `${file.name}:${file.size}:${file.lastModified}`;
            selectedInstructionFiles.push({ key, file });
            renderInstructionSelection();
            recordingStatus.textContent = `語音指令已加入：${file.name}（送交前可播放或移除）`;
          } else {
            recordingStatus.textContent = "沒有收到錄音內容，請再試一次。";
          }
          recordingChunks = [];
          recorder = null;
          releaseMicrophone();
          recordVoice.hidden = false;
          stopVoice.hidden = true;
        });
        recorder.addEventListener("error", () => {
          clearRecordingTimer();
          recordingStatus.classList.remove("is-recording");
          recordingStatus.textContent = "錄音失敗，麥克風已停止。";
          releaseMicrophone();
          recordVoice.hidden = false;
          stopVoice.hidden = true;
        });
        recorder.start();
        elapsedSeconds = 0;
        recordingStatus.classList.add("is-recording");
        showRecordingProgress();
        recordingTimer = setInterval(() => {
          elapsedSeconds += 1;
          showRecordingProgress();
        }, 1000);
        recordVoice.hidden = true;
        stopVoice.hidden = false;
      } catch (error) {
        clearRecordingTimer();
        recordingStatus.classList.remove("is-recording");
        console.error("JDB voice recording failed", error);
        releaseMicrophone();
        recordingStatus.textContent = "無法使用麥克風。請允許 Obsidian 使用麥克風，或加入既有錄音檔。";
        new Notice("無法使用麥克風。請檢查 iPhone 的麥克風權限。");
      }
    });
    stopVoice.addEventListener("click", () => {
      if (recorder?.state === "recording") {
        recordingStatus.textContent = "正在整理錄音預覽…";
        recorder.stop();
      }
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
      const wakeText = result.wake.ok
        ? "處理狀態：已儲存並喚醒 JDB"
        : "處理狀態：已安全儲存；喚醒待重試";
      receipt.createDiv({ cls: "receipt-status", text: wakeText });
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
      if (!command && !selectedInstructionFiles.length) { new Notice("請輸入文字、錄製語音，或匯入一個指令檔案。"); textarea.focus(); return; }
      submit.disabled = true;
      status.textContent = "正在送交…";
      try {
        const result = await this.submit(command, selectedInstructionFiles.map((entry) => entry.file), selectedFiles.map((entry) => entry.file));
        textarea.value = "";
        selectedInstructionFiles.splice(0, selectedInstructionFiles.length);
        renderInstructionSelection();
        selectedFiles.splice(0, selectedFiles.length);
        renderSelection();
        recordingStatus.textContent = "可輸入文字，或按麥克風錄製語音指令";
        route.textContent = "Project：JDB 自動判斷";
         status.textContent = result.wake.ok
           ? `送交成功並已喚醒：${result.id}`
           : `已安全儲存，喚醒待重試：${result.id}`;
         renderReceipt(result);
         new Notice(result.wake.ok
           ? `JDB 已收到任務與 ${result.savedFiles.length} 個檔案，後端已喚醒。`
           : "任務已安全儲存；喚醒服務暫時未確認，JDB 會在下次連線時重試。");
      } catch (error) {
        console.error("JDB command submission failed", error);
        status.textContent = "送交失敗；指令與檔案仍保留，請檢查同步後再試一次。";
        new Notice("JDB 送交失敗。");
      } finally {
        submit.disabled = false;
      }
    });
  }

  async submit(command, instructionFiles, files) {
    const now = new Date();
    const stamp = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 17);
    const random = Math.random().toString(16).slice(2, 10);
    const id = `${stamp}-${random}`;
    const routed = routeCommand(command);
    const commandFolder = normalizePath("inbox/commands");
    await this.ensureFolder("inbox/commands");
    const instructionLinks = [];
    const attachmentLinks = [];
    const savedFiles = [];
    const createdPaths = [];
    try {
      const sources = [
        ...instructionFiles.map((file) => ({ file, role: "instruction" })),
        ...files.map((file) => ({ file, role: "attachment" }))
      ];
      for (let index = 0; index < sources.length; index += 1) {
        const { file, role } = sources[index];
        const safeName = file.name.replace(/[\\/:*?"<>|]/g, "-");
        const path = normalizePath(`${commandFolder}/${id}-${index + 1}-${safeName}`);
        const buffer = await file.arrayBuffer();
        let resourceUrl = "";
        if (buffer.byteLength <= SYNC_SAFE_CHUNK_BYTES) {
          const created = await this.app.vault.createBinary(path, buffer);
          createdPaths.push(path);
          const verified = this.app.vault.getAbstractFileByPath(path);
          if (!verified || verified.stat.size !== file.size) throw new Error(`Attachment verification failed: ${path}`);
          (role === "instruction" ? instructionLinks : attachmentLinks).push(`- [[${path}]]`);
          resourceUrl = file.type.startsWith("image/") ? this.app.vault.getResourcePath(created) : "";
        } else {
          const parts = splitArrayBuffer(buffer);
          const manifestPath = normalizePath(`${path}.jdbparts.md`);
          const manifestParts = [];
          for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
            const partPath = normalizePath(`${path}.jdbpart-${String(partIndex + 1).padStart(3, "0")}-of-${String(parts.length).padStart(3, "0")}.md`);
            const encodedPart = arrayBufferToBase64(parts[partIndex]);
            await this.app.vault.create(partPath, encodedPart);
            createdPaths.push(partPath);
            const verifiedPart = this.app.vault.getAbstractFileByPath(partPath);
            if (!verifiedPart || verifiedPart.stat.size !== encodedPart.length) throw new Error(`Chunk verification failed: ${partPath}`);
            manifestParts.push({ path: partPath, size: parts[partIndex].byteLength, encoding: "base64" });
          }
          const manifest = JSON.stringify({ version: 1, originalPath: path, name: file.name, type: file.type, size: file.size, sha256: await sha256Hex(buffer), parts: manifestParts }, null, 2);
          await this.app.vault.create(manifestPath, manifest);
          createdPaths.push(manifestPath);
          if (!this.app.vault.getAbstractFileByPath(manifestPath)) throw new Error(`Manifest verification failed: ${manifestPath}`);
          (role === "instruction" ? instructionLinks : attachmentLinks).push(`- [[${manifestPath}]]`);
          resourceUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
        }
        savedFiles.push({
          path,
          name: file.name,
          size: file.size,
          type: file.type,
          resourceUrl,
          role
        });
      }
      const note = [
        "---", `id: ${id}`, "type: mission", "status: queued", `project: ${routed.id}`,
        `created: ${now.toISOString()}`, "source: jdb-command", `instruction_source_count: ${instructionLinks.length}`, `attachment_count: ${attachmentLinks.length}`, "---", "",
        "# JDB Command", "", command || "（指令內容由匯入檔案提供）", "", "## Instruction Sources", "", ...(instructionLinks.length ? instructionLinks : ["- None"]), "", "## Attachments", "", ...(attachmentLinks.length ? attachmentLinks : ["- None"]), ""
      ].join("\n");
      const notePath = normalizePath(`${commandFolder}/${id}.md`);
      await this.app.vault.create(notePath, note);
      if (!this.app.vault.getAbstractFileByPath(notePath)) throw new Error(`Receipt verification failed: ${notePath}`);
      const wake = await this.notifyWake(id);
      return { id, project: routed.id, projectLabel: routed.label, notePath, savedFiles, wake };
    } catch (error) {
      for (const path of createdPaths) {
        const partial = this.app.vault.getAbstractFileByPath(path);
        if (partial) await this.app.vault.delete(partial, true);
      }
      throw error;
    }
  }

  async notifyWake(id) {
    const request = buildWakeRequest(this.settings?.wakeEndpoint, id);
    if (!request) return { ok: false, reason: "not-configured" };
    try {
      const response = await requestUrl(request);
      if (response.status < 200 || response.status >= 300) {
        return { ok: false, reason: `http-${response.status}` };
      }
      return { ok: true };
    } catch (error) {
      console.error("JDB wake notification failed", error);
      return { ok: false, reason: "network-error" };
    }
  }

  async ensureFolder(path) {
    const normalized = normalizePath(path);
    if (!this.app.vault.getAbstractFileByPath(normalized)) await this.app.vault.createFolder(normalized);
  }
}

module.exports = JdbCommandPlugin;
module.exports.__test = {
  splitArrayBuffer,
  arrayBufferToBase64,
  formatRecordingTime,
  validateCommandId,
  buildWakeRequest,
  SYNC_SAFE_CHUNK_BYTES
};
