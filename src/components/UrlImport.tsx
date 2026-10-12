import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Globe,
  Loader2,
  Check,
  X,
  ArrowRight,
  ClipboardPaste,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOnline } from "@/hooks/use-online";
import { Switch } from "@/components/ui/switch";
import { useAiTask } from "@/hooks/use-ai-task";
import { invokeAiFunction } from "@/lib/ai-request";

interface UrlImportProps {
  onContentReady: (content: string) => void;
  onTitleReady?: (title: string) => void;
  onChapterNumberReady?: (chapterNumber: number) => void;
  modelRowId?: string | null;
  onGlossaryEntries?: (
    entries: { original_word: string; replacement_word: string }[],
  ) => void;
}

const UrlImport: React.FC<UrlImportProps> = ({
  onContentReady,
  onTitleReady,
  onChapterNumberReady,
  modelRowId,
  onGlossaryEntries,
}) => {
  const [url, setUrl] = useState("");
  const extractionTask = useAiTask();
  const isLoading = extractionTask.isRunning;
  const [extractedContent, setExtractedContent] = useState("");
  const [pageTitle, setPageTitle] = useState("");
  const [step, setStep] = useState<"input" | "preview">("input");
  const glossaryTask = useAiTask();
  const isExtractingGlossary = glossaryTask.isRunning;
  const [cleanWithAi, setCleanWithAi] = useState(false);
  const { toast } = useToast();
  const isOnline = useOnline();

  const handleFetch = async () => {
    if (isLoading) return;
    if (!isOnline) {
      toast({
        title: "You're offline",
        description: "URL import needs an internet connection.",
        variant: "destructive",
      });
      return;
    }
    if (!url.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a webpage URL.",
        variant: "destructive",
      });
      return;
    }

    const controller = extractionTask.start();
    try {
      const { data, error } = await invokeAiFunction(
        "firecrawl-scrape",
        {
          body: { url: url.trim(), cleanWithAi },
        }, controller.signal,
      );

      controller.signal.throwIfAborted();
      if (error) throw new Error(error.message);
      if (!data?.success)
        throw new Error(data?.error || "Failed to extract content");

      const markdown = data.content || data.markdown || "";
      if (!markdown.trim()) {
        toast({
          title: "No Content",
          description: "No readable text was found on this page.",
          variant: "destructive",
        });
        return;
      }

      // Convert markdown to plain text (remove markdown syntax)
      const plainText = markdown
        .replace(/^#{1,6}\s+/gm, "") // headers
        .replace(/\*\*(.+?)\*\*/g, "$1") // bold
        .replace(/\*(.+?)\*/g, "$1") // italic
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, "") // images
        .replace(/^[-*+]\s+/gm, "") // list bullets
        .replace(/^\d+\.\s+/gm, "") // numbered lists
        .replace(/^>\s+/gm, "") // blockquotes
        .replace(/`{1,3}[^`]*`{1,3}/g, "") // code
        .replace(/^---+$/gm, "") // horizontal rules
        .replace(/\n{3,}/g, "\n\n") // excessive newlines
        .trim();

      let contentToInsert = plainText;
      let importedTitle = data.chapterTitle;
      let importedChapterNumber = data.chapterNumber;
      if (cleanWithAi) {
        const { data: chapterData, error: chapterError } =
          await invokeAiFunction("ai-chapter-import", {
            body: { content: plainText },
          }, controller.signal);
        if (chapterError) throw new Error(chapterError.message);
        const chapter = Array.isArray(chapterData?.chapters)
          ? chapterData.chapters[0]
          : null;
        if (chapter?.content?.trim()) {
          contentToInsert = chapter.content;
          importedTitle = chapter.title || importedTitle;
          importedChapterNumber =
            chapter.chapter_number || importedChapterNumber;
        }
      }
      controller.signal.throwIfAborted();
      if (Number.isInteger(importedChapterNumber))
        onChapterNumberReady?.(importedChapterNumber);
      if (typeof importedTitle === "string" && importedTitle.trim())
        onTitleReady?.(importedTitle.trim());
      onContentReady(contentToInsert.replace(/\r?\n/g, "<br>"));
      toast({
        title: "Content imported",
        description:
          "The scraped text was added directly to the chapter content.",
      });
      setUrl("");
      setExtractedContent("");
      setPageTitle("");
      setStep("input");
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error("URL import error:", error);
      toast({
        title: "Extraction Failed",
        description:
          error instanceof Error
            ? error.message
            : "Could not extract content from this URL.",
        variant: "destructive",
      });
    } finally {
      extractionTask.finish(controller);
    }
  };

  const handleInsert = async () => {
    if (!extractedContent.trim()) {
      toast({
        title: "No Content",
        description: "There is no content to insert.",
        variant: "destructive",
      });
      return;
    }
    onContentReady(extractedContent);
    if (pageTitle) onTitleReady?.(pageTitle);
    toast({
      title: "Content Inserted!",
      description: "The extracted text has been added to the chapter input.",
    });

    if (!modelRowId || !onGlossaryEntries) {
      toast({
        title: "Glossary Extraction Skipped",
        description: "Select an active AI model to extract glossary terms.",
      });
    } else if (!isOnline) {
      toast({
        title: "Glossary Extraction Skipped",
        description: "Go online to extract glossary terms from imported text.",
      });
    } else {
      const controller = glossaryTask.start();
      try {
        const { data, error } = await invokeAiFunction(
          "ai-glossary-extract",
          {
            body: { text: extractedContent, modelRowId },
          }, controller.signal,
        );
        if (error) throw new Error(error.message);
        const entries = Array.isArray(data?.entries) ? data.entries : [];
        controller.signal.throwIfAborted();
        onGlossaryEntries(entries);
        toast({
          title: entries.length
            ? "Glossary Extracted"
            : "No Glossary Terms Found",
          description: entries.length
            ? `${entries.length} terms were sent to Glossary Entries. Existing terms will be skipped.`
            : "The chapter text was imported without new glossary terms.",
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        let description =
          error instanceof Error
            ? error.message
            : "The chapter text was imported, but glossary extraction failed.";

        if (error && typeof error === "object" && "context" in error) {
          const response = (error as { context?: unknown }).context;
          if (response instanceof Response) {
            try {
              const body = await response.clone().json();
              if (typeof body?.error === "string") description = body.error;
            } catch {
              // Keep the original invoke error when the response is not JSON.
            }
          }
        }

        toast({
          title: "Glossary Extraction Failed",
          description,
          variant: "destructive",
        });
      } finally {
        glossaryTask.finish(controller);
      }
    }

    // Reset state
    setUrl("");
    setExtractedContent("");
    setPageTitle("");
    setStep("input");
  };

  const handleCancel = () => {
    setExtractedContent("");
    setPageTitle("");
    setStep("input");
  };

  const pasteUrlFromClipboard = async () => {
    try {
      if (!navigator.clipboard?.readText) {
        toast({
          title: "Clipboard not available",
          description: "Your browser doesn't allow clipboard access.",
          variant: "destructive",
        });
        return;
      }
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        toast({
          title: "Clipboard is empty",
          description: "Copy a URL first, then tap to paste.",
        });
        return;
      }
      setUrl(text);
      if (navigator.vibrate) navigator.vibrate(10);
      const looksLikeUrl = /^https?:\/\//i.test(text);
      toast({
        title: looksLikeUrl ? "URL pasted" : "Pasted from clipboard",
        description: looksLikeUrl
          ? "Tap Extract to continue."
          : "This doesn't look like a URL — please verify.",
      });
    } catch {
      toast({
        title: "Couldn't read clipboard",
        description:
          "Permission denied. Long-press the field and choose Paste instead.",
        variant: "destructive",
      });
    }
  };

  if (step === "preview") {
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
          Review the extracted text below. You can edit or remove any unwanted
          sections before inserting.
        </p>
        <Textarea
          value={extractedContent}
          onChange={(e) => setExtractedContent(e.target.value)}
          className="min-h-[200px] sm:min-h-[300px] resize-none text-sm"
          placeholder="Extracted content will appear here..."
        />
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleInsert}
            disabled={isExtractingGlossary}
            size="lg"
            className="w-full sm:flex-1 py-3 sm:py-4 text-base sm:text-lg font-semibold"
          >
            {isExtractingGlossary ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            {isExtractingGlossary
              ? "Extracting Glossary..."
              : "Insert into Chapter Text"}
          </Button>
          <Button
            onClick={isExtractingGlossary ? () => glossaryTask.stop() : handleCancel}
            variant="outline"
            size="lg"
            className="w-full sm:w-auto py-3 sm:py-4 text-base sm:text-lg font-semibold"
          >
            <X className="mr-2 h-4 w-4" />
            {isExtractingGlossary ? "Stop" : "Cancel"}
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
        Paste a webpage URL to automatically extract the main readable text.
        Perfect for iPhone users who can't easily select and copy text from web
        pages.
      </p>
      <div className="flex items-center gap-2">
        <Switch
          id="clean-scraped-content"
          checked={cleanWithAi}
          onCheckedChange={setCleanWithAi}
          disabled={isLoading || !isOnline}
        />
        <Label
          htmlFor="clean-scraped-content"
          className="cursor-pointer text-xs text-muted-foreground"
        >
          Trim the content with AI
        </Label>
      </div>
      {!isOnline && (
        <p className="text-xs text-destructive">
          You're offline — URL import will work again once you're back online.
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/chapter-1"
            className="pl-10"
            onKeyDown={(e) => e.key === "Enter" && handleFetch()}
            disabled={isLoading || !isOnline}
          />
        </div>
        <Button
          onClick={handleFetch}
          disabled={isLoading || !url.trim() || !isOnline}
          className="w-full sm:w-auto"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="mr-2 h-4 w-4" />
          )}
          {isLoading ? "Extracting..." : "Extract"}
        </Button>
        {isLoading && (
          <Button type="button" variant="destructive" onClick={() => extractionTask.stop()}>
            Stop
          </Button>
        )}
      </div>
    </div>
  );
};

export default UrlImport;
