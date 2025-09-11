import React, { useState, useMemo, useCallback } from 'react';

export interface PaginationConfig {
  initialPage?: number;
  pageSize?: number;
}

export interface PaginationResult<T> {
  // Data
  currentData: T[];
  totalPages: number;
  currentPage: number;
  pageSize: number;
  totalItems: number;
  
  // Navigation
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  goToFirst: () => void;
  goToLast: () => void;
  
  // State
  canGoNext: boolean;
  canGoPrev: boolean;
  
  // For search/filter
  setFilteredData: (data: T[]) => void;
}

export const usePagination = <T>(
  data: T[],
  config: PaginationConfig = {}
): PaginationResult<T> => {
  const { initialPage = 1, pageSize = 50 } = config;
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [filteredData, setFilteredDataState] = useState<T[]>(data);

  // Update filtered data when original data changes
  React.useEffect(() => {
    setFilteredDataState(data);
  }, [data]);

  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const currentData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, pageSize]);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const goToFirst = useCallback(() => {
    goToPage(1);
  }, [goToPage]);

  const goToLast = useCallback(() => {
    goToPage(totalPages);
  }, [goToPage, totalPages]);

  const canGoNext = currentPage < totalPages;
  const canGoPrev = currentPage > 1;

  const setFilteredData = useCallback((data: T[]) => {
    setFilteredDataState(data);
    setCurrentPage(1); // Reset to first page when data changes
  }, []);

  // Reset to first page if current page exceeds total pages
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  return {
    currentData,
    totalPages,
    currentPage,
    pageSize,
    totalItems,
    goToPage,
    nextPage,
    prevPage,
    goToFirst,
    goToLast,
    canGoNext,
    canGoPrev,
    setFilteredData,
  };
};

// Database pagination hook for Supabase
export const useDatabasePagination = (pageSize = 50) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const range = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize - 1;
    return { start, end };
  }, [currentPage, pageSize]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  return {
    currentPage,
    pageSize,
    range,
    totalCount,
    totalPages,
    setTotalCount,
    goToPage,
    nextPage,
    prevPage,
    canGoNext: currentPage < totalPages,
    canGoPrev: currentPage > 1,
  };
};