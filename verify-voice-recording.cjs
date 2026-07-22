const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync(require.resolve("./main.js"), "utf8");

assert.match(source, /navigator\.mediaDevices\.getUserMedia/, "voice recording must request the microphone through the browser API");
assert.match(source, /new MediaRecorder/, "voice recording must use MediaRecorder on mobile");
assert.match(source, /jdb-command-record-voice/, "the command screen must expose a dedicated voice button");
assert.match(source, /jdb-command-stop-voice/, "an active recording must expose an explicit stop control");
assert.match(source, /jdb-command-recording-status/, "recording state must be visible and announced");
assert.match(source, /audio\.src = URL\.createObjectURL/, "recorded audio must be previewable before submission");
assert.match(source, /selectedFiles\.push\(\{ key, file \}\)/, "recorded audio must join the same verified attachment batch");
assert.match(source, /recordingStream\.getTracks\(\)\.forEach/, "microphone tracks must be released after recording");

console.log("voice-recording-contract: passed");
