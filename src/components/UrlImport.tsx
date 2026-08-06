import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Globe, Loader2, Check, X, ArrowRight, ClipboardPaste } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOnline } from "@/hooks/use-online";
import { supabase } from "@/integrations/supabase/client";

interface UrlImportProps {
  onContentReady: (content: string) => void;
}

const UrlImport: React.FC<UrlImportProps> = ({ onContentReady }) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [extractedContent, setExtractedContent] = useState('');
  const [pageTitle, setPageTitle] = useState('');
  const [step, setStep] = useState<'input' | 'preview'>('input');
  const { toast } = useToast();
  const isOnline = useOnline();

  const handleFetch = async () => {
    if (!isOnline) {
      toast({ title: "You're offline", description: "URL import needs an internet connection.", variant: "destructive" });
      return;
    }
    if (!url.trim()) {
      toast({ title: "URL Required", description: "Please enter a webpage URL.", variant: "destructive" });
      return;
    }


    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('firecrawl-scrape', {
        body: { url: url.trim() },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Failed to extract content');

      const markdown = data.markdown || '';
      if (!markdown.trim()) {
        toast({ title: "No Content", description: "No readable text was found on this page.", variant: "destructive" });
        return;
      }

      // Convert markdown to plain text (remove markdown syntax)
      const plainText = markdown
        .replace(/^#{1,6}\s+/gm, '')        // headers
        .replace(/\*\*(.+?)\*\*/g, '$1')     // bold
        .replace(/\*(.+?)\*/g, '$1')         // italic
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // images
        .replace(/^[-*+]\s+/gm, '')          // list bullets
        .replace(/^\d+\.\s+/gm, '')          // numbered lists
        .replace(/^>\s+/gm, '')              // blockquotes
        .replace(/`{1,3}[^`]*`{1,3}/g, '')  // code
        .replace(/^---+$/gm, '')             // horizontal rules
        .replace(/\n{3,}/g, '\n\n')          // excessive newlines
        .trim();

      setExtractedContent(plainText);
      setPageTitle(data.title || '');
      setStep('preview');
      toast({ title: "Content Extracted!", description: `Successfully extracted text from the webpage.` });
    } catch (error) {
      console.error('URL import error:', error);
      toast({
        title: "Extraction Failed",
        description: error instanceof Error ? error.message : "Could not extract content from this URL.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInsert = () => {
    if (!extractedContent.trim()) {
      toast({ title: "No Content", description: "There is no content to insert.", variant: "destructive" });
      return;
    }
    onContentReady(extractedContent);
    toast({ title: "Content Inserted!", description: "The extracted text has been added to the chapter input." });
    // Reset state
    setUrl('');
    setExtractedContent('');
    setPageTitle('');
    setStep('input');
  };

  const handleCancel = () => {
    setExtractedContent('');
    setPageTitle('');
    setStep('input');
  };

  const pasteUrlFromClipboard = async () => {
    try {
      if (!navigator.clipboard?.readText) {
        toast({ title: "Clipboard not available", description: "Your browser doesn't allow clipboard access.", variant: "destructive" });
        return;
      }
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        toast({ title: "Clipboard is empty", description: "Copy a URL first, then tap to paste." });
        return;
      }
      setUrl(text);
      if (navigator.vibrate) navigator.vibrate(10);
      const looksLikeUrl = /^https?:\/\//i.test(text);
      toast({
        title: looksLikeUrl ? "URL pasted" : "Pasted from clipboard",
        description: looksLikeUrl ? "Tap Extract to continue." : "This doesn't look like a URL — please verify.",
      });
    } catch {
      toast({ title: "Couldn't read clipboard", description: "Permission denied. Long-press the field and choose Paste instead.", variant: "destructive" });
    }
  };

  if (step === 'preview') {
    return (
      <div className="space-y-4">
        {pageTitle && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">Source:</span> {pageTitle}
          </div>
        )}
        <Label className="text-sm font-semibold text-foreground">
          Review & Edit Extracted Content
        </Label>
        <p className="text-xs text-muted-foreground">
          Review the extracted text below. You can edit or remove any unwanted sections before inserting.
        </p>
        <Textarea
          value={extractedContent}
          onChange={(e) => setExtractedContent(e.target.value)}
          className="min-h-[200px] sm:min-h-[300px] resize-none text-sm"
          placeholder="Extracted content will appear here..."
        />
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={handleInsert} size="lg" className="w-full sm:flex-1 py-3 sm:py-4 text-base sm:text-lg font-semibold">
            <Check className="mr-2 h-4 w-4" />
            Insert into Chapter Text
          </Button>
          <Button onClick={handleCancel} variant="outline" size="lg" className="w-full sm:w-auto py-3 sm:py-4 text-base sm:text-lg font-semibold">
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-semibold text-foreground">
          Import from Webpage URL
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={pasteUrlFromClipboard}
          disabled={isLoading}
          className="h-8 px-2 text-xs gap-1.5"
        >
          <ClipboardPaste className="h-3.5 w-3.5" />
          Paste URL
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Paste a webpage URL to automatically extract the main readable text. Perfect for iPhone users who can't easily select and copy text from web pages.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/chapter-1"
            className="pl-10"
            onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
            disabled={isLoading}
          />
        </div>
        <Button onClick={handleFetch} disabled={isLoading || !url.trim()} className="w-full sm:w-auto">
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="mr-2 h-4 w-4" />
          )}
          {isLoading ? 'Extracting...' : 'Extract'}
        </Button>
      </div>
    </div>
  );
};

export default UrlImport;
