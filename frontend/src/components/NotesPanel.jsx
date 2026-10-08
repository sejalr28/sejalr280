/**
 * NotesPanel.jsx
 * ---------------
 * Previews and downloads the study notes: summary, chapters, and any
 * flashcards or quiz that have been generated, as one Markdown file.
 */

import { buildNotesMarkdown, downloadTextFile, notesFilename } from "../utils/notes";

function NotesPanel({ videoId, title, summary, chapters, cards, quiz }) {
  const markdown = buildNotesMarkdown({ videoId, title, summary, chapters, cards, quiz });

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <div>
          <h2 className="tool-title">Notes</h2>
          <p className="tool-desc">
            Your summary and chapters, plus any flashcards or quiz you have generated, as one Markdown file.
          </p>
        </div>
        <button
          className="study-generate"
          disabled={!summary}
          onClick={() => downloadTextFile(notesFilename(title), markdown)}
        >
          Download .md
        </button>
      </div>
      <pre className="notes-preview">{markdown}</pre>
    </div>
  );
}

export default NotesPanel;