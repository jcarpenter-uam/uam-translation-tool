const Translation = ({ transcriptData }) => {
  const { lines, buffer } = transcriptData;

  const formatLine = (line) => {
    if (line.speaker === -2) return null;

    const speakerLabel =
      line.speaker === -1 ? "Speaker 1" : `Speaker ${line.speaker}`;
    return `${speakerLabel}: ${line.text || ""}`;
  };

  const hasContent = lines.length > 0 || buffer.trim() !== "";

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
            {lines.map((line, index) => {
              const formatted = formatLine(line);
              return formatted ? (
                <div
                  key={index}
                  dangerouslySetInnerHTML={{ __html: formatted }}
                />
              ) : null;
            })}

            {buffer && (
              <div>
                <span>Speaker 1: </span>
                <i dangerouslySetInnerHTML={{ __html: buffer }} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Translation;
