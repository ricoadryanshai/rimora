import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Copy, Check, BookOpen, Scissors, RotateCcw, LogIn, Database, Sparkles, Globe, Type, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Settings, Share2, WifiOff, ClipboardPaste } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import UrlImport from "@/components/UrlImport";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import WordReplacements from "@/components/WordReplacements";
import AppSidebar from "@/components/AppSidebar";
import MobileBottomNav from "@/components/MobileBottomNav";

const Index = () => {
  const [originalText, setOriginalText] = useState('');
  const [paragraphCount, setParagraphCount] = useState<number>(5);
  const [cardCount, setCardCount] = useState<number>(10);
  const [separationMode, setSeparationMode] = useState<'paragraph' | 'card'>('paragraph');
  const [separatedCards, setSeparatedCards] = useState<string[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [wordReplacements, setWordReplacements] = useState<any[]>([]);
  const [currentSection, setCurrentSection] = useState<string>('input-settings');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileCardIndex, setMobileCardIndex] = useState(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' && !navigator.onLine);
  const longPressTimer = useRef<number | null>(null);
  const pasteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [activeInputTab, setActiveInputTab] = useState<string>('paste');
  const pullStartY = useRef<number | null>(null);
  const [pullDelta, setPullDelta] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();

  const pasteFromClipboard = useCallback(async () => {
    try {
      if (!navigator.clipboard?.readText) {
        toast({ title: "Clipboard not available", description: "Your browser doesn't allow clipboard access. Please paste manually.", variant: "destructive" });
        return;
      }
      const text = await navigator.clipboard.readText();
      if (!text) {
        toast({ title: "Clipboard is empty", description: "Copy some text first, then tap to paste." });
        return;
      }
      setOriginalText((prev) => prev ? prev + text : text);
      if (navigator.vibrate) navigator.vibrate(10);
      toast({ title: "Pasted from clipboard", description: `${text.length.toLocaleString()} characters added.` });
      setTimeout(() => pasteTextareaRef.current?.focus(), 50);
    } catch (err) {
      toast({ title: "Couldn't read clipboard", description: "Permission denied. Long-press the text area and choose Paste instead.", variant: "destructive" });
    }
  }, [toast]);

  // Reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scrollBehavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

  // Web Share API availability
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  // Refs for smooth scrolling
  const inputSettingsRef = useRef<HTMLDivElement>(null);
  const glossaryRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Light haptic helper
  const vibrate = (ms = 10) => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(ms); } catch {}
    }
  };

  // Scroll-to-top listener
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Online/offline listener
  useEffect(() => {
    const on = () => setIsOffline(false);
    const off = () => setIsOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Persist last-viewed mobile card index
  useEffect(() => {
    const saved = sessionStorage.getItem('mobileCardIndex');
    if (saved !== null) {
      const idx = parseInt(saved, 10);
      if (!isNaN(idx)) setMobileCardIndex(idx);
    }
  }, []);
  useEffect(() => {
    sessionStorage.setItem('mobileCardIndex', String(mobileCardIndex));
  }, [mobileCardIndex]);

  // Clamp persisted card index if it exceeds current card count
  useEffect(() => {
    if (separatedCards.length > 0 && mobileCardIndex > separatedCards.length - 1) {
      setMobileCardIndex(separatedCards.length - 1);
    }
  }, [separatedCards.length, mobileCardIndex]);

  // Swipe handlers for mobile card navigator
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX;
    const threshold = 50;
    if (delta < -threshold && mobileCardIndex < separatedCards.length - 1) {
      setMobileCardIndex(prev => prev + 1);
      vibrate(10);
    } else if (delta > threshold && mobileCardIndex > 0) {
      setMobileCardIndex(prev => prev - 1);
      vibrate(10);
    }
    setTouchStartX(null);
  }, [touchStartX, mobileCardIndex, separatedCards.length]);

  // Long-press to copy current mobile card
  const handleLongPressStart = useCallback(() => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      const text = separatedCards[mobileCardIndex];
      if (text) {
        vibrate(20);
        copyToClipboard(text, mobileCardIndex);
      }
    }, 550);
  }, [mobileCardIndex, separatedCards]);
  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Share current card via Web Share API
  const shareCard = async (text: string, index: number) => {
    if (!canShare) return;
    try {
      await navigator.share({
        title: `Card ${index + 1}`,
        text,
      });
      vibrate(10);
    } catch {
      /* user cancelled or share failed */
    }
  };

  // Pull-to-refresh on results section (mobile)
  const handleResultsTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 0) {
      pullStartY.current = e.touches[0].clientY;
    }
  };
  const handleResultsTouchMove = (e: React.TouchEvent) => {
    if (pullStartY.current === null) return;
    const delta = e.touches[0].clientY - pullStartY.current;
    if (delta > 0) setPullDelta(Math.min(delta, 100));
  };
  const handleResultsTouchEnd = async () => {
    if (pullDelta > 70 && !isRefreshing) {
      setIsRefreshing(true);
      vibrate(15);
      await separateChapter();
      setIsRefreshing(false);
    }
    pullStartY.current = null;
    setPullDelta(0);
  };

  // Auto-focus textarea when Paste tab is selected on mobile
  useEffect(() => {
    if (isMobile && activeInputTab === 'paste') {
      const t = setTimeout(() => pasteTextareaRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [activeInputTab, isMobile]);

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
    setMobileCardIndex(0);
    
    // Auto-scroll to results after a brief delay
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: scrollBehavior, block: 'start' });
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
      setCopiedIndex(cardIndex);
      vibrate(10);
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
        behavior: scrollBehavior, 
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
            <div className="flex items-center px-4 py-2 sm:py-3">
              <SidebarTrigger className="mr-3 sm:mr-4" />
              <h2 className="font-semibold text-foreground text-sm sm:text-base">Novel Chapter Separator</h2>
            </div>
          </header>

          {/* Offline banner */}
          {isOffline && (
            <div className="sticky top-[44px] sm:top-[52px] z-10 bg-warning text-warning-foreground px-4 py-2 text-xs sm:text-sm flex items-center gap-2 justify-center border-b border-border">
              <WifiOff className="h-4 w-4" />
              You're offline — generated cards still work, but uploads and saving are paused.
            </div>
          )}


          {/* Mobile bottom tab navigation */}
          <MobileBottomNav currentSection={currentSection} onSectionClick={handleSectionClick} />

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

          <div className="container mx-auto px-4 py-4 sm:py-6 lg:py-8 max-w-7xl pb-40 sm:pb-0">
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
                    <Tabs value={activeInputTab} onValueChange={setActiveInputTab} className="w-full">
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
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor="originalText" className="text-sm font-semibold text-foreground">
                            Original Chapter Text
                          </Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={pasteFromClipboard}
                            className="h-8 px-2 text-xs gap-1.5"
                          >
                            <ClipboardPaste className="h-3.5 w-3.5" />
                            Paste from clipboard
                          </Button>
                        </div>
                        <div className="relative">
                          <Textarea
                            ref={pasteTextareaRef}
                            id="originalText"
                            placeholder="Paste your chapter text here, or tap the area below to paste from clipboard..."
                            value={originalText}
                            onChange={(e) => setOriginalText(e.target.value)}
                            className="min-h-[120px] sm:min-h-[200px] resize-none"
                          />
                          {!originalText && (
                            <button
                              type="button"
                              onClick={pasteFromClipboard}
                              aria-label="Tap to paste from clipboard"
                              className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-md bg-transparent text-muted-foreground hover:bg-muted/30 active:bg-muted/50 transition-colors sm:hidden"
                            >
                              <ClipboardPaste className="h-6 w-6" />
                              <span className="text-sm font-medium">Tap to paste from clipboard</span>
                            </button>
                          )}
                        </div>
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
            <div
              ref={resultsRef}
              className="mb-32 sm:mb-0"
              onTouchStart={isMobile && separatedCards.length > 0 ? handleResultsTouchStart : undefined}
              onTouchMove={isMobile && separatedCards.length > 0 ? handleResultsTouchMove : undefined}
              onTouchEnd={isMobile && separatedCards.length > 0 ? handleResultsTouchEnd : undefined}
            >
              {pullDelta > 0 && (
                <div
                  className="sm:hidden flex items-center justify-center text-xs text-muted-foreground overflow-hidden transition-[height] duration-100"
                  style={{ height: `${pullDelta}px` }}
                >
                  {isRefreshing ? 'Refreshing…' : pullDelta > 70 ? 'Release to re-separate' : 'Pull to re-separate'}
                </div>
              )}
              {separatedCards.length > 0 ? (
                <Card className="shadow-lg border-0 bg-card">
                  <CardHeader className="pb-6 bg-gradient-to-r from-primary/5 to-primary/10 rounded-t-lg">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <div className="bg-primary/10 p-2 rounded-lg shadow-sm">
                          <BookOpen className="h-5 w-5 text-primary" />
                        </div>
                        Separated Chapter Cards ({separatedCards.length})
                      </CardTitle>
                      <Button
                        onClick={copyAllCards}
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy All Cards
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6">
                    {/* Mobile: single card navigator */}
                    <div className="sm:hidden" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                      <Card className="border-border bg-card min-h-[200px] max-h-[60vh] flex flex-col overflow-hidden">
                        <CardHeader className="pb-3 flex-shrink-0 sticky top-0 z-10 bg-card border-b border-border/50">
                          <div className="flex items-center justify-between gap-2">
                            <CardTitle className="text-lg font-semibold text-card-foreground flex items-center gap-2 min-w-0">
                              <div className="bg-primary/10 p-1.5 rounded-md shadow-sm shrink-0">
                                <BookOpen className="h-4 w-4 text-primary" />
                              </div>
                              <span className="truncate">Card {mobileCardIndex + 1}</span>
                            </CardTitle>
                            <div className="flex items-center gap-1 shrink-0">
                              {canShare && (
                                <Button
                                  onClick={() => shareCard(separatedCards[mobileCardIndex] ?? '', mobileCardIndex)}
                                  variant="outline"
                                  size="sm"
                                  aria-label="Share card"
                                >
                                  <Share2 className="h-3 w-3" />
                                </Button>
                              )}
                              <Button
                                onClick={() => copyToClipboard(separatedCards[mobileCardIndex] ?? '', mobileCardIndex)}
                                variant="outline"
                                size="sm"
                              >
                                {copiedIndex === mobileCardIndex ? (
                                  <Check className="mr-1 h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="mr-1 h-3 w-3" />
                                )}
                                {copiedIndex === mobileCardIndex ? 'Copied' : 'Copy'}
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3 flex-1 flex flex-col min-h-0 pt-3">
                          <div
                            className="text-card-foreground leading-relaxed text-sm whitespace-pre-wrap break-words bg-muted/50 p-4 rounded-lg border border-border/50 flex-1 overflow-auto min-h-0 select-text"
                            onTouchStart={handleLongPressStart}
                            onTouchEnd={handleLongPressEnd}
                            onTouchMove={handleLongPressEnd}
                            onTouchCancel={handleLongPressEnd}
                          >
                            {separatedCards[mobileCardIndex] ?? ''}
                          </div>
                          <div className="flex gap-4 text-xs text-muted-foreground flex-shrink-0">
                            <div className="flex items-center gap-1">
                              <span className="font-medium">Paragraphs:</span>
                              <Badge variant="secondary" className="text-xs">
                                {(separatedCards[mobileCardIndex] ?? '').split('\n\n').filter(p => p.trim()).length}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="font-medium">Characters:</span>
                              <Badge variant="secondary" className="text-xs">
                                {(separatedCards[mobileCardIndex] ?? '').length}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <div className="flex items-center justify-between mt-4">
                        <Button
                          onClick={() => setMobileCardIndex(Math.max(0, mobileCardIndex - 1))}
                          variant="outline"
                          size="sm"
                          disabled={mobileCardIndex === 0}
                          className="min-h-[44px] min-w-[44px]"
                        >
                          <ChevronLeft className="h-5 w-5" />
                          Prev
                        </Button>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
                          {separatedCards.length <= 10 ? (
                            <div className="flex items-center gap-1.5" role="tablist" aria-label="Card pages">
                              {separatedCards.map((_, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  role="tab"
                                  aria-selected={i === mobileCardIndex}
                                  aria-label={`Go to card ${i + 1}`}
                                  onClick={() => { setMobileCardIndex(i); vibrate(5); }}
                                  className={`h-2.5 rounded-full transition-all ${
                                    i === mobileCardIndex
                                      ? 'w-6 bg-primary'
                                      : 'w-2.5 bg-muted-foreground/30 hover:bg-muted-foreground/60'
                                  }`}
                                />
                              ))}
                            </div>
                          ) : (
                            <>
                              <Input
                                type="number"
                                min={1}
                                max={separatedCards.length}
                                value={mobileCardIndex + 1}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  if (val >= 1 && val <= separatedCards.length) {
                                    setMobileCardIndex(val - 1);
                                  }
                                }}
                                className="w-12 h-8 text-center p-0 text-sm"
                              />
                              <span>/ {separatedCards.length}</span>
                            </>
                          )}
                        </div>
                        <Button
                          onClick={() => setMobileCardIndex(Math.min(separatedCards.length - 1, mobileCardIndex + 1))}
                          variant="outline"
                          size="sm"
                          disabled={mobileCardIndex === separatedCards.length - 1}
                          className="min-h-[44px] min-w-[44px]"
                        >
                          Next
                          <ChevronRight className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>

                    {/* Desktop: grid */}
                    <div className="hidden sm:grid gap-4 grid-cols-1 sm:gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {separatedCards.map((card, index) => (
                         <Card key={index} className="group hover:shadow-lg transition-all duration-300 border-border hover:border-primary/50 bg-card h-80 flex flex-col">
                           <CardHeader className="pb-3 flex-shrink-0">
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
                           <CardContent className="space-y-4 flex-1 flex flex-col min-h-0">
                             <div className="text-card-foreground leading-relaxed text-sm whitespace-pre-wrap break-words bg-muted/50 p-4 rounded-lg border border-border/50 flex-1 overflow-auto min-h-0">
                               {card}
                             </div>
                            <div className="flex gap-4 text-xs text-muted-foreground flex-shrink-0">
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
              className="fixed bottom-36 right-4 z-30 sm:hidden bg-primary text-primary-foreground p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
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