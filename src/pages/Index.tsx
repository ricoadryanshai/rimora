import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, BookOpen, Scissors, RotateCcw, LogIn, Database, Sparkles } from "lucide-react";
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

    try {
      const cardsData = cardsToSave || separatedCards;
      
      const sessionData = {
        user_id: user.id,
        original_text: originalText,
        paragraph_count: paragraphCount,
        separated_cards: cardsData,
        updated_at: new Date().toISOString(),
      };

      let result;
      if (currentSessionId) {
        result = await supabase
          .from('chapter_sessions')
          .update(sessionData)
          .eq('id', currentSessionId)
          .eq('user_id', user.id)
          .select()
          .single();
      } else {
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
    }
  };

  const separateChapter = async () => {
    const textToProcess = originalText || dummyText;
    
    const processedText = applyWordReplacements(textToProcess, wordReplacements);
    
    const paragraphs = processedText.split('\n').filter(p => p.trim() !== '');
    
    const cards: string[] = [];
    for (let i = 0; i < paragraphs.length; i += paragraphCount) {
      const cardContent = paragraphs.slice(i, i + paragraphCount).join('\n\n');
      cards.push(cardContent);
    }
    
    setSeparatedCards(cards);
    
    if (user) {
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
        <div className="text-center space-y-4">
          <BookOpen className="h-16 w-16 text-blue-600 mx-auto animate-pulse" />
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-gray-700">Loading your workspace...</h3>
            <p className="text-gray-500">Please wait while we set things up</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-6 lg:py-8 max-w-7xl">
        {!user && (
          <Card className="mb-8 shadow-lg border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-indigo-50 hover:shadow-xl transition-shadow duration-300">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-100 p-3 rounded-full">
                    <LogIn className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-blue-900 font-semibold text-lg">Save Your Work Permanently</h3>
                    <p className="text-blue-700 text-sm leading-relaxed">
                      Create an account to save your separated chapters, word replacements, and continue working across sessions.
                    </p>
                  </div>
                </div>
                <Link to="/auth">
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="border-blue-300 text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-all duration-200 whitespace-nowrap shadow-sm hover:shadow-md"
                  >
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign In
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        <Header />

        {/* Main Header */}
        <div className="text-center mb-12 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="bg-gradient-to-br from-blue-100 to-blue-200 p-3 rounded-2xl shadow-lg">
                <BookOpen className="h-8 w-8 text-blue-600" />
              </div>
              <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                Novel Chapter Separator
              </h1>
            </div>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Transform long chapters into manageable sections with smart word replacement and organized card layouts.
            </p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-3">
            <Badge variant="secondary" className="px-4 py-2 text-sm bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 transition-colors">
              <Sparkles className="mr-2 h-4 w-4" />
              Smart Text Processing
            </Badge>
            <Badge variant="secondary" className="px-4 py-2 text-sm bg-green-50 text-green-700 border-green-200 hover:bg-green-100 transition-colors">
              <Database className="mr-2 h-4 w-4" />
              Auto-Save
            </Badge>
            <Badge variant="secondary" className="px-4 py-2 text-sm bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 transition-colors">
              <Copy className="mr-2 h-4 w-4" />
              One-Click Copy
            </Badge>
          </div>
        </div>

        {/* Input Section */}
        <Card className="mb-8 shadow-lg border-0 bg-white/95 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
          <CardHeader className="pb-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="bg-gradient-to-br from-blue-100 to-blue-200 p-2 rounded-lg shadow-sm">
                <Scissors className="h-5 w-5 text-blue-600" />
              </div>
              Chapter Input & Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-3">
                <Label htmlFor="paragraphCount" className="text-sm font-semibold text-gray-700">
                  Paragraphs per Card
                </Label>
                <Input
                  id="paragraphCount"
                  type="number"
                  min="1"
                  max="20"
                  value={paragraphCount}
                  onChange={(e) => setParagraphCount(Number(e.target.value))}
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200 text-center font-medium hover:border-gray-400"
                />
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={loadDummyData}
                  variant="outline"
                  size="lg"
                  className="w-full border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  Load Sample
                </Button>
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={resetAll}
                  variant="outline"
                  size="lg"
                  className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset All
                </Button>
              </div>
            </div>
            
            <div className="space-y-3">
              <Label htmlFor="originalText" className="text-sm font-semibold text-gray-700">
                Original Chapter Text
              </Label>
              <Textarea
                id="originalText"
                placeholder="Paste your chapter text here, or use the sample text button above to get started..."
                value={originalText}
                onChange={(e) => setOriginalText(e.target.value)}
                className="min-h-[200px] border-gray-300 focus:border-blue-500 focus:ring-blue-500 resize-none transition-all duration-200 text-gray-700 leading-relaxed hover:border-gray-400"
              />
            </div>
            
            <Button 
              onClick={separateChapter}
              size="lg"
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-4 text-lg font-semibold transition-all duration-200 transform hover:scale-[1.02] shadow-lg hover:shadow-xl"
              disabled={!originalText && !dummyText}
            >
              <Scissors className="mr-3 h-5 w-5" />
              Apply Replacements & Separate Chapter
            </Button>
          </CardContent>
        </Card>

        <div className="mb-8">
          <WordReplacements 
            sessionId={currentSessionId}
            onReplacementsChange={handleWordReplacementsChange}
          />
        </div>

        {separatedCards.length > 0 && (
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-4">
                Your Separated Chapter Cards
              </h2>
              <div className="flex flex-wrap justify-center items-center gap-3">
                <Badge variant="outline" className="px-4 py-2 text-base bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 transition-colors">
                  {separatedCards.length} cards created
                </Badge>
                <Badge variant="outline" className="px-4 py-2 text-base bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 transition-colors">
                  {paragraphCount} paragraphs per card
                </Badge>
                {user && currentSessionId && (
                  <Badge variant="outline" className="px-4 py-2 text-base bg-green-50 text-green-700 border-green-200 hover:bg-green-100 transition-colors">
                    <Database className="mr-2 h-3 w-3" />
                    Auto-saved
                  </Badge>
                )}
                {!user && (
                  <Badge variant="outline" className="px-4 py-2 text-base bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 transition-colors">
                    Not saved (sign in to save)
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {separatedCards.map((cardContent, index) => (
                <Card 
                  key={index} 
                  className="shadow-lg border-0 bg-white/95 backdrop-blur-sm hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] group"
                >
                  <CardHeader className="pb-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-t-lg">
                    <CardTitle className="flex items-center justify-between text-lg">
                      <div className="flex items-center gap-2">
                        <div className="bg-gradient-to-br from-blue-100 to-blue-200 p-2 rounded-lg group-hover:from-blue-200 group-hover:to-blue-300 transition-all duration-200 shadow-sm">
                          <BookOpen className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="text-gray-700 font-semibold">Card {index + 1}</span>
                      </div>
                      <Button
                        onClick={() => copyToClipboard(cardContent, index)}
                        size="sm"
                        variant="outline"
                        className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto border border-gray-200 hover:bg-gray-100 transition-colors duration-200">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                        {cardContent}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-center">
                      <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                        {cardContent.split('\n\n').length} paragraphs • {cardContent.length} characters
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {separatedCards.length === 0 && (
          <Card className="text-center py-16 bg-white/70 backdrop-blur-sm border-dashed border-2 border-gray-300 hover:border-blue-300 transition-all duration-200 hover:bg-white/80">
            <CardContent className="space-y-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-full w-24 h-24 mx-auto flex items-center justify-center shadow-lg">
                <BookOpen className="h-12 w-12 text-blue-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold text-gray-700">
                  Ready to Separate Your Chapter
                </h3>
                <p className="text-gray-500 max-w-md mx-auto leading-relaxed">
                  Input your chapter text above, configure your word replacements, and click "Separate Chapter" to get started.
                </p>
              </div>
              <div className="flex justify-center">
                <Button 
                  onClick={loadDummyData}
                  variant="outline"
                  size="lg"
                  className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  Try with Sample Text
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Index;
