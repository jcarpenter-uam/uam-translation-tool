import { useState, useRef, useEffect } from "react";

// --- Child Components ---
import ConnectionStatus from "./components/con-status";
import Participants from "./components/participants";
import Translation from "./components/translation";

// TODO: Swap to env variables, for now this is fine
// --- Configuration ---
const MOCK_ZOOM_SERVER_URL = "ws://localhost:8080";
const BACKEND_SERVER_BASE_URL = "ws://localhost:8000/asr";

function App() {
  // --- State Management ---
  const [isConnected, setIsConnected] = useState(false);
  const [zoomStatus, setZoomStatus] = useState({
    status: "Disconnected",
    message: "Disconnected",
  });
  const [viewerStatus, setViewerStatus] = useState({
    status: "Disconnected",
    message: "Disconnected",
  });
  const [participants, setParticipants] = useState([]);
  const [logs, setLogs] = useState([]);

  // --- Refs for WebSocket instances ---
  const zoomSocket = useRef(null);
  const viewerSocket = useRef(null);
  const speakerSockets = useRef(new Map());

  // --- Core WebSocket and State Logic ---
  const base64ToArrayBuffer = (base64) => {
    try {
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    } catch (error) {
      console.error("DECODING FAILED:", error);
      return null;
    }
  };

  const addOrUpdateParticipant = (userId, userName, status) => {
    setParticipants((prev) => {
      const existing = prev.find((p) => p.userId === userId);
      if (existing) {
        return prev.map((p) => (p.userId === userId ? { ...p, status } : p));
      }
      return [...prev, { userId, userName, status }];
    });
  };

  const displayBackendResponse = (data) => {
    const timestamp = new Date().toLocaleTimeString();
    let formattedMessage = data;
    try {
      const parsed = JSON.parse(data);
      if (parsed.lines && parsed.lines.length > 0) {
        formattedMessage = parsed.lines
          .map((line) => `[Speaker ${line.speaker}]: ${line.text || ""}`)
          .join("<br>");
      } else if (parsed.buffer_transcription) {
        formattedMessage = `<i>${parsed.buffer_transcription}</i>`;
      } else if (parsed.type === "ready_to_stop") {
        formattedMessage = "<i>--- End of segment ---</i>";
      }
    } catch (e) {
      /* Not JSON, use raw data */
    }

    setLogs((prev) =>
      [{ timestamp, message: formattedMessage }, ...prev].slice(0, 100),
    );
  };

  const handleDisconnectAll = () => {
    if (zoomSocket.current) zoomSocket.current.close();
    if (viewerSocket.current) viewerSocket.current.close();
    speakerSockets.current.forEach((socket) => socket.close());
    speakerSockets.current.clear();

    setIsConnected(false);
    setZoomStatus({ status: "Disconnected", message: "Disconnected" });
    setViewerStatus({ status: "Disconnected", message: "Disconnected" });
    setParticipants([]);
    setLogs([]);
  };

  useEffect(() => {
    return () => handleDisconnectAll();
  }, []);

  const createSpeakerConnection = (userId, userName) => {
    addOrUpdateParticipant(userId, userName, "Connecting...");
    const connectionUrl = `${BACKEND_SERVER_BASE_URL}?role=speaker`;
    const backendSocket = new WebSocket(connectionUrl);

    backendSocket.onopen = () => {
      addOrUpdateParticipant(userId, userName, "Forwarding");
    };
    backendSocket.onclose = () => {
      addOrUpdateParticipant(userId, userName, "Finished");
      speakerSockets.current.delete(userId);
    };
    speakerSockets.current.set(userId, backendSocket);
  };

  const handleAudioData = (content) => {
    const { user_id, user_name, data } = content;
    if (data === "") {
      const speakerSocket = speakerSockets.current.get(user_id);
      if (speakerSocket) {
        if (speakerSocket.readyState === WebSocket.OPEN)
          speakerSocket.send(new Blob([]));
        setTimeout(() => speakerSocket.close(), 250);
        addOrUpdateParticipant(user_id, user_name, "Finished");
      }
      return;
    }
    if (!speakerSockets.current.has(user_id)) {
      createSpeakerConnection(user_id, user_name);
    }
    const speakerSocket = speakerSockets.current.get(user_id);
    if (speakerSocket && speakerSocket.readyState === WebSocket.OPEN) {
      const audioBuffer = base64ToArrayBuffer(data);
      if (audioBuffer) speakerSocket.send(audioBuffer);
    }
  };

  const connectToViewer = () => {
    const connectionUrl = `${BACKEND_SERVER_BASE_URL}?role=user`;
    viewerSocket.current = new WebSocket(connectionUrl);
    viewerSocket.current.onopen = () =>
      setViewerStatus({ status: "Connected", message: "Connected" });
    viewerSocket.current.onmessage = (event) =>
      displayBackendResponse(event.data);
    viewerSocket.current.onclose = () =>
      setViewerStatus({ status: "Disconnected", message: "Disconnected" });
  };

  const handleConnect = () => {
    if (zoomSocket.current && zoomSocket.current.readyState === WebSocket.OPEN)
      return;
    zoomSocket.current = new WebSocket(MOCK_ZOOM_SERVER_URL);
    zoomSocket.current.onopen = () => {
      setIsConnected(true);
      setZoomStatus({ status: "Connected", message: "Connected" });
      connectToViewer();
    };
    zoomSocket.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.msg_type === 14) handleAudioData(message.content);
    };
    zoomSocket.current.onerror = () =>
      setZoomStatus({ status: "Error", message: "Connection Error" });
    zoomSocket.current.onclose = () => handleDisconnectAll();
  };

  return (
    <div className="bg-gray-900 text-white flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-4xl bg-gray-800 rounded-2xl shadow-2xl p-8 space-y-6">
        <header className="text-center">
          <h1 className="text-3xl font-bold text-gray-100">
            UAM Translation Tool
          </h1>
        </header>

        {/* TODO: Eventually this will auto connect and the buttons will be removed */}
        <div className="flex justify-center space-x-4">
          <button
            onClick={handleConnect}
            disabled={isConnected}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-transform transform hover:scale-105 disabled:bg-gray-500 disabled:cursor-not-allowed disabled:transform-none"
          >
            Connect
          </button>
          <button
            onClick={handleDisconnectAll}
            disabled={!isConnected}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-transform transform hover:scale-105 disabled:bg-gray-500 disabled:cursor-not-allowed disabled:transform-none"
          >
            Disconnect
          </button>
        </div>

        <ConnectionStatus zoomStatus={zoomStatus} viewerStatus={viewerStatus} />
        <Participants participants={participants} />
        <Translation logs={logs} />
      </div>
    </div>
  );
}

export default App;
