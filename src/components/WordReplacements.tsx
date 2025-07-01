import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "@/components/ui/pagination";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Save, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import CSVManager from "./CSVManager";

interface WordReplacement {
  id: string;
  original_word: string;
  replacement_word: string;
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
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { userRole } = useAuth();

  // Filter replacements based on search term
  const filteredReplacements = replacements.filter(replacement =>
    replacement.original_word.toLowerCase().includes(searchTerm.toLowerCase()) ||
    replacement.replacement_word.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate pagination
  const totalPages = Math.ceil(filteredReplacements.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentReplacements = filteredReplacements.slice(startIndex, endIndex);

  // Reset to first page when replacements change or search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [replacements.length, searchTerm]);

  // Clear selected items when search term changes
  useEffect(() => {
    setSelectedItems(new Set());
  }, [searchTerm]);

  // Load existing replacements when sessionId changes
  useEffect(() => {
    if (sessionId) {
      loadReplacements();
    } else {
      setReplacements([]);
    }
  }, [sessionId]);

  // Notify parent component when replacements change
  useEffect(() => {
    onReplacementsChange(replacements);
  }, [replacements, onReplacementsChange]);

  const loadReplacements = async () => {
    if (!sessionId) return;

    try {
      const { data, error } = await supabase
        .from('word_replacements')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) {
        return;
      }

      setReplacements(data || []);
    } catch (error) {
      console.error('Error loading replacements:', error);
    }
  };

  const addReplacement = async () => {
    if (!newOriginal.trim() || !newReplacement.trim()) {
      toast({
        title: "Invalid Input",
        description: "Both original and replacement words are required.",
        variant: "destructive",
      });
      return;
    }

    if (!sessionId) {
      // Add to local state only if no session
      const newRepl: WordReplacement = {
        id: Date.now().toString(),
        original_word: newOriginal.trim(),
        replacement_word: newReplacement.trim(),
      };
      setReplacements([...replacements, newRepl]);
      setNewOriginal('');
      setNewReplacement('');
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('word_replacements')
        .insert({
          session_id: sessionId,
          original_word: newOriginal.trim(),
          replacement_word: newReplacement.trim(),
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      setReplacements([...replacements, data]);
      setNewOriginal('');
      setNewReplacement('');

      toast({
        title: "Word Replacement Added",
        description: `"${newOriginal}" will be replaced with "${newReplacement}"`,
      });
    } catch (error) {
      console.error('Error adding replacement:', error);
      toast({
        title: "Error",
        description: "Failed to add word replacement.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const removeReplacement = async (id: string) => {
    if (!sessionId) {
      // Remove from local state only if no session
      setReplacements(replacements.filter(r => r.id !== id));
      return;
    }

    try {
      const { error } = await supabase
        .from('word_replacements')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      setReplacements(replacements.filter(r => r.id !== id));

      toast({
        title: "Word Replacement Removed",
        description: "The word replacement has been deleted.",
      });
    } catch (error) {
      console.error('Error removing replacement:', error);
      toast({
        title: "Error",
        description: "Failed to remove word replacement.",
        variant: "destructive",
      });
    }
  };

  const removeSelectedReplacements = async () => {
    if (selectedItems.size === 0) return;

    if (!sessionId) {
      // Remove from local state only if no session
      setReplacements(replacements.filter(r => !selectedItems.has(r.id)));
      setSelectedItems(new Set());
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('word_replacements')
        .delete()
        .in('id', Array.from(selectedItems));

      if (error) {
        throw error;
      }

      setReplacements(replacements.filter(r => !selectedItems.has(r.id)));
      setSelectedItems(new Set());

      toast({
        title: "Word Replacements Removed",
        description: `${selectedItems.size} word replacements have been deleted.`,
      });
    } catch (error) {
      console.error('Error removing replacements:', error);
      toast({
        title: "Error",
        description: "Failed to remove selected word replacements.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveReplacementsToDatabase = async () => {
    if (!sessionId || replacements.length === 0) return;

    setIsSaving(true);
    try {
      // First, delete existing replacements for this session
      await supabase
        .from('word_replacements')
        .delete()
        .eq('session_id', sessionId);

      // Then insert all current replacements
      const { error } = await supabase
        .from('word_replacements')
        .insert(
          replacements.map(r => ({
            session_id: sessionId,
            original_word: r.original_word,
            replacement_word: r.replacement_word,
          }))
        );

      if (error) {
        throw error;
      }

      toast({
        title: "Replacements Saved",
        description: "All word replacements have been saved to the database.",
      });
    } catch (error) {
      console.error('Error saving replacements:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save word replacements.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleImportReplacements = async (importedReplacements: Omit<WordReplacement, 'id'>[]) => {
    if (!sessionId) {
      // Add to local state only if no session
      const newReplacements = importedReplacements.map(r => ({
        ...r,
        id: Date.now().toString() + Math.random().toString(),
      }));
      setReplacements([...replacements, ...newReplacements]);
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('word_replacements')
        .insert(
          importedReplacements.map(r => ({
            session_id: sessionId,
            original_word: r.original_word,
            replacement_word: r.replacement_word,
          }))
        )
        .select();

      if (error) {
        throw error;
      }

      setReplacements([...replacements, ...data]);
    } catch (error) {
      console.error('Error importing replacements:', error);
      toast({
        title: "Import Failed",
        description: "Failed to import word replacements to database.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Helper function to get visible page numbers for responsive pagination
  const getVisiblePages = () => {
    const delta = 2; // Number of pages to show on each side of current page
    const range = [];
    const rangeWithDots = [];

    // Always show first page
    range.push(1);

    // Add pages around current page
    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }

    // Always show last page if more than 1 page
    if (totalPages > 1) {
      range.push(totalPages);
    }

    // Remove duplicates and sort
    const uniqueRange = [...new Set(range)].sort((a, b) => a - b);

    // Add ellipsis where needed
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
      const currentIds = new Set(currentReplacements.map(r => r.id));
      setSelectedItems(prev => new Set([...prev, ...currentIds]));
    } else {
      const currentIds = new Set(currentReplacements.map(r => r.id));
      setSelectedItems(prev => new Set([...prev].filter(id => !currentIds.has(id))));
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

  const isAllCurrentSelected = currentReplacements.length > 0 && 
    currentReplacements.every(r => selectedItems.has(r.id));
  const isSomeCurrentSelected = currentReplacements.some(r => selectedItems.has(r.id));

  return (
    <div className="space-y-6">
      {/* CSV Import/Export Section */}
      <CSVManager 
        replacements={replacements}
        onImport={handleImportReplacements}
        userRole={userRole}
      />

      {/* Existing Word Replacements Form */}
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Plus className="h-5 w-5 text-blue-600" />
            Find & Replace Words
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new replacement form */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="originalWord" className="text-sm font-medium">
                Original Word
              </Label>
              <Input
                id="originalWord"
                placeholder="Word to replace"
                value={newOriginal}
                onChange={(e) => setNewOriginal(e.target.value)}
                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="replacementWord" className="text-sm font-medium">
                Replacement Word
              </Label>
              <Input
                id="replacementWord"
                placeholder="Replace with"
                value={newReplacement}
                onChange={(e) => setNewReplacement(e.target.value)}
                className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={addReplacement}
                disabled={isSaving}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>
          </div>

          {/* Search and Bulk Actions */}
          {replacements.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search word replacements..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              
              {selectedItems.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {selectedItems.size} selected
                  </span>
                  <Button
                    onClick={removeSelectedReplacements}
                    disabled={isSaving}
                    variant="destructive"
                    size="sm"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Selected
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Replacements table */}
          {filteredReplacements.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-lg font-medium">
                  Word Replacements ({filteredReplacements.length})
                  {totalPages > 1 && (
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      Page {currentPage} of {totalPages}
                    </span>
                  )}
                </h3>
                {sessionId && (
                  <Button
                    onClick={saveReplacementsToDatabase}
                    disabled={isSaving}
                    variant="outline"
                    size="sm"
                    className="border-green-200 text-green-600 hover:bg-green-50"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {isSaving ? 'Saving...' : 'Save All'}
                  </Button>
                )}
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={isAllCurrentSelected}
                            onCheckedChange={handleSelectAll}
                            className="data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground"
                            {...(isSomeCurrentSelected && !isAllCurrentSelected ? { 'data-state': 'indeterminate' } : {})}
                          />
                        </TableHead>
                        <TableHead className="min-w-[120px]">Original Word</TableHead>
                        <TableHead className="min-w-[120px]">Replacement Word</TableHead>
                        <TableHead className="w-20">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentReplacements.map((replacement) => (
                        <TableRow key={replacement.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedItems.has(replacement.id)}
                              onCheckedChange={(checked) => handleSelectItem(replacement.id, checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="font-medium break-words">{replacement.original_word}</TableCell>
                          <TableCell className="break-words">{replacement.replacement_word}</TableCell>
                          <TableCell>
                            <Button
                              onClick={() => removeReplacement(replacement.id)}
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
              
              {/* Responsive Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center">
                  <Pagination>
                    <PaginationContent className="flex flex-wrap justify-center gap-1">
                      {/* Previous Button */}
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                          className={cn(
                            "cursor-pointer text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2",
                            currentPage === 1 && "pointer-events-none opacity-50"
                          )}
                        />
                      </PaginationItem>
                      
                      {/* Page Numbers - Responsive Logic */}
                      {getVisiblePages().map((page, index) => (
                        <PaginationItem key={index}>
                          {page === '...' ? (
                            <PaginationEllipsis className="h-8 w-8 sm:h-9 sm:w-9" />
                          ) : (
                            <PaginationLink
                              onClick={() => handlePageChange(page as number)}
                              isActive={currentPage === page}
                              className="cursor-pointer h-8 w-8 sm:h-9 sm:w-9 text-xs sm:text-sm p-0 flex items-center justify-center"
                            >
                              {page}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}
                      
                      {/* Next Button */}
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                          className={cn(
                            "cursor-pointer text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2",
                            currentPage === totalPages && "pointer-events-none opacity-50"
                          )}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          )}

          {filteredReplacements.length === 0 && replacements.length > 0 && (
            <div className="text-center py-8 text-gray-500">
              <Search className="h-12 w-12 text-gray-300 mx-auto mb-2" />
              <p>No word replacements found</p>
              <p className="text-sm">Try adjusting your search terms</p>
            </div>
          )}

          {replacements.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Plus className="h-12 w-12 text-gray-300 mx-auto mb-2" />
              <p>No word replacements added yet</p>
              <p className="text-sm">Add words above to replace them in your chapter</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WordReplacements;
