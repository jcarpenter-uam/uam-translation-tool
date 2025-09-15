const Translation = ({ transcripts }) => {
  const allLines = Object.entries(transcripts).flatMap(([userName, data]) =>
    data.lines.map((line) => ({
      ...line,
      userName: userName,
    })),
  );

  allLines.sort((a, b) => {
    const timeA = a.beg.split(":").reduce((acc, time) => 60 * acc + +time, 0);
    const timeB = b.beg.split(":").reduce((acc, time) => 60 * acc + +time, 0);
    return timeA - timeB;
  });

  const activeSpeaker = Object.entries(transcripts).find(
    ([_, data]) => data.buffer,
  );

  const hasContent = allLines.length > 0 || !!activeSpeaker;

  return (
    <div className="bg-gray-900 p-6 rounded-lg">
      <h2 className="text-xl font-semibold border-b border-gray-700 pb-2 mb-4">
        Live Translation
      </h2>
      <div className="space-y-2 max-h-60 overflow-y-auto font-mono text-sm bg-gray-950 p-4 rounded-md">
        {!hasContent ? (
          <p className="text-gray-500">Waiting for responses from backend...</p>
        ) : (
          <div>
            {allLines.map((line, index) => {
              // Filter out silent or empty lines.
              if (line.speaker === -2 || !line.text || !line.text.trim()) {
                return null;
              }
              const formatted = `${line.userName}: ${line.text}`;
              return (
                <div
                  key={`${line.userName}-${line.beg}-${index}`}
                  dangerouslySetInnerHTML={{ __html: formatted }}
                />
              );
            })}

            {/* Display the buffer for the currently active speaker */}
            {activeSpeaker && (
              <div>
                <span>{activeSpeaker[0]}: </span>
                <i
                  dangerouslySetInnerHTML={{ __html: activeSpeaker[1].buffer }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Translation;
