import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "@/components/ui/pagination";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Search, BookText, AlertCircle, Database, Shield, AlertTriangle, Keyboard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import CSVManager from "./CSVManager";
import DragDropUpload from "./DragDropUpload";
import { listSavedGlossaries, createSavedGlossary, deleteSavedGlossary as deleteSavedGlossaryDb } from "@/lib/glossaries";
import { validateInput, wordReplacementSchema, glossaryNameSchema, ValidationError, RateLimiter } from "@/lib/validation";
import { handleError, handleAsync, withRetry, ErrorCategory } from "@/lib/error-handler";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WordReplacementsSkeleton } from "./LoadingStates";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "./PaginationControls";

// Initialize rate limiter for API calls (10 requests per minute per user)
const rateLimiter = new RateLimiter(10, 60000);

interface WordReplacement {
  id: string;
  original_word: string;
  replacement_word: string;
}

interface SavedGlossary {
  id: string;
  user_id: string;
  name: string;
  glossary_data: WordReplacement[];
  created_at: string;
  updated_at: string;
}

interface WordReplacementsProps {
  sessionId: string | null;
  onReplacementsChange: (replacements: WordReplacement[]) => void;
}

const WordReplacements: React.FC<WordReplacementsProps> = ({ sessionId, onReplacementsChange }) => {
  const [replacements, setReplacements] = useState<WordReplacement[]>([]);
  const [newOriginal, setNewOriginal] = useState('');
  const [newReplacement, setNewReplacement] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [savedGlossaries, setSavedGlossaries] = useState<SavedGlossary[]>([]);
  const [loadingSavedGlossaries, setLoadingSavedGlossaries] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showAllGlossaries, setShowAllGlossaries] = useState(false);
  const [showAllMobileEntries, setShowAllMobileEntries] = useState(false);
  
  const { toast } = useToast();
  const { userRole, user } = useAuth();

  // Memoized sort function for performance
  const sortReplacements = useCallback((replacements: WordReplacement[]) => {
    return [...replacements].sort((a, b) => {
      const lengthDiff = b.original_word.length - a.original_word.length;
      if (lengthDiff !== 0) return lengthDiff;
      return a.original_word.localeCompare(b.original_word);
    });
  }, []);

  // Memoized filtered replacements
  const filteredReplacements = useMemo(() => {
    return replacements.filter(replacement =>
      replacement.original_word.toLowerCase().includes(searchTerm.toLowerCase()) ||
      replacement.replacement_word.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [replacements, searchTerm]);

  // Pagination hook for better performance with large datasets
  const pagination = usePagination(filteredReplacements, { pageSize: itemsPerPage });

  // Keyboard shortcuts
  const shortcutCallbacks = useMemo(() => ({
    onSave: () => saveGlossary(),
    onAdd: () => addReplacement(),
    onDelete: () => removeSelectedReplacements(),
    onClear: () => {
      setReplacements([]);
      setSelectedItems(new Set());
    },
    onExport: () => document.getElementById('csv-export-button')?.click(),
    onImport: () => document.getElementById('csv-import-button')?.click(),
  }), []);

  // Keyboard shortcuts - simplified version
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveGlossary();
      }
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        addReplacement();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Replace existing pagination logic with optimized version
  const totalPages = Math.ceil(pagination.totalItems / pagination.pageSize);
  const currentReplacements = pagination.currentData;

  // Reset pagination and selection on search/data change
  useEffect(() => {
    setCurrentPage(1);
  }, [replacements.length, searchTerm]);

  useEffect(() => {
    setSelectedItems(new Set());
  }, [searchTerm]);

  // Load data when component mounts or sessionId changes
  useEffect(() => {
    if (sessionId) {
      loadReplacements();
    } else {
      setReplacements([]);
    }
  }, [sessionId]);

  // Notify parent of changes
  useEffect(() => {
    onReplacementsChange(replacements);
  }, [replacements, onReplacementsChange]);

  // Load saved glossaries for authenticated users
  useEffect(() => {
    if (user) {
      loadSavedGlossaries();
    } else {
      setSavedGlossaries([]);
    }
  }, [user?.id]);

  // Show loading skeleton while data is being fetched
  if (isLoading) {
    return <WordReplacementsSkeleton />;
  }

  // Enhanced load saved glossaries with error handling
  const loadSavedGlossaries = handleAsync(async () => {
    if (!user) return;
    
    setLoadingSavedGlossaries(true);
    try {
      const list = await withRetry(() => listSavedGlossaries());
      setSavedGlossaries(list as unknown as SavedGlossary[]);
    } catch (error) {
      handleError(error, 'loadSavedGlossaries');
    } finally {
      setLoadingSavedGlossaries(false);
    }
  });

  // Enhanced save glossary with validation
  const saveGlossary = handleAsync(async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to save glossaries.",
        variant: "destructive",
      });
      return;
    }

    if (replacements.length === 0) {
      toast({
        title: "Nothing to Save",
        description: "Add some word replacements before saving.",
        variant: "destructive",
      });
      return;
    }

    const glossaryName = prompt("Enter a name for this glossary:");
    if (!glossaryName) return;

    try {
      const validatedName = validateInput(glossaryNameSchema, glossaryName);
      
      await withRetry(async () => {
        const inserted = await createSavedGlossary(user.id, validatedName, replacements);
        setSavedGlossaries((prev) => [inserted as unknown as SavedGlossary, ...prev]);
      });
      
      toast({
        title: "Glossary Saved",
        description: `"${validatedName}" has been saved with ${replacements.length} entries.`,
      });
    } catch (error) {
      handleError(error, 'saveGlossary');
    }
  });

  // Enhanced load glossary with database persistence
  const loadGlossary = handleAsync(async (glossaryData: WordReplacement[]) => {
    const sortedData = sortReplacements(glossaryData);
    setReplacements(sortedData);
    
    // If we have a session, save the loaded glossary entries to the database
    if (sessionId) {
      setIsSaving(true);
      try {
        await withRetry(async () => {
          // First clear existing replacements for this session
          const { error: deleteError } = await supabase
            .from('word_replacements')
            .delete()
            .eq('session_id', sessionId);
          
          if (deleteError) throw deleteError;
          
          // Then insert the new glossary entries
          const { error: insertError } = await supabase
            .from('word_replacements')
            .insert(
              sortedData.map(r => ({
                session_id: sessionId,
                original_word: r.original_word,
                replacement_word: r.replacement_word,
              }))
            );
          
          if (insertError) throw insertError;
        });
        
        toast({
          title: "Glossary Loaded & Saved",
          description: `Loaded ${glossaryData.length} glossary entries and saved to database.`,
        });
      } catch (error) {
        handleError(error, 'loadGlossary');
        toast({
          title: "Glossary Loaded",
          description: `Loaded ${glossaryData.length} glossary entries (not saved to database).`,
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }
    } else {
      toast({
        title: "Glossary Loaded",
        description: `Loaded ${glossaryData.length} glossary entries.`,
      });
    }
  });

  // Enhanced delete glossary with error handling
  const deleteGlossary = handleAsync(async (id: string, glossaryName: string) => {
    try {
      await withRetry(() => deleteSavedGlossaryDb(id));
      setSavedGlossaries((prev) => prev.filter((g) => g.id !== id));
      toast({
        title: "Glossary Deleted",
        description: `"${glossaryName}" has been deleted.`,
      });
    } catch (error) {
      handleError(error, 'deleteGlossary');
    }
  });

  // Enhanced load replacements with error handling
  const loadReplacements = handleAsync(async () => {
    if (!sessionId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('word_replacements')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Sort the loaded replacements with proper type assertion
      const validData = (data || []).filter(item => 
        item.id && item.original_word && item.replacement_word
      ) as WordReplacement[];
      const sortedData = sortReplacements(validData);
      setReplacements(sortedData);
    } catch (error) {
      handleError(error, 'loadReplacements');
    } finally {
      setIsLoading(false);
    }
  });

  // Enhanced add replacement with comprehensive validation
  const addReplacement = handleAsync(async () => {
    // Clear previous validation errors
    setValidationErrors({});

    // Rate limiting check
    if (!rateLimiter.isAllowed(user?.id || 'anonymous')) {
      toast({
        title: "Too Many Requests",
        description: "Please wait a moment before adding more entries.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Validate input using schema
      const validatedData = validateInput(wordReplacementSchema, {
        original_word: newOriginal,
        replacement_word: newReplacement,
      });

      // Check for duplicates
      const isDuplicate = replacements.some(
        (r) => r.original_word.toLowerCase() === validatedData.original_word.toLowerCase()
      );

      if (isDuplicate) {
        throw new ValidationError("This original word already exists in your glossary", 'original_word');
      }

      // Check reasonable limits
      if (replacements.length >= 10000) {
        throw new ValidationError("Maximum of 10,000 glossary entries allowed");
      }

      const newRepl: WordReplacement = {
        id: sessionId ? crypto.randomUUID() : Date.now().toString(),
        original_word: validatedData.original_word,
        replacement_word: validatedData.replacement_word,
      };

      if (!sessionId) {
        const updatedReplacements = sortReplacements([...replacements, newRepl]);
        setReplacements(updatedReplacements);
        setNewOriginal('');
        setNewReplacement('');
        toast({
          title: "Glossary Entry Added",
          description: `"${newRepl.original_word}" will be replaced with "${newRepl.replacement_word}"`,
        });
        return;
      }

      setIsSaving(true);
      const result = await withRetry(async () => {
        const { data, error } = await supabase
          .from('word_replacements')
          .insert({
            session_id: sessionId,
            original_word: newRepl.original_word,
            replacement_word: newRepl.replacement_word,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      });

      const updatedReplacements = sortReplacements([...replacements, result]);
      setReplacements(updatedReplacements);
      setNewOriginal('');
      setNewReplacement('');

      toast({
        title: "Glossary Entry Added",
        description: `"${newRepl.original_word}" will be replaced with "${newRepl.replacement_word}"`,
      });
    } catch (error) {
      if (error instanceof ValidationError && error.field) {
        setValidationErrors({ [error.field]: error.message });
      }
      handleError(error, 'addReplacement');
    } finally {
      setIsSaving(false);
    }
  });

  // Enhanced remove replacement with error handling
  const removeReplacement = handleAsync(async (id: string) => {
    if (!sessionId) {
      setReplacements(replacements.filter(r => r.id !== id));
      return;
    }

    try {
      await withRetry(async () => {
        const { error } = await supabase
          .from('word_replacements')
          .delete()
          .eq('id', id);

        if (error) throw error;
      });

      setReplacements(replacements.filter(r => r.id !== id));
      toast({
        title: "Glossary Entry Removed",
        description: "The glossary entry has been deleted.",
      });
    } catch (error) {
      handleError(error, 'removeReplacement');
    }
  });

  // Enhanced remove selected replacements
  const removeSelectedReplacements = handleAsync(async () => {
    if (selectedItems.size === 0) return;

    if (!sessionId) {
      setReplacements(replacements.filter(r => !selectedItems.has(r.id)));
      setSelectedItems(new Set());
      return;
    }

    setIsSaving(true);
    try {
      await withRetry(async () => {
        const { error } = await supabase
          .from('word_replacements')
          .delete()
          .in('id', Array.from(selectedItems));

        if (error) throw error;
      });

      setReplacements(replacements.filter(r => !selectedItems.has(r.id)));
      setSelectedItems(new Set());

      toast({
        title: "Glossary Entries Removed",
        description: `${selectedItems.size} glossary entries have been deleted.`,
      });
    } catch (error) {
      handleError(error, 'removeSelectedReplacements');
    } finally {
      setIsSaving(false);
    }
  });

  // Enhanced import with validation
  const handleImportReplacements = handleAsync(async (importedReplacements: Omit<WordReplacement, 'id'>[]) => {
    try {
      // Validate all imported items
      const validatedReplacements = importedReplacements.map((r, index) => {
        try {
          return validateInput(wordReplacementSchema, r);
        } catch (error) {
          throw new ValidationError(`Row ${index + 1}: ${error instanceof ValidationError ? error.message : 'Invalid data'}`);
        }
      });

      // Check total limit
      if (replacements.length + validatedReplacements.length > 10000) {
        throw new ValidationError("Import would exceed maximum of 10,000 glossary entries");
      }

      if (!sessionId) {
        const newReplacements: WordReplacement[] = validatedReplacements.map((r, index) => ({
          id: Date.now().toString() + index.toString(),
          original_word: r.original_word,
          replacement_word: r.replacement_word,
        }));
        const updatedReplacements = sortReplacements([...replacements, ...newReplacements]);
        setReplacements(updatedReplacements);
        toast({
          title: "Import Successful",
          description: `Imported ${newReplacements.length} glossary entries.`,
        });
        return;
      }

      setIsSaving(true);
      const result = await withRetry(async () => {
        const { data, error } = await supabase
          .from('word_replacements')
          .insert(
            validatedReplacements.map(r => ({
              session_id: sessionId,
              original_word: r.original_word,
              replacement_word: r.replacement_word,
            }))
          )
          .select();

        if (error) throw error;
        return data;
      });

      const updatedReplacements = sortReplacements([...replacements, ...result]);
      setReplacements(updatedReplacements);
      
      toast({
        title: "Import Successful",
        description: `Imported ${result.length} glossary entries to database.`,
      });
    } catch (error) {
      handleError(error, 'handleImportReplacements');
    } finally {
      setIsSaving(false);
    }
  });

  // Pagination helpers
  const getVisiblePages = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    range.push(1);

    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }

    if (totalPages > 1) {
      range.push(totalPages);
    }

    const uniqueRange = [...new Set(range)].sort((a, b) => a - b);

    let prev = 0;
    for (const page of uniqueRange) {
      if (page - prev > 1) {
        rangeWithDots.push('...');
      }
      rangeWithDots.push(page);
      prev = page;
    }

    return rangeWithDots;
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allFilteredIds = new Set(filteredReplacements.map(r => r.id));
      setSelectedItems(allFilteredIds);
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  const isAllFilteredSelected = filteredReplacements.length > 0 && 
    filteredReplacements.every(r => selectedItems.has(r.id));
  const isSomeFilteredSelected = filteredReplacements.some(r => selectedItems.has(r.id));

  const canUseFeature = () => {
    if (!user) return false;
    if (userRole === 'super_user') return true;
    return userRole === 'user';
  };

  return (
    <ErrorBoundary fallback={
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle size={20} />
            Error Loading Word Replacements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Something went wrong while loading the word replacements component. Please try refreshing the page.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    }>
      <div className="space-y-8">
        <ErrorBoundary fallback={
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Failed to load CSV manager</AlertDescription>
          </Alert>
        }>
          <CSVManager 
            replacements={replacements}
            onImport={handleImportReplacements}
            userRole={userRole}
          />
        </ErrorBoundary>

        {/* Save/Load Glossary Section */}
        <Card className="glass-card shadow-elegant hover:shadow-glow transition-smooth">
          <CardHeader className="pb-6 bg-gradient-to-r from-accent/5 to-primary/5 rounded-t-lg">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="gradient-accent p-2 rounded-lg shadow-sm">
                <Database className="h-5 w-5 text-accent-foreground" />
              </div>
              Glossary Library
              {savedGlossaries.length > 0 && (
                <Badge variant="secondary" className="ml-2 bg-accent/10 text-accent border-accent/20 hover:bg-accent/20 transition-smooth">
                  {savedGlossaries.length} saved
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <Button
                onClick={saveGlossary}
                variant="outline"
                size="sm"
                disabled={isSaving || !canUseFeature() || replacements.length === 0}
                className="border-accent/30 text-accent hover:bg-accent/10 hover:border-accent/50 transition-smooth shadow-accent/20 hover:shadow-accent"
              >
                <Database className="mr-2 h-4 w-4" />
                Save Current Glossary
              </Button>
              
              {loadingSavedGlossaries ? (
                <div className="flex gap-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-9 w-24" />
                  ))}
                </div>
              ) : (
                (() => {
                  const mobileLimit = 3;
                  const visibleGlossaries = showAllGlossaries ? savedGlossaries : savedGlossaries.slice(0, mobileLimit);
                  const hasMore = savedGlossaries.length > mobileLimit;

                  return (
                    <>
                      {/* Mobile: limited list */}
                      <div className="sm:hidden w-full space-y-2">
                        {visibleGlossaries.map((glossary) => (
                          <div key={glossary.id} className="flex items-center gap-2 w-full bg-muted/30 border border-muted rounded-lg p-2 transition-smooth hover:bg-muted/50">
                            <span className="text-sm font-medium text-foreground truncate flex-1 min-w-0" title={glossary.name}>
                              {glossary.name}
                            </span>
                            <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-primary/10 text-primary border-primary/20 shrink-0">
                              {glossary.glossary_data?.length ?? 0}
                            </Badge>
                            <Button onClick={() => loadGlossary(glossary.glossary_data)} size="sm" variant="ghost" disabled={isSaving} className="min-h-[44px] min-w-[44px] p-0 text-primary hover:bg-primary/10 transition-smooth shrink-0">
                              <BookText className="h-4 w-4" />
                            </Button>
                            <Button onClick={() => deleteGlossary(glossary.id, glossary.name)} size="sm" variant="ghost" className="min-h-[44px] min-w-[44px] p-0 text-destructive hover:bg-destructive/10 transition-smooth shrink-0">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        {hasMore && !showAllGlossaries && (
                          <Button variant="ghost" size="sm" className="w-full text-primary" onClick={() => setShowAllGlossaries(true)}>
                            View All ({savedGlossaries.length})
                          </Button>
                        )}
                        {hasMore && showAllGlossaries && (
                          <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setShowAllGlossaries(false)}>
                            Show Less
                          </Button>
                        )}
                      </div>

                      {/* Desktop: full list */}
                      <div className="hidden sm:contents">
                        {savedGlossaries.map((glossary) => (
                          <div key={glossary.id} className="flex items-center gap-2 w-full bg-muted/30 border border-muted rounded-lg p-2 transition-smooth hover:bg-muted/50">
                            <span className="text-sm font-medium text-foreground truncate flex-1 min-w-0" title={glossary.name}>
                              {glossary.name}
                            </span>
                            <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-primary/10 text-primary border-primary/20 shrink-0">
                              {glossary.glossary_data?.length ?? 0}
                            </Badge>
                            <Button onClick={() => loadGlossary(glossary.glossary_data)} size="sm" variant="ghost" disabled={isSaving} className="h-6 w-6 min-h-0 min-w-0 p-0 text-primary hover:bg-primary/10 transition-smooth shrink-0">
                              <BookText className="h-3 w-3" />
                            </Button>
                            <Button onClick={() => deleteGlossary(glossary.id, glossary.name)} size="sm" variant="ghost" className="h-6 w-6 min-h-0 min-w-0 p-0 text-destructive hover:bg-destructive/10 transition-smooth shrink-0">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()
              )}
            </div>
            
            {savedGlossaries.length === 0 && !loadingSavedGlossaries && (
              <p className="text-sm text-muted-foreground italic">
                {canUseFeature() 
                  ? "No saved glossaries yet. Create and save your first glossary to reuse across sessions."
                  : "Please sign in to save and load glossaries."
                }
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card shadow-elegant hover:shadow-glow transition-smooth">
          <CardHeader className="pb-6 bg-gradient-to-r from-primary/5 to-accent/5 rounded-t-lg">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="gradient-primary p-2 rounded-lg shadow-sm">
                <BookText className="h-5 w-5 text-primary-foreground" />
              </div>
              Text Glossary
              {replacements.length > 0 && (
                <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-smooth">
                  {replacements.length} entries (sorted by length)
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 space-y-6">
            <div className="bg-muted/30 border border-muted rounded-lg p-3 sm:p-6 shadow-sm transition-smooth">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Add New Glossary Entry
                <Shield className="h-4 w-4 text-muted-foreground" />
              </h3>
              
              {/* Show validation errors */}
              {Object.keys(validationErrors).length > 0 && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {Object.values(validationErrors).join(', ')}
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="originalWord" className="text-sm font-semibold text-foreground">
                    Original Term
                  </Label>
                  <Input
                    id="originalWord"
                    placeholder="Term to replace"
                    value={newOriginal}
                    onChange={(e) => {
                      setNewOriginal(e.target.value);
                      if (validationErrors.original_word) {
                        setValidationErrors(prev => {
                          const { original_word, ...rest } = prev;
                          return rest;
                        });
                      }
                    }}
                    className={cn(
                      "border-border focus:border-primary focus:ring-primary transition-smooth hover:border-ring",
                      validationErrors.original_word && "border-destructive"
                    )}
                    maxLength={500}
                  />
                  {validationErrors.original_word && (
                    <p className="text-xs text-destructive">{validationErrors.original_word}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="replacementWord" className="text-sm font-semibold text-foreground">
                    Preferred Term
                  </Label>
                  <Input
                    id="replacementWord"
                    placeholder="Replace with"
                    value={newReplacement}
                    onChange={(e) => {
                      setNewReplacement(e.target.value);
                      if (validationErrors.replacement_word) {
                        setValidationErrors(prev => {
                          const { replacement_word, ...rest } = prev;
                          return rest;
                        });
                      }
                    }}
                    className={cn(
                      "border-border focus:border-primary focus:ring-primary transition-smooth hover:border-ring",
                      validationErrors.replacement_word && "border-destructive"
                    )}
                    maxLength={500}
                  />
                  {validationErrors.replacement_word && (
                    <p className="text-xs text-destructive">{validationErrors.replacement_word}</p>
                  )}
                </div>
                <div className="flex items-end md:items-end">
                  <Button
                    onClick={addReplacement}
                    disabled={isSaving || !newOriginal.trim() || !newReplacement.trim()}
                    size="lg"
                    className="w-full min-h-[44px] bg-primary hover:bg-primary/90 text-primary-foreground transition-smooth disabled:opacity-50 shadow-elegant hover:shadow-glow"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {isSaving ? 'Adding...' : 'Add Entry'}
                  </Button>
                </div>
              </div>
            </div>

            {replacements.length > 0 && (
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-muted/30 p-4 rounded-lg border border-border shadow-sm transition-smooth">
                <div className="relative flex-1 max-w-full sm:max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search glossary entries..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 border-border focus:border-primary focus:ring-primary bg-card hover:border-ring transition-smooth"
                  />
                </div>
                
                <div className="flex items-center gap-4">
                  {selectedItems.size > 0 && (
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="px-3 py-1 bg-card text-foreground border-border hover:bg-muted/50 transition-smooth">
                        {selectedItems.size}/{filteredReplacements.length} selected
                      </Badge>
                      <Button
                        onClick={removeSelectedReplacements}
                        disabled={isSaving}
                        variant="destructive"
                        size="sm"
                        className="transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Selected
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              </div>
            ) : filteredReplacements.length > 0 ? (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-foreground">
                      Glossary Entries ({filteredReplacements.length})
                    </h3>
                    {totalPages > 1 && (
                      <p className="text-sm text-muted-foreground">
                        Showing page {currentPage} of {totalPages}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Mobile: card layout */}
                <div className="sm:hidden space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Checkbox
                      checked={isAllFilteredSelected}
                      onCheckedChange={handleSelectAll}
                      className={cn(
                        "data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground",
                        isSomeFilteredSelected && !isAllFilteredSelected && "data-[state=indeterminate]"
                      )}
                    />
                    <span className="text-sm text-muted-foreground">Select all</span>
                    {selectedItems.size > 0 && (
                      <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-primary/10 text-primary border-primary/20">
                        {selectedItems.size}
                      </Badge>
                    )}
                  </div>
                  {(() => {
                    const mobileEntryLimit = 5;
                    const visibleEntries = showAllMobileEntries ? currentReplacements : currentReplacements.slice(0, mobileEntryLimit);
                    const hasMoreEntries = currentReplacements.length > mobileEntryLimit;

                    return (
                      <>
                        {visibleEntries.map((replacement) => (
                          <div key={replacement.id} className="border rounded-lg bg-card p-4 space-y-3 shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                              <Checkbox
                                checked={selectedItems.has(replacement.id)}
                                onCheckedChange={(checked) => handleSelectItem(replacement.id, checked as boolean)}
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0 space-y-2">
                                <div>
                                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Original</span>
                                  <code className="block mt-1 bg-destructive/10 text-destructive px-3 py-1.5 rounded-md text-sm font-mono border border-destructive/20 break-words">
                                    {replacement.original_word}
                                  </code>
                                </div>
                                <div>
                                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preferred</span>
                                  <code className="block mt-1 bg-muted/50 text-foreground px-3 py-1.5 rounded-md text-sm font-mono border border-border break-words">
                                    {replacement.replacement_word}
                                  </code>
                                </div>
                              </div>
                              <Button
                                onClick={() => removeReplacement(replacement.id)}
                                variant="ghost"
                                size="sm"
                                className="min-h-[44px] min-w-[44px] text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                              >
                                <Trash2 className="h-5 w-5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        {hasMoreEntries && !showAllMobileEntries && (
                          <Button variant="ghost" size="sm" className="w-full text-primary" onClick={() => setShowAllMobileEntries(true)}>
                            View All ({currentReplacements.length} entries)
                          </Button>
                        )}
                        {hasMoreEntries && showAllMobileEntries && (
                          <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setShowAllMobileEntries(false)}>
                            Show Less
                          </Button>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Desktop: table layout */}
                <div className="hidden sm:block border rounded-lg overflow-hidden bg-card shadow-elegant hover:shadow-glow transition-smooth">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="w-16 p-4">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={isAllFilteredSelected}
                                onCheckedChange={handleSelectAll}
                                className={cn(
                                  "data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground",
                                  isSomeFilteredSelected && !isAllFilteredSelected && "data-[state=indeterminate]"
                                )}
                              />
                              {selectedItems.size > 0 && (
                                <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-primary/10 text-primary border-primary/20">
                                  {selectedItems.size}
                                </Badge>
                              )}
                            </div>
                          </TableHead>
                          <TableHead className="min-w-[150px] font-semibold text-foreground">Original Term</TableHead>
                          <TableHead className="min-w-[150px] font-semibold text-foreground">Preferred Term</TableHead>
                          <TableHead className="w-24 text-center font-semibold text-foreground">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentReplacements.map((replacement) => (
                          <TableRow key={replacement.id} className="hover:bg-muted/30 transition-smooth">
                            <TableCell className="p-4">
                              <Checkbox
                                checked={selectedItems.has(replacement.id)}
                                onCheckedChange={(checked) => handleSelectItem(replacement.id, checked as boolean)}
                              />
                            </TableCell>
                            <TableCell className="font-medium break-words p-4">
                              <div className="flex items-center gap-2">
                                <code className="bg-destructive/10 text-destructive px-3 py-1 rounded-md text-sm font-mono border border-destructive/20">
                                  {replacement.original_word}
                                </code>
                                <Badge variant="outline" className="text-xs px-2 py-0.5 bg-muted text-muted-foreground">
                                  {replacement.original_word.length} chars
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="break-words p-4">
                              <code className="bg-muted/50 text-foreground px-3 py-1 rounded-md text-sm font-mono border border-border">
                                {replacement.replacement_word}
                              </code>
                            </TableCell>
                            <TableCell className="text-center p-4">
                              <Button
                                onClick={() => removeReplacement(replacement.id)}
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 transition-smooth"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                
                {totalPages > 1 && (
                  <div className="flex justify-center">
                    <Pagination>
                      <PaginationContent className="flex flex-wrap justify-center gap-1">
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                            className={cn(
                              "cursor-pointer text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2 transition-all duration-200 hover:shadow-sm",
                              currentPage === 1 && "pointer-events-none opacity-50"
                            )}
                          />
                        </PaginationItem>
                        
                        {getVisiblePages().map((page, index) => (
                          <PaginationItem key={index}>
                            {page === '...' ? (
                              <PaginationEllipsis className="h-8 w-8 sm:h-9 sm:w-9" />
                            ) : (
                              <PaginationLink
                                onClick={() => handlePageChange(page as number)}
                                isActive={currentPage === page}
                                className="cursor-pointer h-8 w-8 sm:h-9 sm:w-9 text-xs sm:text-sm p-0 flex items-center justify-center transition-all duration-200 hover:shadow-sm"
                              >
                                {page}
                              </PaginationLink>
                            )}
                          </PaginationItem>
                        ))}
                        
                        <PaginationItem>
                          <PaginationNext 
                            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                            className={cn(
                              "cursor-pointer text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2 transition-all duration-200 hover:shadow-sm",
                              currentPage === totalPages && "pointer-events-none opacity-50"
                            )}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </div>
            ) : replacements.length > 0 ? (
              <div className="text-center py-12 bg-muted/30 rounded-lg border-2 border-dashed border-border hover:border-ring transition-smooth">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No matches found</h3>
                <p className="text-muted-foreground">Try adjusting your search terms</p>
              </div>
            ) : (
              <div className="bg-muted/30 rounded-lg p-6 border border-border">
                <div className="text-center mb-6">
                  <div className="bg-primary/10 p-3 sm:p-4 rounded-full w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 flex items-center justify-center shadow-elegant">
                    <BookText className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">No glossary entries yet</h3>
                  <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                    Add glossary entries above or import from a CSV file below
                  </p>
                </div>
                
                <ErrorBoundary fallback={
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>Failed to load drag and drop uploader</AlertDescription>
                  </Alert>
                }>
                  <DragDropUpload 
                    onImport={handleImportReplacements}
                    canUseFeature={canUseFeature()}
                    user={user}
                  />
                </ErrorBoundary>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  );
};

export default WordReplacements;