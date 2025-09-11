import { useState, useRef, useEffect } from "react";

// --- Child Components ---
import ConnectionStatus from "./components/con-status";
import Translation from "./components/translation";

// --- Configuration ---
const BACKEND_SERVER_URL = "ws://localhost:8000/asr?role=user";

function App() {
  // --- State Management ---
  const [viewerStatus, setViewerStatus] = useState({
    status: "Disconnected",
    message: "Connecting...",
  });
  const [logs, setLogs] = useState([]);
  const viewerSocket = useRef(null);

  // --- Display and Formatting Logic ---
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
      // If it's not JSON, display the raw data
    }

    setLogs((prev) =>
      [{ timestamp, message: formattedMessage }, ...prev].slice(0, 100),
    );
  };

  // --- Auto-Connection on Component Mount ---
  useEffect(() => {
    // Create a new socket instance. This is local to the effect's execution.
    const socket = new WebSocket(BACKEND_SERVER_URL);
    viewerSocket.current = socket;

    socket.onopen = () => {
      // **THE FIX:** Only update state if this is still the current socket.
      // This prevents a previously closed socket from updating the state.
      if (viewerSocket.current === socket) {
        setViewerStatus({ status: "Connected", message: "Connected" });
      }
    };

    socket.onmessage = (event) => {
      // No check needed here as we want all messages, but it's good practice.
      displayBackendResponse(event.data);
    };

    socket.onerror = () => {
      if (viewerSocket.current === socket) {
        setViewerStatus({ status: "Error", message: "Connection Error" });
      }
    };

    socket.onclose = () => {
      if (viewerSocket.current === socket) {
        setViewerStatus({ status: "Disconnected", message: "Disconnected" });
      }
    };

    // Cleanup function: this will run when the component unmounts.
    return () => {
      // Use the .close() method with a code and reason.
      // This is cleaner than just letting the connection drop.
      socket.close(1000, "Component unmounting");
    };
  }, []); // The empty dependency array ensures this runs only once on mount

  return (
    <div className="bg-gray-900 text-white flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-4xl bg-gray-800 rounded-2xl shadow-2xl p-8 space-y-6">
        <header className="text-center">
          <h1 className="text-3xl font-bold text-gray-100">
            UAM Translation Tool
          </h1>
        </header>

        <ConnectionStatus viewerStatus={viewerStatus} />
        <Translation logs={logs} />
      </div>
    </div>
  );
}

export default App;
