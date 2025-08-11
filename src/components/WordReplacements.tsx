import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "@/components/ui/pagination";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Search, BookText, AlertCircle, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import CSVManager from "./CSVManager";
import DragDropUpload from "./DragDropUpload";

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
  const [savedGlossaries, setSavedGlossaries] = useState<Array<{name: string, data: WordReplacement[]}>>([]);
  const { toast } = useToast();
  const { userRole, user } = useAuth();

  // Sort replacements by character count (descending) and then alphabetically
  const sortReplacements = (replacements: WordReplacement[]) => {
    return [...replacements].sort((a, b) => {
      const lengthDiff = b.original_word.length - a.original_word.length;
      if (lengthDiff !== 0) return lengthDiff;
      return a.original_word.localeCompare(b.original_word);
    });
  };

  const filteredReplacements = replacements.filter(replacement =>
    replacement.original_word.toLowerCase().includes(searchTerm.toLowerCase()) ||
    replacement.replacement_word.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredReplacements.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentReplacements = filteredReplacements.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [replacements.length, searchTerm]);

  useEffect(() => {
    setSelectedItems(new Set());
  }, [searchTerm]);

  useEffect(() => {
    if (sessionId) {
      loadReplacements();
    } else {
      setReplacements([]);
    }
  }, [sessionId]);

  useEffect(() => {
    onReplacementsChange(replacements);
  }, [replacements, onReplacementsChange]);

  useEffect(() => {
    loadSavedGlossaries();
  }, []);

  const loadSavedGlossaries = () => {
    try {
      const saved = localStorage.getItem('savedGlossaries');
      if (saved) {
        setSavedGlossaries(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading saved glossaries:', error);
    }
  };

  const saveGlossary = () => {
    if (replacements.length === 0) {
      toast({
        title: "No Glossary to Save",
        description: "Add some glossary entries before saving.",
        variant: "destructive",
      });
      return;
    }

    const name = prompt("Enter a name for this glossary:");
    if (!name || !name.trim()) return;

    const newGlossary = {
      name: name.trim(),
      data: replacements
    };

    const updatedGlossaries = [...savedGlossaries, newGlossary];
    setSavedGlossaries(updatedGlossaries);
    localStorage.setItem('savedGlossaries', JSON.stringify(updatedGlossaries));

    toast({
      title: "Glossary Saved",
      description: `"${name}" has been saved with ${replacements.length} entries.`,
    });
  };

  const loadGlossary = (glossaryData: WordReplacement[]) => {
    const sortedData = sortReplacements(glossaryData);
    setReplacements(sortedData);
    
    toast({
      title: "Glossary Loaded",
      description: `Loaded ${glossaryData.length} glossary entries.`,
    });
  };

  const deleteGlossary = (index: number) => {
    const glossaryName = savedGlossaries[index].name;
    const updatedGlossaries = savedGlossaries.filter((_, i) => i !== index);
    setSavedGlossaries(updatedGlossaries);
    localStorage.setItem('savedGlossaries', JSON.stringify(updatedGlossaries));
    
    toast({
      title: "Glossary Deleted",
      description: `"${glossaryName}" has been deleted.`,
    });
  };

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

      // Sort the loaded replacements
      const sortedData = sortReplacements(data || []);
      setReplacements(sortedData);
    } catch (error) {
      console.error('Error loading replacements:', error);
    }
  };

  const addReplacement = async () => {
    if (!newOriginal.trim() || !newReplacement.trim()) {
      toast({
        title: "Invalid Input",
        description: "Both original and preferred terms are required.",
        variant: "destructive",
      });
      return;
    }

    if (!sessionId) {
      const newRepl: WordReplacement = {
        id: Date.now().toString(),
        original_word: newOriginal.trim(),
        replacement_word: newReplacement.trim(),
      };
      const updatedReplacements = sortReplacements([...replacements, newRepl]);
      setReplacements(updatedReplacements);
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

      const updatedReplacements = sortReplacements([...replacements, data]);
      setReplacements(updatedReplacements);
      setNewOriginal('');
      setNewReplacement('');

      toast({
        title: "Glossary Entry Added",
        description: `"${newOriginal}" will be replaced with "${newReplacement}"`,
      });
    } catch (error) {
      console.error('Error adding replacement:', error);
      toast({
        title: "Error",
        description: "Failed to add glossary entry.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const removeReplacement = async (id: string) => {
    if (!sessionId) {
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
        title: "Glossary Entry Removed",
        description: "The glossary entry has been deleted.",
      });
    } catch (error) {
      console.error('Error removing replacement:', error);
      toast({
        title: "Error",
        description: "Failed to remove glossary entry.",
        variant: "destructive",
      });
    }
  };

  const removeSelectedReplacements = async () => {
    if (selectedItems.size === 0) return;

    if (!sessionId) {
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
        title: "Glossary Entries Removed",
        description: `${selectedItems.size} glossary entries have been deleted.`,
      });
    } catch (error) {
      console.error('Error removing replacements:', error);
      toast({
        title: "Error",
        description: "Failed to remove selected glossary entries.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleImportReplacements = async (importedReplacements: Omit<WordReplacement, 'id'>[]) => {
    if (!sessionId) {
      const newReplacements = importedReplacements.map(r => ({
        ...r,
        id: Date.now().toString() + Math.random().toString(),
      }));
      const updatedReplacements = sortReplacements([...replacements, ...newReplacements]);
      setReplacements(updatedReplacements);
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

      const updatedReplacements = sortReplacements([...replacements, ...data]);
      setReplacements(updatedReplacements);
    } catch (error) {
      console.error('Error importing replacements:', error);
      toast({
        title: "Import Failed",
        description: "Failed to import glossary entries to database.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

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
    <div className="space-y-8">
      <CSVManager 
        replacements={replacements}
        onImport={handleImportReplacements}
        userRole={userRole}
      />

      {/* Save/Load Glossary Section */}
      <Card className="shadow-lg border-0 bg-white/95 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
        <CardHeader className="pb-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-lg">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="bg-gradient-to-br from-green-100 to-green-200 p-2 rounded-lg shadow-sm">
              <Database className="h-5 w-5 text-green-600" />
            </div>
            Glossary Library
            {savedGlossaries.length > 0 && (
              <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700 hover:bg-green-200 transition-colors">
                {savedGlossaries.length} saved
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Button
              onClick={saveGlossary}
              variant="outline"
              size="sm"
              className="border-green-200 text-green-600 hover:bg-green-50 hover:border-green-300 transition-all duration-200"
            >
              <Database className="mr-2 h-4 w-4" />
              Save Current Glossary
            </Button>
            
            {savedGlossaries.map((glossary, index) => (
              <div key={index} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 border">
                <span className="text-sm font-medium text-gray-700">{glossary.name}</span>
                <Badge variant="secondary" className="text-xs px-2 py-0.5">
                  {glossary.data.length}
                </Badge>
                <Button
                  onClick={() => loadGlossary(glossary.data)}
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-blue-600 hover:bg-blue-50"
                >
                  <BookText className="h-3 w-3" />
                </Button>
                <Button
                  onClick={() => deleteGlossary(index)}
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
          
          {savedGlossaries.length === 0 && (
            <p className="text-sm text-gray-500 italic">
              No saved glossaries yet. Create and save your first glossary to reuse across sessions.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg border-0 bg-white/95 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
        <CardHeader className="pb-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-t-lg">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="bg-gradient-to-br from-green-100 to-green-200 p-2 rounded-lg shadow-sm">
              <BookText className="h-5 w-5 text-green-600" />
            </div>
            Text Glossary
            {replacements.length > 0 && (
              <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors">
                {replacements.length} entries (sorted by length)
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-lg p-6 border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              Add New Glossary Entry
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="originalWord" className="text-sm font-semibold text-gray-700">
                  Original Term
                </Label>
                <Input
                  id="originalWord"
                  placeholder="Term to replace"
                  value={newOriginal}
                  onChange={(e) => setNewOriginal(e.target.value)}
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200 hover:border-gray-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="replacementWord" className="text-sm font-semibold text-gray-700">
                  Preferred Term
                </Label>
                <Input
                  id="replacementWord"
                  placeholder="Replace with"
                  value={newReplacement}
                  onChange={(e) => setNewReplacement(e.target.value)}
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200 hover:border-gray-400"
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={addReplacement}
                  disabled={isSaving || !newOriginal.trim() || !newReplacement.trim()}
                  size="lg"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 disabled:opacity-50 shadow-sm hover:shadow-md"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Entry
                </Button>
              </div>
            </div>
          </div>

          {replacements.length > 0 && (
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200 shadow-sm">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search glossary entries..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white hover:border-gray-400 transition-all duration-200"
                />
              </div>
              
              <div className="flex items-center gap-4">
                {selectedItems.size > 0 && (
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="px-3 py-1 bg-white text-blue-700 border-blue-300 hover:bg-blue-50 transition-colors">
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

          {filteredReplacements.length > 0 && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Glossary Entries ({filteredReplacements.length})
                  </h3>
                  {totalPages > 1 && (
                    <p className="text-sm text-gray-600">
                      Showing page {currentPage} of {totalPages}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="border rounded-lg overflow-hidden bg-white shadow-lg hover:shadow-xl transition-shadow duration-300">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-gradient-to-r from-gray-50 to-blue-50">
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
                              <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700">
                                {selectedItems.size}
                              </Badge>
                            )}
                          </div>
                        </TableHead>
                        <TableHead className="min-w-[150px] font-semibold text-gray-700">Original Term</TableHead>
                        <TableHead className="min-w-[150px] font-semibold text-gray-700">Preferred Term</TableHead>
                        <TableHead className="w-24 text-center font-semibold text-gray-700">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentReplacements.map((replacement, index) => (
                        <TableRow key={replacement.id} className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 transition-all duration-200">
                          <TableCell className="p-4">
                            <Checkbox
                              checked={selectedItems.has(replacement.id)}
                              onCheckedChange={(checked) => handleSelectItem(replacement.id, checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="font-medium break-words p-4">
                            <div className="flex items-center gap-2">
                              <code className="bg-red-50 text-red-700 px-3 py-1 rounded-md text-sm font-mono border border-red-200">
                                {replacement.original_word}
                              </code>
                              <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600">
                                {replacement.original_word.length} chars
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="break-words p-4">
                            <code className="bg-green-50 text-green-700 px-3 py-1 rounded-md text-sm font-mono border border-green-200">
                              {replacement.replacement_word}
                            </code>
                          </TableCell>
                          <TableCell className="text-center p-4">
                            <Button
                              onClick={() => removeReplacement(replacement.id)}
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-200 shadow-sm hover:shadow-md"
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
          )}

          {filteredReplacements.length === 0 && replacements.length > 0 && (
            <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-blue-50 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-300 transition-colors duration-200">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">No matches found</h3>
              <p className="text-gray-500">Try adjusting your search terms</p>
            </div>
          )}

          {replacements.length === 0 && (
            <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-lg p-6">
              <div className="text-center mb-6">
                <div className="bg-gradient-to-br from-blue-100 to-blue-200 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center shadow-lg">
                  <BookText className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">No glossary entries yet</h3>
                <p className="text-gray-500 mb-4 max-w-md mx-auto">
                  Add glossary entries above or import from a CSV file below
                </p>
              </div>
              
              <DragDropUpload 
                onImport={handleImportReplacements}
                canUseFeature={canUseFeature()}
                user={user}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WordReplacements;
