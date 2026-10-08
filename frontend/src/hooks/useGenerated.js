import { useState } from "react";

/**
 * Runs an async generator (quiz, flashcards, ...) and keeps its result plus
 * loading and error state. `data` is { id, items }; `id` changes on every
 * successful run so views can use it as a React key and reset themselves.
 */
export function useGenerated(fetchItems) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const run = async (...args) => {
    setIsLoading(true);
    setError("");
    try {
      setData({ id: Date.now(), items: await fetchItems(...args) });
    } catch (err) {
      setError(err?.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return { data, isLoading, error, run };
}