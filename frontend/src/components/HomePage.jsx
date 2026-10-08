/**
 * HomePage.jsx
 * -------------
 * Landing page: what the app does, plus the URL box that starts processing.
 * Shown before a video is processed, and whenever the user clicks "New video".
 */

import VideoInput from "./VideoInput";

const FEATURES = [
  ["Summary & chapters", "A short summary plus a timestamped chapter list, even for hour-long videos."],
  ["AI chat", "Ask questions and get answers grounded in the video, with links to the exact moment."],
  ["Flashcards", "Key ideas turned into flip cards you can review, each linked back to the video."],
  ["Quiz", "Multiple-choice questions from across the video, with explanations."],
];

function HomePage({ onProcessVideo, isProcessing, currentStepIndex, error, resumeTitle, onResume }) {
  return (
    <div className="home">
      <h1 className="home-title">Learn from any YouTube video</h1>
      <p className="home-subtitle">
        Paste a link and get a summary, an AI tutor you can question, flashcards and a quiz.
      </p>

      <VideoInput
        onProcessVideo={onProcessVideo}
        isProcessing={isProcessing}
        currentStepIndex={currentStepIndex}
      />

      {error && <div className="alert-card alert-card--error home-error">{error}</div>}

      {resumeTitle && !isProcessing && (
        <button className="home-resume" onClick={onResume}>
          ← Back to “{resumeTitle}”
        </button>
      )}

      <div className="feature-grid">
        {FEATURES.map(([title, text]) => (
          <div key={title} className="feature-card">
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default HomePage;