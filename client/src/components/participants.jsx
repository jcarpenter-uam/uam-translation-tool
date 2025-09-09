const Participants = ({ participants }) => {
  return (
    <div className="bg-gray-900 p-6 rounded-lg">
      <h2 className="text-xl font-semibold border-b border-gray-700 pb-2 mb-4">
        Detected Participants
      </h2>
      <div className="space-y-4">
        {participants.length === 0 ? (
          <p className="text-gray-500">Waiting for incoming audio streams...</p>
        ) : (
          participants.map(({ userId, userName, status }) => {
            let dotColor = "status-dot-orange";
            let textColor = "text-yellow-400";
            if (status === "Forwarding") {
              dotColor = "status-dot-green";
              textColor = "text-green-400";
            } else if (status === "Finished") {
              dotColor = "status-dot-gray";
              textColor = "text-gray-400";
            }
            return (
              <div
                key={userId}
                className="flex items-center justify-between bg-gray-700 p-3 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <span className="font-bold text-lg">{userName}</span>
                  <span className="text-sm text-gray-400">(ID: {userId})</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`status-dot ${dotColor}`}
                    style={{ animationDuration: "1.5s" }}
                  ></span>
                  <span className={textColor}>{status}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Participants;
