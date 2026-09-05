export default function HistoryDrawer({ entries, close, restore }) {
  return (
    <>
      <div
        className="history-backdrop open"
        id="historyBackdrop"
        onClick={close}
      />
      <aside
        className="history-drawer open"
        id="historyDrawer"
        aria-labelledby="historyTitle"
      >
        <header className="history-header">
          <div>
            <p className="eyebrow">Version history</p>
            <h2 id="historyTitle">Recent changes</h2>
          </div>
          <button
            className="icon-button"
            id="closeHistoryButton"
            aria-label="Close version history"
            onClick={close}
          >
            ×
          </button>
        </header>
        <div className="history-intro">
          <p>
            RapidCV keeps the last 10 versions you explicitly save on this
            device. Restored versions remain drafts until you save them again.
          </p>
        </div>
        <div className="history-list" id="historyList">
          {entries.length ? (
            entries.map((entry, index) => (
              <button
                className="history-entry"
                key={entry.id}
                data-version-id={entry.id}
                onClick={() => restore(entry)}
              >
                <span className="history-dot">{index === 0 ? "●" : "○"}</span>
                <span>
                  <strong>{entry.label}</strong>
                  <small>
                    {new Date(entry.createdAt).toLocaleString()}
                    {index === 0 ? " · Current" : ""}
                  </small>
                </span>
                <span className="restore-label">
                  {index === 0 ? "" : "Restore"}
                </span>
              </button>
            ))
          ) : (
            <p className="empty-history">
              Your saved versions will appear here.
            </p>
          )}
        </div>
        <footer className="history-footer">
          <span>●</span> Stored locally in this browser
        </footer>
      </aside>
    </>
  );
}
