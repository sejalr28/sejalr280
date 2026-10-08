/**
 * ProcessingSteps.jsx
 * ---------------------
 * Shows the RAG pipeline stages while a video is being processed:
 * transcript -> embeddings -> FAISS index.
 *
 * Note: /api/video/process is a single synchronous backend call, so we
 * don't get real per-stage progress from the server. We advance through
 * the labels on a timer while that request is in flight (a common, honest
 * UX pattern for showing what a backend pipeline is conceptually doing).
 * The summary is generated afterwards, inside the workspace.
 */

const STEPS = [
  "Fetching transcript...",
  "Creating embeddings...",
  "Building FAISS index...",
];

function ProcessingSteps({ currentStepIndex }) {
  return (
    <div className="processing-steps">
      {STEPS.map((label, index) => {
        const isDone = index < currentStepIndex;
        const isActive = index === currentStepIndex;

        let className = "processing-step";
        if (isDone) className += " processing-step--done";
        if (isActive) className += " processing-step--active";

        return (
          <div key={label} className={className}>
            <span className="processing-step-icon">
              {isDone && "✓"}
              {isActive && <span className="processing-step-spinner" />}
              {!isDone && !isActive && "○"}
            </span>
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default ProcessingSteps;