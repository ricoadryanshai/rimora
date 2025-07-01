import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, BookOpen, Scissors, RotateCcw, LogIn, Save, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import WordReplacements from "@/components/WordReplacements";

const Index = () => {
  const [originalText, setOriginalText] = useState('');
  const [paragraphCount, setParagraphCount] = useState<number>(5);
  const [separatedCards, setSeparatedCards] = useState<string[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [wordReplacements, setWordReplacements] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { user, loading } = useAuth();

  // Dummy data for demonstration
  const dummyText = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.

Totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt.

Explicabo nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.

Sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.

Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.

Totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt.

Explicabo nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.`;

  // Load user's last session when authenticated
  useEffect(() => {
    if (user) {
      loadLastSession();
    }
  }, [user]);

  const loadLastSession = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('chapter_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        return;
      }

      if (data) {
        setOriginalText(data.original_text);
        setParagraphCount(data.paragraph_count);
        // Fix: Properly handle the Json type conversion to string[]
        const cards = Array.isArray(data.separated_cards) ? data.separated_cards as string[] : [];
        setSeparatedCards(cards);
        setCurrentSessionId(data.id);
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  const applyWordReplacements = (text: string, replacements: any[]) => {
    let processedText = text;
    
    replacements.forEach(({ original_word, replacement_word }) => {
      // Use global case-insensitive replace
      const regex = new RegExp(original_word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      processedText = processedText.replace(regex, replacement_word);
    });
    
    return processedText;
  };

  const saveToDatabase = async (cardsToSave?: string[]) => {
    if (!user) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to save your work to the database.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Use the passed cards or the current state
      const cardsData = cardsToSave || separatedCards;
      
      const sessionData = {
        user_id: user.id,
        original_text: originalText,
        paragraph_count: paragraphCount,
        separated_cards: cardsData, // Use the correct cards data
        updated_at: new Date().toISOString(),
      };

      let result;
      if (currentSessionId) {
        // Update existing session
        result = await supabase
          .from('chapter_sessions')
          .update(sessionData)
          .eq('id', currentSessionId)
          .eq('user_id', user.id)
          .select()
          .single();
      } else {
        // Create new session
        result = await supabase
          .from('chapter_sessions')
          .insert(sessionData)
          .select()
          .single();
      }

      if (result.error) {
        throw result.error;
      }

      if (result.data && !currentSessionId) {
        setCurrentSessionId(result.data.id);
      }

      toast({
        title: "Saved Successfully!",
        description: "Your chapter session has been saved to the database.",
      });
    } catch (error) {
      console.error('Error saving to database:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save your session. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const separateChapter = async () => {
    const textToProcess = originalText || dummyText;
    
    // Apply word replacements before separating into paragraphs
    const processedText = applyWordReplacements(textToProcess, wordReplacements);
    
    const paragraphs = processedText.split('\n').filter(p => p.trim() !== '');
    
    const cards: string[] = [];
    for (let i = 0; i < paragraphs.length; i += paragraphCount) {
      const cardContent = paragraphs.slice(i, i + paragraphCount).join('\n\n');
      cards.push(cardContent);
    }
    
    setSeparatedCards(cards);
    
    // Auto-save for authenticated users - pass the cards directly
    if (user) {
      // Save immediately with the new cards data
      await saveToDatabase(cards);
    }

    const replacementCount = wordReplacements.length;
    toast({
      title: "Chapter Separated Successfully!",
      description: `Created ${cards.length} cards with ${paragraphCount} paragraphs each.${replacementCount > 0 ? ` Applied ${replacementCount} word replacements.` : ''}${!user ? ' Sign in to save your work!' : ''}`,
    });
  };

  const resetAll = async () => {
    setOriginalText('');
    setParagraphCount(5);
    setSeparatedCards([]);
    setCurrentSessionId(null);
    
    toast({
      title: "Reset Complete",
      description: "All data has been cleared and reset to initial state.",
    });
  };

  const copyToClipboard = async (text: string, cardIndex: number) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to Clipboard!",
        description: `Card ${cardIndex + 1} content copied successfully.`,
      });
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy text to clipboard.",
        variant: "destructive",
      });
    }
  };

  const loadDummyData = () => {
    setOriginalText(dummyText);
    toast({
      title: "Dummy Data Loaded",
      description: "Sample chapter text has been loaded for testing.",
    });
  };

  const handleWordReplacementsChange = (replacements: any[]) => {
    setWordReplacements(replacements);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Authentication prompt for non-authenticated users */}
        {!user && (
          <Card className="mb-8 shadow-lg border-0 bg-blue-50/80 backdrop-blur-sm border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <LogIn className="h-5 w-5 text-blue-600" />
                  <div>
                    <span className="text-blue-800 font-medium">Sign in to save your work permanently</span>
                    <p className="text-blue-600 text-sm">Your separated chapters will only be temporary without an account</p>
                  </div>
                </div>
                <Link to="/auth">
                  <Button variant="outline" size="sm" className="border-blue-300 text-blue-700 hover:bg-blue-100">
                    Sign In
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Header for authenticated users */}
        <Header />

        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <BookOpen className="h-8 w-8 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-800">Novel Chapter Separator</h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Transform long chapters into manageable sections. Input your text and specify how many paragraphs per card.
          </p>
        </div>

        {/* Input Section */}
        <Card className="mb-8 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-6">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Scissors className="h-5 w-5 text-blue-600" />
              Chapter Input & Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label htmlFor="paragraphCount" className="text-sm font-medium">
                  Paragraphs per Card
                </Label>
                <Input
                  id="paragraphCount"
                  type="number"
                  min="1"
                  max="20"
                  value={paragraphCount}
                  onChange={(e) => setParagraphCount(Number(e.target.value))}
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={loadDummyData}
                  variant="outline"
                  className="w-full border-blue-200 text-blue-600 hover:bg-blue-50"
                >
                  Load Sample Text
                </Button>
              </div>
              {user && (
                <div className="flex items-end">
                  <Button 
                    onClick={() => saveToDatabase()}
                    disabled={isSaving}
                    variant="outline"
                    className="w-full border-green-200 text-green-600 hover:bg-green-50"
                  >
                    <Database className="mr-2 h-4 w-4" />
                    {isSaving ? 'Saving...' : 'Save to DB'}
                  </Button>
                </div>
              )}
              <div className="flex items-end">
                <Button 
                  onClick={resetAll}
                  variant="outline"
                  className="w-full border-red-200 text-red-600 hover:bg-red-50"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset All
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="originalText" className="text-sm font-medium">
                Original Chapter Text
              </Label>
              <Textarea
                id="originalText"
                placeholder="Paste your chapter text here, or use the sample text button above..."
                value={originalText}
                onChange={(e) => setOriginalText(e.target.value)}
                className="min-h-[200px] border-gray-300 focus:border-blue-500 focus:ring-blue-500 resize-none"
              />
            </div>
            
            <Button 
              onClick={separateChapter}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 text-lg font-medium transition-all duration-200 transform hover:scale-[1.02]"
              disabled={!originalText && !dummyText}
            >
              <Scissors className="mr-2 h-5 w-5" />
              Apply Replacements & Separate Chapter
            </Button>
          </CardContent>
        </Card>

        {/* Word Replacements Section */}
        <div className="mb-8">
          <WordReplacements 
            sessionId={currentSessionId}
            onReplacementsChange={handleWordReplacementsChange}
          />
        </div>

        {/* Results Section */}
        {separatedCards.length > 0 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Separated Chapter Cards
              </h2>
              <p className="text-gray-600">
                {separatedCards.length} cards created • {paragraphCount} paragraphs per card
                {user && currentSessionId && (
                  <span className="text-green-600 ml-2">• Saved to database</span>
                )}
                {!user && (
                  <span className="text-orange-600 ml-2">• Not saved (sign in to save)</span>
                )}
              </p>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {separatedCards.map((cardContent, index) => (
                <Card 
                  key={index} 
                  className="shadow-lg border-0 bg-white/90 backdrop-blur-sm hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
                >
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center justify-between text-lg">
                      <span className="text-gray-700">Card {index + 1}</span>
                      <Button
                        onClick={() => copyToClipboard(cardContent, index)}
                        size="sm"
                        variant="outline"
                        className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300"
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                        {cardContent}
                      </p>
                    </div>
                    <div className="mt-3 text-xs text-gray-500 text-center">
                      {cardContent.split('\n\n').length} paragraphs
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {separatedCards.length === 0 && (
          <Card className="text-center py-12 bg-white/50 backdrop-blur-sm border-dashed border-2 border-gray-300">
            <CardContent>
              <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-700 mb-2">
                Ready to Separate Your Chapter
              </h3>
              <p className="text-gray-500">
                Input your chapter text above and click "Separate Chapter" to get started.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Index;
