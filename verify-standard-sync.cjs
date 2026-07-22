const assert = require("node:assert/strict");
const Module = require("node:module");

class Plugin {}
const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === "obsidian") {
    return { Plugin, Notice: class Notice {}, normalizePath: (path) => path };
  }
  return originalLoad(request, parent, isMain);
};

try {
  const JdbCommandPlugin = require("./main.js");
  const { splitArrayBuffer, arrayBufferToBase64, SYNC_SAFE_CHUNK_BYTES } = JdbCommandPlugin.__test || {};
  assert.equal(typeof splitArrayBuffer, "function", "large files must expose the standard-sync chunking seam");
  assert.equal(typeof arrayBufferToBase64, "function", "chunks must use a Sync-supported Markdown transport");
  assert.equal(SYNC_SAFE_CHUNK_BYTES, 3 * 1024 * 1024);

  const original = Uint8Array.from({ length: 11 * 1024 * 1024 + 37 }, (_, index) => index % 251);
  const parts = splitArrayBuffer(original.buffer, SYNC_SAFE_CHUNK_BYTES);
  assert.equal(parts.length, 4);
  assert.ok(parts.every((part) => part.byteLength <= SYNC_SAFE_CHUNK_BYTES));

  const encoded = parts.map((part) => arrayBufferToBase64(part));
  assert.ok(encoded.every((part) => Buffer.byteLength(part, "utf8") < 5 * 1024 * 1024));
  const restored = Buffer.concat(encoded.map((part) => Buffer.from(part, "base64")));
  assert.equal(restored.length, original.byteLength);
  assert.deepEqual(restored, Buffer.from(original));
  console.log("standard-sync-chunking: passed");
} finally {
  Module._load = originalLoad;
}
