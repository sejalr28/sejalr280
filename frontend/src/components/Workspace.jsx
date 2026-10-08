/**
 * Workspace.jsx
 * --------------
 * The page shown for a processed video: a section menu (Overview, AI Chat,
 * Flashcards, Quiz, Notes) and the selected section. Every section stays
 * mounted and is just hidden when not selected, so chat history, quiz
 * answers and flashcard position survive switching sections. App gives this
 * component key={videoId}, so all of that resets for each new video.
 */

import { useState } from "react";
import WorkspaceNav from "./WorkspaceNav";
import VideoSuccessCard from "./VideoSuccessCard";
import SummaryPanel from "./SummaryPanel";
import ChatBox from "./ChatBox";
import StudyTool from "./StudyTool";
import QuizView from "./QuizView";
import FlashcardView from "./FlashcardView";
import NotesPanel from "./NotesPanel";
import { useGenerated } from "../hooks/useGenerated";
import { generateQuiz, generateFlashcards } from "../services/api";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "chat", label: "AI Chat" },
  { id: "flashcards", label: "Flashcards" },
  { id: "quiz", label: "Quiz" },
  { id: "notes", label: "Notes" },
];

function Workspace({
  videoMeta,
  summary,
  chapters,
  isSummarizing,
  summaryError,
  onRetrySummary,
  messages,
  isAsking,
  onAskQuestion,
  onClearChat,
}) {
  const [tab, setTab] = useState("overview");
  const quiz = useGenerated(async (id) => (await generateQuiz(id)).questions);
  const cards = useGenerated(async (id) => (await generateFlashcards(id)).cards);

  const { videoId, title } = videoMeta;

  return (
    <div className="workspace">
      <WorkspaceNav tabs={TABS} active={tab} onChange={setTab} />

      <div className="workspace-main">
        <div hidden={tab !== "overview"} className="tab-stack">
          <VideoSuccessCard
            title={title}
            thumbnailUrl={videoMeta.thumbnailUrl}
            numChunks={videoMeta.numChunks}
            processingTimeSeconds={videoMeta.processingTimeSeconds}
          />
          {summaryError && (
            <div className="alert-card alert-card--error">
              {summaryError}{" "}
              <button className="panel-action-btn" onClick={onRetrySummary}>
                Try again
              </button>
            </div>
          )}
          <SummaryPanel videoId={videoId} summary={summary} chapters={chapters} isLoading={isSummarizing} />
        </div>

        <div hidden={tab !== "chat"}>
          <ChatBox
            videoId={videoId}
            messages={messages}
            onAskQuestion={onAskQuestion}
            onClearChat={onClearChat}
            isAsking={isAsking}
            disabled={false}
          />
        </div>

        <div hidden={tab !== "flashcards"}>
          <StudyTool
            heading="Flashcards"
            description="Flip through the key ideas from this video."
            generateLabel="Generate flashcards"
            loadingLabel="Making flashcards..."
            emptyText="No flashcards yet. Generate a set to start reviewing."
            state={cards}
            onGenerate={() => cards.run(videoId)}
          >
            {(items, id) => <FlashcardView key={id} cards={items} videoId={videoId} />}
          </StudyTool>
        </div>

        <div hidden={tab !== "quiz"}>
          <StudyTool
            heading="Quiz"
            description="Test yourself with multiple-choice questions from across the video."
            generateLabel="Generate quiz"
            loadingLabel="Writing quiz questions..."
            emptyText="No quiz yet. Generate one to test what you remember."
            state={quiz}
            onGenerate={() => quiz.run(videoId)}
          >
            {(items, id) => <QuizView key={id} questions={items} videoId={videoId} />}
          </StudyTool>
        </div>

        <div hidden={tab !== "notes"}>
          <NotesPanel
            videoId={videoId}
            title={title}
            summary={summary}
            chapters={chapters}
            cards={cards.data?.items}
            quiz={quiz.data?.items}
          />
        </div>
      </div>
    </div>
  );
}

export default Workspace;