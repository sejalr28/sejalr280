/**
 * StudyTool.jsx
 * --------------
 * Shared page layout for a generated study tool (quiz, flashcards): heading,
 * a Generate / Regenerate button, loading and error states, and the result.
 * `state` comes from useGenerated; `children` is called with (items, id).
 */

import LoadingSpinner from "./LoadingSpinner";

function StudyTool({ heading, description, generateLabel, loadingLabel, emptyText, state, onGenerate, children }) {
  const { data, isLoading, error } = state;

  return (
    <div className="tool-panel">
      <div className="tool-header">
        <div>
          <h2 className="tool-title">{heading}</h2>
          <p className="tool-desc">{description}</p>
        </div>
        {!isLoading && (
          <button className="study-generate" onClick={onGenerate}>
            {data ? "Regenerate" : generateLabel}
          </button>
        )}
      </div>

      {error && <div className="alert-card alert-card--error">{error}</div>}
      {isLoading && <LoadingSpinner label={loadingLabel} />}
      {!isLoading && data && children(data.items, data.id)}
      {!isLoading && !data && <p className="tool-empty">{emptyText}</p>}
    </div>
  );
}

export default StudyTool;