const Translation = ({ logs }) => {
  return (
    <div className="bg-gray-900 p-6 rounded-lg">
      <h2 className="text-xl font-semibold border-b border-gray-700 pb-2 mb-4">
        Live Translation
      </h2>
      <div className="space-y-2 max-h-60 overflow-y-auto font-mono text-sm bg-gray-950 p-4 rounded-md">
        {logs.length === 0 ? (
          <p className="text-gray-500">Waiting for responses from backend...</p>
        ) : (
          logs.map((log, index) => (
            <div key={index}>
              <span className="text-gray-500 mr-2">[{log.timestamp}]</span>
              <span dangerouslySetInnerHTML={{ __html: log.message }} />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Translation;
