import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Plus, Trash2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  const { toast } = useToast();
  const { userRole } = useAuth();

  // Calculate pagination
  const totalPages = Math.ceil(replacements.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentReplacements = replacements.slice(startIndex, endIndex);

  // Reset to first page when replacements change
  useEffect(() => {
    setCurrentPage(1);
  }, [replacements.length]);

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
        console.error('Error loading replacements:', error);
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

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

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
          <div className="grid md:grid-cols-3 gap-4">
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

          {/* Replacements table */}
          {replacements.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">
                  Word Replacements ({replacements.length})
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Original Word</TableHead>
                      <TableHead>Replacement Word</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentReplacements.map((replacement) => (
                      <TableRow key={replacement.id}>
                        <TableCell className="font-medium">{replacement.original_word}</TableCell>
                        <TableCell>{replacement.replacement_word}</TableCell>
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
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => handlePageChange(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
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
