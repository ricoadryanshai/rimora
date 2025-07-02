
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "@/components/ui/pagination";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Search, FileText, AlertCircle } from "lucide-react";
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

  // Updated select all functionality to work across all pages
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select ALL filtered items (across all pages)
      const allFilteredIds = new Set(filteredReplacements.map(r => r.id));
      setSelectedItems(allFilteredIds);
    } else {
      // Deselect all items
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

  // Updated logic for select all checkbox state
  const isAllFilteredSelected = filteredReplacements.length > 0 && 
    filteredReplacements.every(r => selectedItems.has(r.id));
  const isSomeFilteredSelected = filteredReplacements.some(r => selectedItems.has(r.id));

  return (
    <div className="space-y-8">
      {/* CSV Import/Export Section */}
      <CSVManager 
        replacements={replacements}
        onImport={handleImportReplacements}
        userRole={userRole}
      />

      {/* Main Word Replacements Form */}
      <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
        <CardHeader className="pb-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-t-lg">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="bg-green-100 p-2 rounded-lg">
              <FileText className="h-5 w-5 text-green-600" />
            </div>
            Find & Replace Words
            {replacements.length > 0 && (
              <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700">
                {replacements.length} active
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Add new replacement form */}
          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              Add New Word Replacement
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="originalWord" className="text-sm font-semibold text-gray-700">
                  Original Word
                </Label>
                <Input
                  id="originalWord"
                  placeholder="Word to replace"
                  value={newOriginal}
                  onChange={(e) => setNewOriginal(e.target.value)}
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors duration-200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="replacementWord" className="text-sm font-semibold text-gray-700">
                  Replacement Word
                </Label>
                <Input
                  id="replacementWord"
                  placeholder="Replace with"
                  value={newReplacement}
                  onChange={(e) => setNewReplacement(e.target.value)}
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors duration-200"
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={addReplacement}
                  disabled={isSaving || !newOriginal.trim() || !newReplacement.trim()}
                  size="lg"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-200 disabled:opacity-50"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Replacement
                </Button>
              </div>
            </div>
          </div>

          {/* Search and Bulk Actions */}
          {replacements.length > 0 && (
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search word replacements..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white"
                />
              </div>
              
              <div className="flex items-center gap-4">
                {selectedItems.size > 0 && (
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="px-3 py-1 bg-white text-blue-700 border-blue-300">
                      {selectedItems.size} selected
                    </Badge>
                    <Button
                      onClick={removeSelectedReplacements}
                      disabled={isSaving}
                      variant="destructive"
                      size="sm"
                      className="transition-colors duration-200"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Selected
                    </Button>
                  </div>
                )}
                
                {sessionId && (
                  <Button
                    onClick={saveReplacementsToDatabase}
                    disabled={isSaving}
                    variant="outline"
                    size="sm"
                    className="border-green-200 text-green-600 hover:bg-green-50 transition-colors duration-200"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {isSaving ? 'Saving...' : 'Save All'}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Replacements table */}
          {filteredReplacements.length > 0 && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Word Replacements ({filteredReplacements.length})
                  </h3>
                  {totalPages > 1 && (
                    <p className="text-sm text-gray-600">
                      Showing page {currentPage} of {totalPages}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-gray-50">
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
                              <Badge variant="secondary" className="text-xs px-2 py-0.5">
                                {selectedItems.size}/{filteredReplacements.length}
                              </Badge>
                            )}
                          </div>
                        </TableHead>
                        <TableHead className="min-w-[150px] font-semibold">Original Word</TableHead>
                        <TableHead className="min-w-[150px] font-semibold">Replacement Word</TableHead>
                        <TableHead className="w-24 text-center font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentReplacements.map((replacement, index) => (
                        <TableRow key={replacement.id} className="hover:bg-gray-50 transition-colors duration-150">
                          <TableCell className="p-4">
                            <Checkbox
                              checked={selectedItems.has(replacement.id)}
                              onCheckedChange={(checked) => handleSelectItem(replacement.id, checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="font-medium break-words p-4">
                            <code className="bg-red-50 text-red-700 px-2 py-1 rounded text-sm">
                              {replacement.original_word}
                            </code>
                          </TableCell>
                          <TableCell className="break-words p-4">
                            <code className="bg-green-50 text-green-700 px-2 py-1 rounded text-sm">
                              {replacement.replacement_word}
                            </code>
                          </TableCell>
                          <TableCell className="text-center p-4">
                            <Button
                              onClick={() => removeReplacement(replacement.id)}
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors duration-200"
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
                            "cursor-pointer text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2 transition-colors duration-200",
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
                              className="cursor-pointer h-8 w-8 sm:h-9 sm:w-9 text-xs sm:text-sm p-0 flex items-center justify-center transition-colors duration-200"
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
                            "cursor-pointer text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2 transition-colors duration-200",
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

          {/* No results found state */}
          {filteredReplacements.length === 0 && replacements.length > 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">No matches found</h3>
              <p className="text-gray-500">Try adjusting your search terms</p>
            </div>
          )}

          {/* Empty state */}
          {replacements.length === 0 && (
            <div className="text-center py-12 bg-gradient-to-br from-blue-50 to-green-50 rounded-lg border-2 border-dashed border-gray-300">
              <div className="bg-blue-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">No word replacements yet</h3>
              <p className="text-gray-500 mb-4 max-w-md mx-auto">
                Add word replacement pairs above to automatically replace specific words in your chapter text
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
                <AlertCircle className="h-4 w-4" />
                <span>Tip: Use this to replace character names, locations, or any recurring words</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WordReplacements;
