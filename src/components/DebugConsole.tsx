import { useDebug } from '../context';

export function DebugConsole() {
  const { entries, clearEntries, copyDebugReport } = useDebug();

  if (entries.length === 0) {
    return (
      <div className="debug-console">
        <div className="debug-header">
          <span>Debug Console</span>
        </div>
        <div className="empty-state" style={{ padding: 'var(--space-lg)' }}>
          <p className="empty-state-description">No debug entries yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="debug-console">
      <div className="debug-header">
        <span>Debug Console ({entries.length})</span>
        <div className="flex gap-sm">
          <button className="btn btn-ghost" onClick={clearEntries}>
            Clear
          </button>
          <button className="btn btn-secondary" onClick={copyDebugReport}>
            Copy Report
          </button>
        </div>
      </div>
      <div className="debug-entries">
        {entries.map((entry) => (
          <div key={entry.id} className={`debug-entry ${entry.type}`}>
            <div className="debug-timestamp">{entry.timestamp}</div>
            <div className="debug-message">{entry.message}</div>
            {(entry.correlationId || entry.apiRoute) && (
              <div className="debug-details">
                {entry.correlationId && <div>ID: {entry.correlationId}</div>}
                {entry.apiRoute && <div>Route: {entry.apiRoute}</div>}
                {entry.workspaceId && <div>Workspace: {entry.workspaceId}</div>}
              </div>
            )}
            {entry.stack && (
              <details className="mt-sm">
                <summary style={{ cursor: 'pointer', color: 'var(--color-text-tertiary)' }}>
                  Stack Trace
                </summary>
                <pre className="debug-details">{entry.stack}</pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
