const assert = require("node:assert/strict");
const Module = require("node:module");

let layoutCallback;
let processorRegistrations = 0;
let commandRegistrations = 0;

class Plugin {
  constructor() {
    this.app = {
      workspace: {
        layoutReady: false,
        onLayoutReady(callback) {
          layoutCallback = callback;
        },
        getLeaf() {
          return { openFile: async () => {} };
        }
      },
      vault: {
        getAbstractFileByPath() {
          return null;
        }
      }
    };
    this.manifest = { version: "test" };
  }

  addCommand() {
    commandRegistrations += 1;
  }

  registerMarkdownCodeBlockProcessor() {
    processorRegistrations += 1;
  }
}

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === "obsidian") {
    return { Plugin, Notice: class Notice {}, normalizePath: (path) => path };
  }
  return originalLoad(request, parent, isMain);
};

try {
  const JdbCommandPlugin = require("./main.js");
  const plugin = new JdbCommandPlugin();
  assert.doesNotThrow(() => plugin.onload());
  assert.equal(commandRegistrations, 1, "command registration should remain available during startup");
  assert.equal(processorRegistrations, 0, "mobile UI must not initialize before layout readiness");
  assert.equal(typeof layoutCallback, "function", "layout-ready callback must be registered");
  assert.doesNotThrow(() => layoutCallback());
  assert.equal(processorRegistrations, 1, "command block must register after layout readiness");
  console.log("mobile-load: passed");
} finally {
  Module._load = originalLoad;
}
