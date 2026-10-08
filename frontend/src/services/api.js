/**
 * api.js
 * -------
 * Centralized wrapper for all backend HTTP calls.
 *
 * Why this file exists:
 * Keeping every axios call in one place means components never need to
 * know API URLs or request/response shapes directly -- they just call
 * a clearly-named function like `processVideo(url)`. This makes the
 * codebase easier to maintain and to explain in an interview.
 */

import axios from "axios";

// In dev this defaults to the local backend. In a deployed build, set
// VITE_API_BASE_URL at build time (see docker-compose.yml / README) to
// point at the real backend URL instead.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

/**
 * Submits a YouTube URL for background processing (transcript fetch ->
 * chunking -> embedding -> FAISS storage) and returns immediately.
 * Returns { job_id, status }. Use pollVideoJob to wait for the result.
 */
export async function submitVideo(youtubeUrl) {
  const response = await apiClient.post("/video/process", {
    youtube_url: youtubeUrl,
  });
  return response.data;
}

/** One-shot job status check. */
export async function getVideoJob(jobId) {
  const response = await apiClient.get(`/video/jobs/${jobId}`);
  // { job_id, status: "pending"|"processing"|"done"|"error", stage, result, error }
  return response.data;
}

/**
 * Submits a video and polls until it finishes, calling onStage(stage) after
 * every poll so the UI can show real progress. Resolves with the result on
 * success; rejects with an Error (message = the backend's error detail) on
 * failure or if it doesn't finish within maxWaitMs.
 */
export async function processVideo(youtubeUrl, onStage = () => {}, { intervalMs = 800, maxWaitMs = 300000 } = {}) {
  const { job_id: jobId } = await submitVideo(youtubeUrl);
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const job = await getVideoJob(jobId);
    onStage(job.stage);

    if (job.status === "done") return job.result;
    if (job.status === "error") throw new Error(job.error || "Processing failed.");

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("This is taking longer than expected. Please try again.");
}

/**
 * Asks a question about a previously-processed video (RAG Q&A).
 * `history` is the earlier conversation ([{ role, text }, ...], oldest
 * first) so follow-up questions like "why is that?" can be resolved.
 */
export async function askQuestion(videoId, question, history = []) {
  const response = await apiClient.post("/chat/ask", {
    video_id: videoId,
    question,
    history: history.map(({ role, text }) => ({ role, text })),
  });
  return response.data; // { answer, sources: [{ text, start_time }] }
}

/**
 * Requests an AI-generated summary of a previously-processed video.
 */
export async function summarizeVideo(videoId) {
  const response = await apiClient.post("/chat/summarize", {
    video_id: videoId,
  });
  return response.data; // { video_id, summary }
}

/**
 * Generates a multiple-choice quiz for a processed video.
 */
export async function generateQuiz(videoId, count = 5) {
  const response = await apiClient.post("/study/quiz", {
    video_id: videoId,
    count,
  });
  return response.data; // { video_id, questions: [{ question, options, answer_index, explanation, start_time }] }
}

/**
 * Generates study flashcards for a processed video.
 */
export async function generateFlashcards(videoId, count = 8) {
  const response = await apiClient.post("/study/flashcards", {
    video_id: videoId,
    count,
  });
  return response.data; // { video_id, cards: [{ front, back, start_time }] }
}