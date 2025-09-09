const StatusIndicator = ({ label, connection }) => {
  const isConnected = connection.status === "Connected";
  const dotColor = isConnected ? "status-dot-green" : "status-dot-red";
  const textColor = isConnected ? "text-green-400" : "text-red-400";

  return (
    <div className="flex items-center space-x-3">
      <span className={`status-dot ${dotColor}`}></span>
      <span className="font-medium">{label}:</span>
      <span className={textColor}>{connection.message}</span>
    </div>
  );
};

const ConnectionStatus = ({ zoomStatus, viewerStatus }) => {
  return (
    <div className="bg-gray-900 p-6 rounded-lg space-y-4">
      <h2 className="text-xl font-semibold border-b border-gray-700 pb-2">
        Connection Status
      </h2>
      <StatusIndicator label="Zoom RTMS Server" connection={zoomStatus} />
      <StatusIndicator label="Translation Server" connection={viewerStatus} />
    </div>
  );
};

export default ConnectionStatus;
