// zoom-rtms-dummy.js - Replicates the specified audio object

const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");

const PORT = 8080;
const RAW_AUDIO_FILE = "audio.raw"; // The pre-processed file from FFmpeg
const wss = new WebSocket.Server({ port: PORT });

// Load the pre-processed raw audio data.
let audioBuffer;
try {
  audioBuffer = fs.readFileSync(path.join(__dirname, RAW_AUDIO_FILE));
} catch (error) {
  console.error(
    `Could not read "${RAW_AUDIO_FILE}". Please create it using the FFmpeg command.`,
  );
  process.exit(1);
}

console.log(`Mock server running on ws://localhost:${PORT}`);

wss.on("connection", (ws) => {
  console.log("Client connected. Starting audio stream replication...");

  let audioCursor = 0;
  const CHUNK_SIZE_BYTES = 4096;

  const streamInterval = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) {
      clearInterval(streamInterval);
      return;
    }

    if (audioCursor >= audioBuffer.length) {
      clearInterval(streamInterval);
      console.log("Finished streaming.");
      return;
    }

    const bufferChunk = audioBuffer.slice(
      audioCursor,
      audioCursor + CHUNK_SIZE_BYTES,
    );
    audioCursor += CHUNK_SIZE_BYTES;

    // This section constructs the JSON object to match your target.
    const messagePayload = {
      // "msg_type": 14
      msg_type: 14,
      content: {
        // "user_id": 16778240
        user_id: 16778240,
        // "user_name": "John Smith"
        user_name: "Test User",
        // "data": (Base64 encoded binary)
        data: bufferChunk.toString("base64"),
        // "timestamp": (current time)
        timestamp: Date.now(),
      },
    };

    ws.send(JSON.stringify(messagePayload));
  }, 100); // Send a chunk every 100ms

  ws.on("close", () => {
    console.log("Client disconnected.");
    clearInterval(streamInterval);
  });
});
