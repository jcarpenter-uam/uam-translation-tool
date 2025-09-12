import { useState, useRef, useEffect } from "react";
import ConnectionStatus from "./components/con-status";
import Translation from "./components/translation";

const BACKEND_SERVER_URL = "ws://localhost:8000/asr?role=user";

function App() {
  const [viewerStatus, setViewerStatus] = useState({
    status: "Disconnected",
    message: "Connecting...",
  });
  const [transcriptData, setTranscriptData] = useState({
    lines: [],
    buffer: "",
  });
  const viewerSocket = useRef(null);

  const displayBackendResponse = (data) => {
    try {
      const parsed = JSON.parse(data);
      setTranscriptData({
        lines: parsed.lines || [],
        buffer: parsed.buffer_transcription || "",
      });
    } catch (e) {
      console.error("Error parsing backend response:", e);
    }
  };

  useEffect(() => {
    const socket = new WebSocket(BACKEND_SERVER_URL);
    viewerSocket.current = socket;

    socket.onopen = () =>
      setViewerStatus({ status: "Connected", message: "Connected" });
    socket.onmessage = (event) => displayBackendResponse(event.data);
    socket.onerror = () =>
      setViewerStatus({ status: "Error", message: "Connection Error" });
    socket.onclose = () =>
      setViewerStatus({ status: "Disconnected", message: "Disconnected" });

    return () => socket.close(1000, "Component unmounting");
  }, []);

  return (
    <div className="bg-gray-900 text-white flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-4xl bg-gray-800 rounded-2xl shadow-2xl p-8 space-y-6">
        <header className="text-center">
          <h1 className="text-3xl font-bold text-gray-100">
            UAM Translation Tool
          </h1>
        </header>
        <main className="space-y-6">
          <ConnectionStatus viewerStatus={viewerStatus} />
          <Translation transcriptData={transcriptData} />
        </main>
      </div>
    </div>
  );
}

export default App;
