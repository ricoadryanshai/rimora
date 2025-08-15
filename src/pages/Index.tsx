import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, BookOpen, Scissors, RotateCcw, LogIn, Database, Sparkles } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import WordReplacements from "@/components/WordReplacements";
import AppSidebar from "@/components/AppSidebar";

const Index = () => {
  const [originalText, setOriginalText] = useState('');
  const [paragraphCount, setParagraphCount] = useState<number>(5);
  const [cardCount, setCardCount] = useState<number>(10);
  const [separationMode, setSeparationMode] = useState<'paragraph' | 'card'>('paragraph');
  const [separatedCards, setSeparatedCards] = useState<string[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [wordReplacements, setWordReplacements] = useState<any[]>([]);
  const [currentSection, setCurrentSection] = useState<string>('input-settings');
  const { toast } = useToast();
  const { user, loading } = useAuth();

  // Refs for smooth scrolling
  const inputSettingsRef = useRef<HTMLDivElement>(null);
  const glossaryRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

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
        setCardCount(data.card_count || data.paragraph_count || 10);
        setSeparationMode((data.separation_mode as 'paragraph' | 'card') || 'paragraph');
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
      processedText = processedText.replace(regex, replacement_word + ' ');
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
        card_count: cardCount,
        separation_mode: separationMode,
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
    
    let cards: string[] = [];
    
    if (separationMode === 'paragraph') {
      for (let i = 0; i < paragraphs.length; i += paragraphCount) {
        const cardContent = paragraphs.slice(i, i + paragraphCount).join('\n\n');
        cards.push(cardContent);
      }
    } else {
      // Separate by number of cards
      const paragraphsPerCard = Math.ceil(paragraphs.length / cardCount);
      for (let i = 0; i < cardCount; i++) {
        const startIndex = i * paragraphsPerCard;
        const endIndex = Math.min(startIndex + paragraphsPerCard, paragraphs.length);
        if (startIndex < paragraphs.length) {
          const cardContent = paragraphs.slice(startIndex, endIndex).join('\n\n');
          cards.push(cardContent);
        }
      }
    }
    
    setSeparatedCards(cards);
    
    if (user) {
      await saveToDatabase(cards);
    }

    const replacementCount = wordReplacements.length;
    const modeDesc = separationMode === 'paragraph' 
      ? `${paragraphCount} paragraphs each` 
      : `divided into ${cardCount} cards`;
    
    toast({
      title: "Chapter Separated Successfully!",
      description: `Created ${cards.length} cards with ${modeDesc}.${replacementCount > 0 ? ` Applied ${replacementCount} glossary entries.` : ''}${!user ? ' Sign in to save your work!' : ''}`,
    });
  };

  const resetAll = async () => {
    setOriginalText('');
    setParagraphCount(5);
    setCardCount(10);
    setSeparationMode('paragraph');
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

  const handleSectionClick = (sectionId: string) => {
    setCurrentSection(sectionId);
    const refs = {
      'input-settings': inputSettingsRef,
      'glossary': glossaryRef,
      'results': resultsRef,
    };
    
    const targetRef = refs[sectionId as keyof typeof refs];
    if (targetRef?.current) {
      targetRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <BookOpen className="h-16 w-16 text-primary mx-auto animate-pulse" />
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-foreground">Loading your workspace...</h3>
            <p className="text-muted-foreground">Please wait while we set things up</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar 
          onSectionClick={handleSectionClick}
          currentSection={currentSection}
        />
        
        <main className="flex-1 overflow-auto relative">
          {/* Header with sidebar trigger */}
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
            <div className="flex items-center px-4 py-3">
              <SidebarTrigger className="mr-4" />
              <h2 className="font-semibold text-foreground">Novel Chapter Separator</h2>
            </div>
          </header>

          {/* Mobile floating sidebar trigger */}
          <div className="fixed bottom-6 left-6 z-50 md:hidden">
            <SidebarTrigger className="bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 rounded-full p-3 border-2 border-primary-foreground/20" />
          </div>

          <div className="container mx-auto px-4 py-6 lg:py-8 max-w-7xl">
            {!user && (
              <Card className="mb-8 shadow-lg border-l-4 border-l-primary bg-gradient-to-r from-primary/5 to-primary/10 hover:shadow-xl transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="bg-primary/10 p-3 rounded-full">
                        <LogIn className="h-6 w-6 text-primary" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-primary font-semibold text-lg">Save Your Work Permanently</h3>
                        <p className="text-primary/80 text-sm leading-relaxed">
                          Create an account to save your separated chapters, word replacements, and continue working across sessions.
                        </p>
                      </div>
                    </div>
                    <Link to="/auth">
                      <Button 
                        variant="outline" 
                        size="lg" 
                        className="transition-all duration-200 whitespace-nowrap shadow-sm hover:shadow-md"
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
                  <div className="bg-primary/10 p-3 rounded-2xl shadow-lg">
                    <BookOpen className="h-8 w-8 text-primary" />
                  </div>
                  <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Novel Chapter Separator
                  </h1>
                </div>
                <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                  Transform long chapters into manageable sections with smart word replacement and organized card layouts.
                </p>
              </div>
              
              <div className="flex flex-wrap justify-center gap-3">
                <Badge variant="secondary" className="px-4 py-2 text-sm">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Smart Text Processing
                </Badge>
                <Badge variant="secondary" className="px-4 py-2 text-sm">
                  <Database className="mr-2 h-4 w-4" />
                  Auto-Save
                </Badge>
                <Badge variant="secondary" className="px-4 py-2 text-sm">
                  <Copy className="mr-2 h-4 w-4" />
                  One-Click Copy
                </Badge>
              </div>
            </div>

            {/* Input Section */}
            <div ref={inputSettingsRef}>
              <Card className="mb-8 shadow-lg border-0 bg-card hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-6 bg-gradient-to-r from-primary/5 to-primary/10 rounded-t-lg">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="bg-primary/10 p-2 rounded-lg shadow-sm">
                      <Scissors className="h-5 w-5 text-primary" />
                    </div>
                    Chapter Input & Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold text-foreground">
                        Separation Mode
                      </Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={separationMode === 'paragraph' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSeparationMode('paragraph')}
                          className="flex-1 text-xs"
                        >
                          By Paragraphs
                        </Button>
                        <Button
                          type="button"
                          variant={separationMode === 'card' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSeparationMode('card')}
                          className="flex-1 text-xs"
                        >
                          By Cards
                        </Button>
                      </div>
                    </div>
                    
                    {separationMode === 'paragraph' ? (
                      <div className="space-y-3">
                        <Label htmlFor="paragraphCount" className="text-sm font-semibold text-foreground">
                          Paragraphs per Card
                        </Label>
                        <Input
                          id="paragraphCount"
                          type="number"
                          min="1"
                          max="20"
                          value={paragraphCount}
                          onChange={(e) => setParagraphCount(Number(e.target.value))}
                          className="text-center font-medium"
                        />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Label htmlFor="cardCount" className="text-sm font-semibold text-foreground">
                          Number of Cards
                        </Label>
                        <Input
                          id="cardCount"
                          type="number"
                          min="1"
                          max="50"
                          value={cardCount}
                          onChange={(e) => setCardCount(Number(e.target.value))}
                          className="text-center font-medium"
                        />
                      </div>
                    )}
                    <div className="flex items-end">
                      <Button 
                        onClick={loadDummyData}
                        variant="outline"
                        size="lg"
                        className="w-full"
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
                        className="w-full"
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reset All
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <Label htmlFor="originalText" className="text-sm font-semibold text-foreground">
                      Original Chapter Text
                    </Label>
                    <Textarea
                      id="originalText"
                      placeholder="Paste your chapter text here, or use the sample text button above to get started..."
                      value={originalText}
                      onChange={(e) => setOriginalText(e.target.value)}
                      className="min-h-[200px] resize-none"
                    />
                  </div>
                  
                  <Button 
                    onClick={separateChapter}
                    size="lg"
                    className="w-full py-4 text-lg font-semibold"
                    disabled={!originalText && !dummyText}
                  >
                    <Scissors className="mr-3 h-5 w-5" />
                    Apply Glossary & Separate Chapter
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div ref={glossaryRef} className="mb-8">
              <WordReplacements 
                sessionId={currentSessionId}
                onReplacementsChange={handleWordReplacementsChange}
              />
            </div>

            {/* Results Section */}
            <div ref={resultsRef}>
              {separatedCards.length > 0 ? (
                <Card className="shadow-lg border-0 bg-card">
                  <CardHeader className="pb-6 bg-gradient-to-r from-primary/5 to-primary/10 rounded-t-lg">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <div className="bg-primary/10 p-2 rounded-lg shadow-sm">
                        <BookOpen className="h-5 w-5 text-primary" />
                      </div>
                      Separated Chapter Cards ({separatedCards.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                      {separatedCards.map((card, index) => (
                        <Card key={index} className="group hover:shadow-lg transition-all duration-300 border-border hover:border-primary/50 bg-card">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                                <div className="bg-primary/10 p-1.5 rounded-md shadow-sm">
                                  <BookOpen className="h-4 w-4 text-primary" />
                                </div>
                                Card {index + 1}
                              </CardTitle>
                              <Button
                                onClick={() => copyToClipboard(card, index)}
                                variant="outline"
                                size="sm"
                                className="group-hover:border-primary/50 group-hover:text-primary transition-all duration-200 shadow-sm hover:shadow-md"
                              >
                                <Copy className="mr-1 h-3 w-3" />
                                Copy
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="text-card-foreground leading-relaxed text-sm whitespace-pre-wrap break-words bg-muted/50 p-4 rounded-lg border border-border/50">
                              {card}
                            </div>
                            <div className="flex gap-4 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Paragraphs:</span>
                                <Badge variant="secondary" className="text-xs">
                                  {card.split('\n\n').filter(p => p.trim()).length}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Characters:</span>
                                <Badge variant="secondary" className="text-xs">
                                  {card.length}
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="shadow-lg border-0 bg-card border-dashed border-border">
                  <CardContent className="p-12 text-center space-y-6">
                    <div className="bg-muted p-6 rounded-full w-24 h-24 mx-auto flex items-center justify-center shadow-lg">
                      <BookOpen className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-xl font-semibold text-card-foreground">No Cards Generated Yet</h3>
                      <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                        Enter your chapter text above and click "Separate Chapter" to start breaking it down into manageable cards.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Index;