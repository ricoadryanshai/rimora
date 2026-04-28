import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Copy, BookOpen, Scissors, RotateCcw, LogIn, Database, Sparkles, Globe, Type, ChevronDown, ChevronUp, Settings, Save } from "lucide-react";
import UrlImport from "@/components/UrlImport";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import WordReplacements from "@/components/WordReplacements";
import AppSidebar from "@/components/AppSidebar";
import EditableChapterCards from "@/components/EditableChapterCards";
import SessionHistory from "@/components/SessionHistory";
import {
  ChapterSession,
  getLatestChapterSession,
  getSessionTitle,
  normalizeCards,
  saveChapterSession,
  SeparationMode,
} from "@/lib/sessions";

interface WordReplacement {
  id: string;
  original_word: string;
  replacement_word: string;
}

const Index = () => {
  const [originalText, setOriginalText] = useState('');
  const [paragraphCount, setParagraphCount] = useState<number>(5);
  const [cardCount, setCardCount] = useState<number>(10);
  const [separationMode, setSeparationMode] = useState<'paragraph' | 'card'>('paragraph');
  const [separatedCards, setSeparatedCards] = useState<string[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState('');
  const [wordReplacements, setWordReplacements] = useState<WordReplacement[]>([]);
  const [currentSection, setCurrentSection] = useState<string>('input-settings');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileCardIndex, setMobileCardIndex] = useState(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [sessionRefreshKey, setSessionRefreshKey] = useState(0);
  const { toast } = useToast();
  const { user, loading } = useAuth();

  // Refs for smooth scrolling
  const inputSettingsRef = useRef<HTMLDivElement>(null);
  const glossaryRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const skipDirtyTrackingRef = useRef(true);

  // Scroll-to-top listener
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    } else {
      setCurrentSessionId(null);
      setSessionTitle('');
      setLastSavedAt(null);
      setHasUnsavedChanges(false);
    }
  }, [user]);

  useEffect(() => {
    if (skipDirtyTrackingRef.current) {
      skipDirtyTrackingRef.current = false;
      return;
    }
    setHasUnsavedChanges(true);
  }, [originalText, paragraphCount, cardCount, separationMode, separatedCards, sessionTitle]);

  const applySession = (session: ChapterSession) => {
    skipDirtyTrackingRef.current = true;
    setOriginalText(session.original_text);
    setParagraphCount(session.paragraph_count);
    setCardCount(session.card_count || session.paragraph_count || 10);
    setSeparationMode((session.separation_mode as SeparationMode) || 'paragraph');
    setSeparatedCards(normalizeCards(session.separated_cards));
    setCurrentSessionId(session.id);
    setSessionTitle(getSessionTitle(session));
    setLastSavedAt(session.updated_at);
    setMobileCardIndex(0);
    setHasUnsavedChanges(false);
  };

  const loadLastSession = async () => {
    if (!user) return;

    try {
      const session = await getLatestChapterSession(user.id);
      if (session) {
        applySession(session);
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  const applyWordReplacements = (text: string, replacements: WordReplacement[]) => {
    let processedText = text;
    
    replacements.forEach(({ original_word, replacement_word }) => {
      const regex = new RegExp(original_word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      processedText = processedText.replace(regex, replacement_word + ' ');
    });
    
    return processedText;
  };

  const saveToDatabase = async (cardsToSave?: string[], options?: { silent?: boolean; forceNew?: boolean }) => {
    if (!user) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to save your work to the database.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingSession(true);
    try {
      const cardsData = cardsToSave || separatedCards;
      const savedSession = await saveChapterSession(options?.forceNew ? null : currentSessionId, {
        title: sessionTitle,
        user_id: user.id,
        original_text: originalText,
        paragraph_count: paragraphCount,
        card_count: cardCount,
        separation_mode: separationMode,
        separated_cards: cardsData,
      });

      skipDirtyTrackingRef.current = true;
      setCurrentSessionId(savedSession.id);
      setSessionTitle(getSessionTitle(savedSession));
      setLastSavedAt(savedSession.updated_at);
      setHasUnsavedChanges(false);
      setSessionRefreshKey((key) => key + 1);

      if (!options?.silent) {
        toast({
          title: "Saved Successfully!",
          description: options?.forceNew ? "A new session copy has been saved." : "Your chapter session has been saved.",
        });
      }
    } catch (error) {
      console.error('Error saving to database:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save your session. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingSession(false);
    }
  };

  const separateChapter = async () => {
    const textToProcess = originalText || dummyText;
    
    const processedText = applyWordReplacements(textToProcess, wordReplacements);
    
    const paragraphs = processedText.split('\n').filter(p => p.trim() !== '');
    
    const cards: string[] = [];
    
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
    setMobileCardIndex(0);
    
    // Auto-scroll to results after a brief delay
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    
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
    skipDirtyTrackingRef.current = true;
    setOriginalText('');
    setParagraphCount(5);
    setCardCount(10);
    setSeparationMode('paragraph');
    setSeparatedCards([]);
    setCurrentSessionId(null);
    setSessionTitle('');
    setLastSavedAt(null);
    setHasUnsavedChanges(false);
    setMobileCardIndex(0);
    
    toast({
      title: "Reset Complete",
      description: "All data has been cleared and reset to initial state.",
    });
  };

  const copyToClipboard = async (text: string, cardIndex: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(cardIndex);
      setTimeout(() => setCopiedIndex(null), 1500);
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

  const copyAllCards = async () => {
    try {
      const allText = separatedCards.map((card, i) => `--- Card ${i + 1} ---\n${card}`).join('\n\n');
      await navigator.clipboard.writeText(allText);
      toast({
        title: "All Cards Copied!",
        description: `${separatedCards.length} cards copied to clipboard.`,
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

  const handleWordReplacementsChange = (replacements: WordReplacement[]) => {
    setWordReplacements(replacements);
  };

  const handleCardsChange = useCallback((cards: string[]) => {
    setSeparatedCards(cards);
    setHasUnsavedChanges(true);
  }, []);

  const handleOpenSession = (session: ChapterSession) => {
    applySession(session);
    toast({
      title: "Session Loaded",
      description: `"${getSessionTitle(session)}" is open for editing.`,
    });
  };

  const handleDeletedCurrentSession = () => {
    resetAll();
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
            <div className="flex flex-wrap items-center gap-2 px-4 py-2 sm:flex-nowrap sm:py-3">
              <SidebarTrigger className="mr-1 sm:mr-2" />
              <h2 className="min-w-0 flex-1 truncate font-semibold text-foreground text-sm sm:text-base">
                Novel Chapter Separator
              </h2>
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <SessionHistory
                  userId={user?.id || null}
                  currentSessionId={currentSessionId}
                  refreshKey={sessionRefreshKey}
                  onOpenSession={handleOpenSession}
                  onDeletedCurrent={handleDeletedCurrentSession}
                />
                <Button
                  onClick={() => saveToDatabase()}
                  disabled={!user || isSavingSession}
                  size="sm"
                  className="min-h-[44px] flex-1 sm:flex-none"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSavingSession ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </header>


          {/* Sticky mobile CTA */}
          <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-background/95 backdrop-blur-sm border-t border-border p-3 pb-[env(safe-area-inset-bottom,12px)]">
            <Button 
              onClick={separateChapter}
              size="lg"
              className="w-full py-3 text-base font-semibold"
              disabled={!originalText && !dummyText}
            >
              <Scissors className="mr-2 h-5 w-5" />
              Separate Chapter
            </Button>
          </div>

          <div className="container mx-auto px-4 py-4 sm:py-6 lg:py-8 max-w-7xl pb-20 sm:pb-0">
            {!user && (
              <Card className="mb-6 sm:mb-8 shadow-lg border-l-4 border-l-primary bg-gradient-to-r from-primary/5 to-primary/10 hover:shadow-xl transition-shadow duration-300">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="bg-primary/10 p-2 sm:p-3 rounded-full">
                        <LogIn className="h-6 w-6 text-primary" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-primary font-semibold text-lg">Save Your Work Permanently</h3>
                        <p className="hidden sm:block text-primary/80 text-sm leading-relaxed">
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

            <Card className="mb-6 border-border bg-card shadow-sm">
              <CardContent className="p-4">
                <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="sessionTitle" className="text-sm font-semibold text-foreground">
                      Session Title
                    </Label>
                    <Input
                      id="sessionTitle"
                      value={sessionTitle}
                      onChange={(event) => setSessionTitle(event.target.value.slice(0, 100))}
                      placeholder="Name this chapter session"
                      maxLength={100}
                    />
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={hasUnsavedChanges ? "secondary" : "outline"}>
                        {hasUnsavedChanges ? "Unsaved changes" : "Saved"}
                      </Badge>
                      {lastSavedAt && <span>Last saved {new Date(lastSavedAt).toLocaleString()}</span>}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-[44px] w-full sm:w-auto"
                      disabled={!user || isSavingSession}
                      onClick={() => saveToDatabase(undefined, { forceNew: true })}
                    >
                      Save as New
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Main Header */}
            <div className="text-center mb-6 sm:mb-12 space-y-4 sm:space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="bg-primary/10 p-3 rounded-2xl shadow-lg">
                    <BookOpen className="h-8 w-8 text-primary" />
                  </div>
                  <h1 className="text-xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Novel Chapter Separator
                  </h1>
                </div>
                <p className="hidden sm:block text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                  Transform long chapters into manageable sections with smart word replacement and organized card layouts.
                </p>
              </div>
              
              <div className="hidden sm:flex flex-wrap justify-center gap-3">
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
                <CardContent className="p-4 sm:p-6 space-y-6">
                  <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full flex items-center justify-between sm:hidden mb-2">
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          <Settings className="h-4 w-4" />
                          Settings
                        </span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                    
                    {/* Desktop: always visible */}
                    <div className="hidden sm:grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-3 sm:col-span-2 lg:col-span-1">
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
                          <span className="hidden sm:inline">Load Sample</span>
                          <span className="sm:hidden">Sample</span>
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
                          <span className="hidden sm:inline">Reset All</span>
                          <span className="sm:hidden">Reset</span>
                        </Button>
                      </div>
                    </div>

                    {/* Mobile: collapsible */}
                    <CollapsibleContent className="sm:hidden">
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="space-y-2 col-span-2">
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
                          <div className="space-y-2">
                            <Label htmlFor="paragraphCountMobile" className="text-sm font-semibold text-foreground">
                              Paragraphs/Card
                            </Label>
                            <Input
                              id="paragraphCountMobile"
                              type="number"
                              min="1"
                              max="20"
                              value={paragraphCount}
                              onChange={(e) => setParagraphCount(Number(e.target.value))}
                              className="text-center font-medium"
                            />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label htmlFor="cardCountMobile" className="text-sm font-semibold text-foreground">
                              Num Cards
                            </Label>
                            <Input
                              id="cardCountMobile"
                              type="number"
                              min="1"
                              max="50"
                              value={cardCount}
                              onChange={(e) => setCardCount(Number(e.target.value))}
                              className="text-center font-medium"
                            />
                          </div>
                        )}
                        <Button onClick={loadDummyData} variant="outline" size="sm" className="w-full">
                          <BookOpen className="mr-2 h-4 w-4" />
                          Sample
                        </Button>
                        <Button onClick={resetAll} variant="outline" size="sm" className="w-full col-span-2">
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Reset All
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  
                  <div className="space-y-3">
                    <Tabs defaultValue="paste" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="paste" className="flex items-center gap-2">
                          <Type className="h-4 w-4" />
                          Paste Text
                        </TabsTrigger>
                        <TabsTrigger value="url" className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          Import from URL
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="paste" className="mt-4 space-y-3">
                        <Label htmlFor="originalText" className="text-sm font-semibold text-foreground">
                          Original Chapter Text
                        </Label>
                        <Textarea
                          id="originalText"
                          placeholder="Paste your chapter text here, or use the sample text button above to get started..."
                          value={originalText}
                          onChange={(e) => setOriginalText(e.target.value)}
                          className="min-h-[120px] sm:min-h-[200px] resize-none"
                        />
                      </TabsContent>
                      <TabsContent value="url" className="mt-4">
                        <UrlImport onContentReady={(content) => setOriginalText(content)} />
                      </TabsContent>
                    </Tabs>
                   </div>
                   
                   {/* Desktop CTA */}
                   <Button 
                     onClick={separateChapter}
                     size="lg"
                     className="hidden sm:flex w-full py-3 sm:py-4 text-base sm:text-lg font-semibold"
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
            <div ref={resultsRef} className="mb-20 sm:mb-0">
              {separatedCards.length > 0 ? (
                <EditableChapterCards
                  cards={separatedCards}
                  mobileCardIndex={mobileCardIndex}
                  copiedIndex={copiedIndex}
                  onCardsChange={handleCardsChange}
                  onMobileCardIndexChange={setMobileCardIndex}
                  onCopyCard={copyToClipboard}
                  onCopyAll={copyAllCards}
                />
              ) : (
                <Card className="shadow-lg border-0 bg-card border-dashed border-border">
                  <CardContent className="p-6 sm:p-12 text-center space-y-6">
                    <div className="bg-muted p-4 sm:p-6 rounded-full w-16 h-16 sm:w-24 sm:h-24 mx-auto flex items-center justify-center shadow-lg">
                      <BookOpen className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground" />
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-xl font-semibold text-card-foreground">No Cards Generated Yet</h3>
                      <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                        <span className="hidden sm:inline">Enter your chapter text above and click "Separate Chapter" to start breaking it down into manageable cards.</span>
                        <span className="sm:hidden">Tap <strong>Separate Chapter</strong> below to get started.</span>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Scroll-to-top button (mobile only) */}
          {showScrollTop && (
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="fixed bottom-20 right-4 z-30 sm:hidden bg-primary text-primary-foreground p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Scroll to top"
            >
              <ChevronUp className="h-5 w-5" />
            </button>
          )}
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Index;
