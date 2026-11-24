import type { ContentItem, ListMetadata } from "@bfbs/common-sdk";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { reportError } from "@/infra/error";
import {
  isValidSearchTerm,
  normalizeSearchTerm,
  SEARCH_DEBOUNCE_MS,
  searchResultsQueryOptions,
} from "../search-results";

const EMPTY_ITEMS: ContentItem[] = [];

export type SearchResultsState = {
  draftQuery: string;
  error: unknown | null;
  isEmpty: boolean;
  isLoading: boolean;
  items: ContentItem[];
  metadata: ListMetadata | null;
  retry: () => void;
  setDraftQuery: (query: string) => void;
  submitQuery: (query: string) => void;
  submittedQuery: string | null;
};

/** Coordinates debounced and explicit Common SDK result searches. */
export function useSearchResults(): SearchResultsState {
  const [draftQuery, setDraftQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const normalizedDraftQuery = normalizeSearchTerm(draftQuery);
  const hasValidDraftQuery = isValidSearchTerm(normalizedDraftQuery);
  const activeSubmittedQuery = hasValidDraftQuery ? submittedQuery : null;
  const resultsQuery = useQuery(
    searchResultsQueryOptions(activeSubmittedQuery),
  );

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (!hasValidDraftQuery) {
      setSubmittedQuery(null);
      return;
    }

    if (normalizedDraftQuery === submittedQuery) {
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      setSubmittedQuery(normalizedDraftQuery);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [hasValidDraftQuery, normalizedDraftQuery, submittedQuery]);

  useEffect(() => {
    if (!resultsQuery.error) {
      return;
    }

    reportError(resultsQuery.error, {
      tags: { area: "search", operation: "get_search_results" },
    });
  }, [resultsQuery.error]);

  function submitQuery(query: string) {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const normalizedQuery = normalizeSearchTerm(query);
    setSubmittedQuery(
      isValidSearchTerm(normalizedQuery) ? normalizedQuery : null,
    );
  }

  function retry() {
    if (activeSubmittedQuery) {
      void resultsQuery.refetch();
    }
  }

  const items = resultsQuery.data?.items ?? EMPTY_ITEMS;

  return {
    draftQuery,
    error: resultsQuery.error,
    isEmpty: resultsQuery.isSuccess && items.length === 0,
    isLoading: resultsQuery.isFetching,
    items,
    metadata: resultsQuery.data?.metadata ?? null,
    retry,
    setDraftQuery,
    submitQuery,
    submittedQuery: activeSubmittedQuery,
  };
}
