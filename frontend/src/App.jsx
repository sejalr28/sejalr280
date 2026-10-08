/**
 * App.jsx
 * --------
 * Root component with two pages:
 *   - Home: what the app does, plus the URL box that processes a video
 *   - Workspace: the processed video, split into sections (see Workspace.jsx)
 *
 * App owns the state shared by both pages (video metadata, summary, chat
 * history) and coordinates calls to the backend via services/api.js.
 */

import { useState, useRef } from "react";

// Maps the backend job's `stage` string to a step index for ProcessingSteps.
const STAGE_TO_STEP = {
  queued: 0,
  fetching_transcript: 0,
  chunking: 1,
  embedding_and_indexing: 2,
};
import HomePage from "./components/HomePage";
import Workspace from "./components/Workspace";
import { processVideo, askQuestion, summarizeVideo } from "./services/api";

function App() {
  const [view, setView] = useState("home"); // "home" | "workspace"
  const [videoMeta, setVideoMeta] = useState(null); // { videoId, title, thumbnailUrl, numChunks, processingTimeSeconds }

  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [processError, setProcessError] = useState("");
  const activeVideoRef = useRef(null); // ignores summary results that arrive after a newer video started

  const [summary, setSummary] = useState("");
  const [chapters, setChapters] = useState([]);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  const [messages, setMessages] = useState([]);
  const [isAsking, setIsAsking] = useState(false);

  const loadSummary = async (videoId) => {
    setSummaryError("");
    setIsSummarizing(true);
    try {
      const result = await summarizeVideo(videoId);
      if (activeVideoRef.current !== videoId) return;
      setSummary(result.summary);
      setChapters(result.chapters || []);
    } catch (err) {
      if (activeVideoRef.current !== videoId) return;
      setSummaryError(err?.response?.data?.detail || "Could not generate the summary.");
    } finally {
      if (activeVideoRef.current === videoId) setIsSummarizing(false);
    }
  };

  /**
   * Full "process video" flow:
   *   1. Submit the URL; the backend processes it as a background job while
   *      we poll for status (see processVideo in services/api.js) and turn
   *      each real `stage` the job reports into a step index for the UI.
   *   2. On success, open the workspace right away (chat works as soon as the
   *      video is indexed) and generate the summary in the background.
   */
  const handleProcessVideo = async (youtubeUrl) => {
    setIsProcessing(true);
    setProcessError("");
    setCurrentStepIndex(0);

    let result;
    try {
      result = await processVideo(youtubeUrl, (stage) => {
        setCurrentStepIndex(STAGE_TO_STEP[stage] ?? 0);
      });
    } catch (err) {
      setProcessError(err?.response?.data?.detail || err?.message || "Something went wrong. Please try again.");
      return;
    } finally {
      setIsProcessing(false);
    }

    activeVideoRef.current = result.video_id;
    setSummary("");
    setChapters([]);
    setMessages([]);
    setVideoMeta({
      videoId: result.video_id,
      title: result.title,
      thumbnailUrl: result.thumbnail_url,
      numChunks: result.num_chunks,
      processingTimeSeconds: result.processing_time_seconds,
    });
    setView("workspace");
    loadSummary(result.video_id);
  };

  /**
   * Handles a user question: appends it to chat history, calls the RAG
   * endpoint, then appends the AI's answer.
   */
  const handleAskQuestion = async (question) => {
    // Earlier turns (excluding failed ones) give the backend context for follow-ups.
    const history = messages.filter((m) => !m.isError);

    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setIsAsking(true);

    try {
      const result = await askQuestion(videoMeta.videoId, question, history);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: result.answer, sources: result.sources },
      ]);
    } catch (err) {
      const detail = err?.response?.data?.detail || "Failed to get an answer.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `Error: ${detail}`, isError: true },
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  const handleClearChat = () => setMessages([]);

  const showWorkspace = view === "workspace" && videoMeta;

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView("home")} aria-label="Home">
          <div className="app-header-mark">▶</div>
          <div>
            <h1 className="app-title">NoteTube AI</h1>
            {!showWorkspace && <p className="app-subtitle">YouTube Learning Assistant</p>}
          </div>
        </button>

        {showWorkspace && (
          <>
            <span className="topbar-video">{videoMeta.title}</span>
            <button className="panel-action-btn" onClick={() => setView("home")}>
              + New video
            </button>
          </>
        )}
      </header>

      <main className="app-content">
        {/* Workspace stays mounted (just hidden) while on Home, so nothing is lost. */}
        {videoMeta && (
          <div hidden={!showWorkspace}>
            <Workspace
              key={videoMeta.videoId}
              videoMeta={videoMeta}
              summary={summary}
              chapters={chapters}
              isSummarizing={isSummarizing}
              summaryError={summaryError}
              onRetrySummary={() => loadSummary(videoMeta.videoId)}
              messages={messages}
              isAsking={isAsking}
              onAskQuestion={handleAskQuestion}
              onClearChat={handleClearChat}
            />
          </div>
        )}

        {!showWorkspace && (
          <HomePage
            onProcessVideo={handleProcessVideo}
            isProcessing={isProcessing}
            currentStepIndex={currentStepIndex}
            error={processError}
            resumeTitle={videoMeta?.title}
            onResume={() => setView("workspace")}
          />
        )}
      </main>

      <footer className="app-footer">
        <p className="app-footer-text">Powered by FAISS + Sentence Transformers + Groq</p>
      </footer>
    </div>
  );
}

export default App;