import { createElement, useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComingSoon } from "@/components/ComingSoon";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { RimoraShell } from "@/components/RimoraShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { rimora } from "@/lib/rimora";
import { plainTextToChapterHtml } from "@/lib/chapter-text";
import { invokeAiFunction } from "@/lib/ai-request";
import { useAiTask } from "@/hooks/use-ai-task";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ProcessProgress } from "@/components/ProcessProgress";
import { GlossaryManager, GlossaryTrigger } from "@/components/GlossaryManager";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Novel = {
  id: string;
  title: string;
  translation_title: string | null;
  novel_type: string;
  author: string | null;
  translator: string | null;
  leading_gender: string | null;
  genre: string | null;
  language: string | null;
  original_language: string | null;
  original_title: string | null;
  translation_language: string | null;
  abbreviation: string | null;
  length: string | null;
  warning_notice: string | null;
  original_platform: string | null;
  translator_group: string | null;
  fanfic_topic: string | null;
  fanfic_category: string | null;
  description: string | null;
  cover_url: string | null;
  status: string;
  deleted_at: string | null;
};

type Chapter = {
  id: string;
  title: string;
  chapter_number: number;
  status: string;
  deleted_at: string | null;
  updated_at: string;
};

const allowedTags: Record<string, string> = {
  p: "p",
  strong: "strong",
  b: "strong",
  em: "em",
  i: "em",
  u: "u",
  s: "s",
  br: "br",
  ul: "ul",
  ol: "ol",
  li: "li",
  h3: "h3",
  h4: "h4",
  blockquote: "blockquote",
};
const renderRichTextNode = (node: Node, key: string): ReactNode => {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const element = node as HTMLElement;
  const tag = allowedTags[element.tagName.toLowerCase()];
  if (!tag)
    return Array.from(element.childNodes).map((child, index) =>
      renderRichTextNode(child, `${key}-${index}`),
    );
  return createElement(
    tag,
    { key },
    tag === "br"
      ? undefined
      : Array.from(element.childNodes).map((child, index) =>
          renderRichTextNode(child, `${key}-${index}`),
        ),
  );
};
const RichText = ({ content }: { content: string }) => {
  if (!content.includes("<")) return <>{content}</>;
  const document = new DOMParser().parseFromString(content, "text/html");
  return (
    <>
      {Array.from(document.body.childNodes).map((node, index) =>
        renderRichTextNode(node, String(index)),
      )}
    </>
  );
};

const NovelWorkspace = () => {
  const { novelId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: novel, isPending: novelLoading, isError: novelError, refetch: refetchNovel } = useQuery({
    queryKey: ["workspace-novel", novelId, user?.id],
    enabled: Boolean(novelId && user),
    queryFn: async ({ signal }) => {
      const { data, error } = await rimora
        .from("novels")
        .select("*")
        .eq("id", novelId)
        .eq("owner_id", user!.id)
        .abortSignal(signal)
        .maybeSingle();
      if (error) throw error;
      return data as Novel | null;
    },
    // Polling keeps dashboard/database edits visible even when Realtime
    // is not enabled for this table. Focus and reconnect also refresh it.
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: "always",
    retry: 1,
  });
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("draft");
  const { toast } = useToast();
  const [aiImportOpen, setAiImportOpen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [aiImportUrl, setAiImportUrl] = useState("");
  const importTask = useAiTask();
  const aiImporting = importTask.isRunning;
  const [chapterRangeEnabled, setChapterRangeEnabled] = useState(false);
  const [chapterFrom, setChapterFrom] = useState("");
  const [chapterTo, setChapterTo] = useState("");
  const [skipGlossaryExtraction, setSkipGlossaryExtraction] = useState(true);
  const [skipTranslation, setSkipTranslation] = useState(true);
  const [importProgress, setImportProgress] = useState({ completed: 0, failed: 0, total: 0, current: "" });

  const stopChapterImport = () => {
    importTask.stop();
    setImportProgress((progress) => ({ ...progress, current: "Stopped" }));
    toast({ title: "Import stopped", description: "Already saved chapters have been kept. Remaining chapters will not be processed." });
  };

  const importChapterJob = async () => {
    if (aiImporting || !novelId || !user || !aiImportUrl.trim()) return;
    const from =
      chapterRangeEnabled && chapterFrom ? Number(chapterFrom) : null;
    const to = chapterRangeEnabled && chapterTo ? Number(chapterTo) : null;
    if (
      chapterRangeEnabled &&
      ((from !== null && (!Number.isInteger(from) || from < 1)) ||
        (to !== null && (!Number.isInteger(to) || to < 1)) ||
        (from !== null && to !== null && to < from))
    ) {
      toast({
        title: "Invalid chapter range",
        description: "Enter a valid chapter range.",
        variant: "destructive",
      });
      return;
    }
    const controller = importTask.start();
    setImportProgress({ completed: 0, failed: 0, total: 0, current: "Discovering chapter links" });
    let jobId: string | null = null;
    let completed = 0;
    let failed = 0;
    try {
      const jobResult = await supabase
        .from("chapter_import_jobs")
        .insert({
          novel_id: novelId,
          user_id: user.id,
          source_url: aiImportUrl.trim(),
          range_from: from,
          range_to: to,
          skip_glossary: skipGlossaryExtraction,
          skip_translation: skipTranslation,
          status: "discovering_links",
        })
        .select("id")
        .single();
      if (jobResult.error) throw jobResult.error;
      jobId = jobResult.data.id;
      controller.signal.throwIfAborted();
      const discovery = await invokeAiFunction(
        "ai-discover-chapter-links",
        {
          body: {
            url: aiImportUrl.trim(),
            ...(from !== null ? { chapterFrom: from } : {}),
            ...(to !== null ? { chapterTo: to } : {}),
          },
        }, controller.signal,
      );
      controller.signal.throwIfAborted();
      if (discovery.error) throw new Error(discovery.error.message);
      const links = (
        Array.isArray(discovery.data?.chapters) ? discovery.data.chapters : []
      ).filter(
        (item: { chapter_number?: number }) =>
          (from === null || item.chapter_number! >= from) &&
          (to === null || item.chapter_number! <= to),
      );
      if (!links.length) {
        const message = "No chapter links were found in the selected range.";
        await supabase
          .from("chapter_import_jobs")
          .update({ status: "completed_with_errors", error_message: message })
          .eq("id", jobId);
        throw new Error(message);
      }
      const items = links.map(
        (item: { chapter_number: number; title: string; url: string }) => ({
          job_id: jobId,
          novel_id: novelId,
          chapter_number: item.chapter_number,
          source_url: item.url,
          discovered_title: item.title || "",
          status: "pending",
        }),
      ).sort((left, right) => left.chapter_number - right.chapter_number);
      setImportProgress({ completed: 0, failed: 0, total: items.length, current: "Preparing chapters" });
      if (items.length) {
        const itemResult = await supabase
          .from("chapter_import_items")
          .insert(items);
        if (itemResult.error) throw itemResult.error;
      }
      controller.signal.throwIfAborted();
      await supabase
        .from("chapter_import_jobs")
        .update({ status: "processing", total_chapters: items.length })
        .eq("id", jobId);
      for (const item of items) {
        try {
          controller.signal.throwIfAborted();
          const reportStage = (stage: string) => setImportProgress((progress) => ({
            ...progress, current: `Chapter ${item.chapter_number}: ${stage}`,
          }));
          reportStage("Fetching chapter");
          await supabase
            .from("chapter_import_items")
            .update({
              status: "processing",
              attempts: 1,
              started_at: new Date().toISOString(),
            })
            .eq("job_id", jobId)
            .eq("chapter_number", item.chapter_number);
          const scraped = await invokeAiFunction("firecrawl-scrape", {
            body: { url: item.source_url, cleanWithAi: false },
          }, controller.signal);
          controller.signal.throwIfAborted();
          if (scraped.error || !scraped.data?.success)
            throw new Error(
              scraped.error?.message ||
                scraped.data?.error ||
                "Chapter scrape failed",
            );
          reportStage("Extracting chapter content");
          const structured = await invokeAiFunction(
            "ai-chapter-import",
            {
              body: {
                content: scraped.data.content || scraped.data.markdown || "",
                url: item.source_url,
                chapterFrom: item.chapter_number,
                chapterTo: item.chapter_number,
              },
            }, controller.signal,
          );
          controller.signal.throwIfAborted();
          if (
            structured.error ||
            !structured.data?.success ||
            !structured.data.chapters?.[0]
          )
            throw new Error(
              structured.error?.message ||
                structured.data?.error ||
                "Chapter extraction failed",
            );
          const chapter = structured.data.chapters.find(
            (candidate: { chapter_number?: number }) => candidate.chapter_number === item.chapter_number,
          );
          if (!chapter) throw new Error(`AI extraction did not return chapter ${item.chapter_number}.`);
          if (typeof chapter.content !== "string" || !chapter.content.trim()) {
            throw new Error("Chapter extraction returned empty or invalid content.");
          }
          let finalTitle =
            chapter.title ||
            item.discovered_title ||
            `Chapter ${item.chapter_number}`;
          const sourceContent = chapter.content;
          let finalContent = sourceContent;
          if (!skipGlossaryExtraction) {
            reportStage("Extracting glossary");
            const extracted = await invokeAiFunction(
              "ai-glossary-extract",
              {
                body: {
                  text: finalContent,
                  originalLanguage: novel?.original_language || novel?.language || "original language",
                  translatedLanguage:
                    novel?.translation_language || "translated language",
                },
              }, controller.signal,
            );
            controller.signal.throwIfAborted();
            if (extracted.error || extracted.data?.error || !Array.isArray(extracted.data?.entries)) {
              throw new Error(extracted.error?.message || extracted.data?.error || "Glossary extraction failed");
            }
            const entries = Array.isArray(extracted.data?.entries)
              ? extracted.data.entries
                  .filter(
                    (entry: {
                      original_word?: string;
                      replacement_word?: string;
                    }) =>
                      typeof entry.original_word === "string" &&
                      typeof entry.replacement_word === "string" &&
                      entry.original_word.trim().length >= 2 &&
                      entry.original_word.trim().length <= 6 &&
                      entry.replacement_word.trim(),
                  )
                  .map(
                    (entry: {
                      original_word: string;
                      replacement_word: string;
                    }) => ({
                      owner_id: user.id,
                      novel_id: novelId,
                      source_term: entry.original_word.trim(),
                      preferred_term: entry.replacement_word.trim(),
                      source_language: novel?.original_language || novel?.language || "original language",
                      target_language:
                        novel?.translation_language || "translated language",
                    }),
                  )
              : [];
            for (const entry of entries) {
              controller.signal.throwIfAborted();
              const glossaryResult = await supabase
                .from("glossary_entries")
                .insert(entry);
              if (glossaryResult.error && glossaryResult.error.code !== "23505")
                throw glossaryResult.error;
            }
          }
          if (!skipTranslation) {
            controller.signal.throwIfAborted();
            reportStage("Translating chapter");
            const translated = await invokeAiFunction("ai-translate", {
              body: {
                chapterNumber: item.chapter_number,
                title: finalTitle,
                content: finalContent.split(/\r?\n/),
                authorThoughts: "",
                originalLanguage: novel?.original_language || novel?.language || "source language",
                targetLanguage: novel?.translation_language || "English",
              },
            }, controller.signal);
            controller.signal.throwIfAborted();
            if (translated.error || !translated.data?.chapter)
              throw new Error(
                translated.error?.message || "Translation failed",
              );
            finalTitle = translated.data.chapter.title;
            finalContent = translated.data.chapter.content.join("\n");
          }
          controller.signal.throwIfAborted();
          reportStage("Saving chapter");
          const insert = await rimora.from("chapters").upsert(
            {
              novel_id: novelId,
              chapter_number: item.chapter_number,
              title: finalTitle,
              content: plainTextToChapterHtml(finalContent, true),
              source_content: sourceContent,
              source_url: item.source_url,
              status: "draft",
              published_at: null,
            },
            { onConflict: "novel_id,chapter_number" },
          ).select("id,title,chapter_number,status,deleted_at,updated_at").abortSignal(controller.signal).single();
          controller.signal.throwIfAborted();
          if (insert.error) throw insert.error;
          if (!insert.data) throw new Error("The imported chapter was not saved.");
          // Show each committed chapter immediately, before fetching the next.
          const savedChapter = insert.data as Chapter;
          setChapters((current) => [
            ...current.filter((entry) => entry.chapter_number !== savedChapter.chapter_number),
            savedChapter,
          ]);
          completed += 1;
          setImportProgress({ completed, failed, total: items.length, current: "" });
          await supabase
            .from("chapter_import_items")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
            })
            .eq("job_id", jobId)
            .eq("chapter_number", item.chapter_number);
        } catch (error) {
          if (controller.signal.aborted) throw error;
          failed += 1;
          setImportProgress({ completed, failed, total: items.length, current: "" });
          await supabase
            .from("chapter_import_items")
            .update({
              status: "failed",
              error_message:
                error instanceof Error
                  ? error.message
                  : "Chapter processing failed",
            })
            .eq("job_id", jobId)
            .eq("chapter_number", item.chapter_number);
        }
        await supabase
          .from("chapter_import_jobs")
          .update({ completed_chapters: completed, failed_chapters: failed })
          .eq("id", jobId);
        toast({
          title: "Import progress",
          description: `${completed + failed} of ${items.length} chapters processed.`,
        });
      }
      controller.signal.throwIfAborted();
      await supabase
        .from("chapter_import_jobs")
        .update({
          status: failed ? "completed_with_errors" : "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);
      controller.signal.throwIfAborted();
      setAiImportOpen(false);
      setActiveTab("draft");
      toast({
        title: "AI chapter import complete",
        description: `${completed} saved${failed ? `, ${failed} failed` : ""}.`,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        if (jobId) {
          await supabase.from("chapter_import_jobs").update({
            status: "cancelled", completed_chapters: completed, failed_chapters: failed,
            completed_at: new Date().toISOString(), error_message: "Stopped by user",
          }).eq("id", jobId);
          await supabase.from("chapter_import_items").update({
            status: "skipped", error_message: "Import cancelled",
          }).eq("job_id", jobId).in("status", ["pending", "processing"]);
        }
        return;
      }
      if (jobId)
        await supabase
          .from("chapter_import_jobs")
          .update({
            status: "completed_with_errors",
            error_message:
              error instanceof Error ? error.message : "Import failed",
          })
          .eq("id", jobId);
      toast({
        title: "AI chapter import failed",
        description:
          error instanceof Error ? error.message : "Could not import chapters.",
        variant: "destructive",
      });
    } finally {
      importTask.finish(controller);
    }
  };

  useEffect(() => {
    if (!novelId || !user) return;
    let active = true;
    setLoading(true);
    void supabase
        .from("chapters")
        .select("id,title,chapter_number,status,deleted_at,updated_at")
        .eq("novel_id", novelId)
        .order("chapter_number", { ascending: false })
    .then(({ data }) => {
      if (!active) return;
      setChapters((data ?? []) as Chapter[]);
      setLoading(false);
    });
    return () => { active = false; };
  }, [novelId, user]);

  useEffect(() => {
    if (!novelId || !user?.id) return;
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["workspace-novel", novelId, user.id] });
    };
    const channel = supabase
      .channel(`workspace-novel:${novelId}:${user.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "novels",
        filter: `id=eq.${novelId}`,
      }, refresh)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refresh();
      });
    return () => { void supabase.removeChannel(channel); };
  }, [novelId, user?.id, queryClient]);
  const chaptersForTab = (tab: string) =>
    chapters
      .filter((chapter) =>
        tab === "trash"
          ? Boolean(chapter.deleted_at)
          : !chapter.deleted_at && chapter.status === tab,
      )
      .sort((left, right) =>
        tab === "trash"
          ? new Date(right.deleted_at ?? 0).getTime() -
            new Date(left.deleted_at ?? 0).getTime()
          : right.chapter_number - left.chapter_number,
      );
  const typeBadgeClass =
    novel?.novel_type === "Translation"
      ? "bg-sky-600 text-white"
      : novel?.novel_type === "Fanfic"
        ? "bg-fuchsia-600 text-white"
        : "bg-emerald-600 text-white";
  const softDeleteChapter = async (chapter: Chapter) => {
    const { error } = await supabase
      .from("chapters")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", chapter.id);
    if (!error)
      setChapters((current) =>
        current.map((item) =>
          item.id === chapter.id
            ? { ...item, deleted_at: new Date().toISOString() }
            : item,
        ),
      );
  };
  const restoreChapter = async (chapter: Chapter) => {
    const activeConflict = chapters.some(
      (item) =>
        item.id !== chapter.id &&
        item.chapter_number === chapter.chapter_number &&
        !item.deleted_at,
    );
    if (activeConflict) {
      toast({
        title: "Cannot restore chapter",
        description: `Chapter ${chapter.chapter_number} already exists as an active chapter. Move or delete it before restoring this one.`,
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase
      .from("chapters")
      .update({ deleted_at: null })
      .eq("id", chapter.id);
    if (error) {
      toast({
        title: "Cannot restore chapter",
        description:
          error.code === "23505"
            ? `Chapter ${chapter.chapter_number} already exists as an active chapter.`
            : error.message,
        variant: "destructive",
      });
      return;
    }
    setChapters((current) =>
      current.map((item) =>
        item.id === chapter.id ? { ...item, deleted_at: null } : item,
      ),
    );
  };
  const permanentlyDeleteChapter = async (chapter: Chapter) => {
    const { error } = await supabase
      .from("chapters")
      .delete()
      .eq("id", chapter.id);
    if (!error)
      setChapters((current) =>
        current.filter((item) => item.id !== chapter.id),
      );
  };
  const restoreAllChapters = async () => {
    const trashedChapters = chaptersForTab("trash");
    if (!trashedChapters.length) return;
    const { error } = await supabase
      .from("chapters")
      .update({ deleted_at: null })
      .in(
        "id",
        trashedChapters.map((chapter) => chapter.id),
      );
    if (error) {
      toast({
        title: "Could not restore chapters",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setChapters((current) =>
      current.map((chapter) =>
        trashedChapters.some((trashed) => trashed.id === chapter.id)
          ? { ...chapter, deleted_at: null }
          : chapter,
      ),
    );
    toast({
      title: "Chapters restored",
      description: `${trashedChapters.length} chapters restored.`,
    });
  };
  const permanentlyDeleteAllChapters = async () => {
    const trashedChapters = chaptersForTab("trash");
    if (!trashedChapters.length) return;
    const { error } = await supabase
      .from("chapters")
      .delete()
      .in(
        "id",
        trashedChapters.map((chapter) => chapter.id),
      );
    if (error) {
      toast({
        title: "Could not clear Trash",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setChapters((current) =>
      current.filter(
        (chapter) =>
          !trashedChapters.some((trashed) => trashed.id === chapter.id),
      ),
    );
    toast({
      title: "Trash cleared",
      description: `${trashedChapters.length} chapters permanently deleted.`,
    });
  };

  if (loading || novelLoading) {
    return (
      <RimoraShell>
        <div className="page-container max-w-5xl">
          <ComingSoon
            title="Loading novel"
            description="Preparing your writing workspace..."
          />
        </div>
      </RimoraShell>
    );
  }

  if (novelError && !novel) {
    return (
      <RimoraShell>
        <div className="page-container max-w-5xl space-y-4" role="alert">
          <p>Could not load novel details. Please check your connection and try again.</p>
          <Button onClick={() => void refetchNovel()}>Try again</Button>
        </div>
      </RimoraShell>
    );
  }

  if (!novel) {
    return (
      <RimoraShell>
        <div className="page-container max-w-5xl">
          <ComingSoon
            title="Novel not found"
            description="This novel is not available in your workspace."
          />
        </div>
      </RimoraShell>
    );
  }

  return (
    <RimoraShell>
      <div className="page-container max-w-5xl space-y-8">
        {novelError && (
          <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">
            <p>Novel updates are temporarily unavailable. Showing the last loaded details.</p>
            <Button variant="outline" size="sm" onClick={() => void refetchNovel()}>Try again</Button>
          </div>
        )}
        <Button variant="ghost" size="sm" asChild>
          <Link to="/workspace">
            <ArrowLeft /> My Novels
          </Link>
        </Button>
        <div className="flex flex-col gap-6 md:block md:space-y-6">
          <Card className="order-2 md:order-1">
            <CardContent className="grid gap-8 p-6 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] md:items-start">
              <div className="relative">
                <span
                  className={`absolute left-3 top-3 z-10 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${typeBadgeClass}`}
                >
                  {novel.novel_type}
                </span>
                {novel.cover_url ? (
                  <img
                    src={novel.cover_url}
                    alt={`${novel.title} cover`}
                    className="aspect-[3/4] w-full rounded-sm object-cover"
                  />
                ) : (
                  <div className="grid aspect-[3/4] w-full place-items-center rounded-sm bg-muted text-muted-foreground">
                    <BookOpen className="h-12 w-12" />
                  </div>
                )}
              </div>
              <div className="relative space-y-4 text-sm">
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  className="absolute right-0 top-0"
                  aria-label="Edit novel details"
                  title="Edit novel details"
                >
                  <Link to={`/novel/${novel.id}/edit`}>
                    <Pencil />
                  </Link>
                </Button>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {novel.novel_type === "Translation"
                      ? "Original title"
                      : "Title"}
                  </p>
                  <p className="mt-1 font-medium">{novel.novel_type === "Translation" ? novel.original_title || novel.title : novel.title}</p>
                </div>
                {novel.novel_type === "Translation" &&
                  novel.translation_title && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Translation title
                      </p>
                      <p className="mt-1">{novel.translation_title}</p>
                    </div>
                  )}
                {novel.author && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Author
                    </p>
                    <p className="mt-1">{novel.author}</p>
                  </div>
                )}
                {novel.novel_type === "Translation" && novel.translator && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Translator
                    </p>
                    <p className="mt-1">
                      {novel.translator}
                      {novel.translator_group
                        ? ` (${novel.translator_group})`
                        : ""}
                    </p>
                  </div>
                )}
                {novel.leading_gender && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Leading gender
                    </p>
                    <p className="mt-1">{novel.leading_gender}</p>
                  </div>
                )}
                {novel.genre && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Genre
                    </p>
                    <p className="mt-1">{novel.genre}</p>
                  </div>
                )}
                {(novel.novel_type === "Translation" ? novel.original_language : novel.language) && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {novel.novel_type === "Translation"
                        ? "Original language"
                        : "Language"}
                    </p>
                    <p className="mt-1">{novel.novel_type === "Translation" ? novel.original_language : novel.language}</p>
                  </div>
                )}
                {novel.novel_type === "Translation" &&
                  novel.translation_language && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Translation language
                      </p>
                      <p className="mt-1">{novel.translation_language}</p>
                    </div>
                  )}
                {novel.abbreviation && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Abbreviation
                    </p>
                    <p className="mt-1">{novel.abbreviation}</p>
                  </div>
                )}
                {novel.length && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Length
                    </p>
                    <p className="mt-1">{novel.length}</p>
                  </div>
                )}
                {novel.novel_type === "Translation" &&
                  novel.original_platform && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Original platform
                      </p>
                      <p className="mt-1 break-words">
                        {/^https?:\/\//i.test(novel.original_platform.trim()) ? (
                          <a
                            href={novel.original_platform.trim()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline underline-offset-4 hover:opacity-80"
                          >
                            {novel.original_platform}
                          </a>
                        ) : novel.original_platform}
                      </p>
                    </div>
                  )}
                {novel.novel_type === "Fanfic" && novel.fanfic_topic && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Fanfic topic
                    </p>
                    <p className="mt-1">
                      {novel.fanfic_topic}
                      {novel.fanfic_category
                        ? ` (${novel.fanfic_category})`
                        : ""}
                    </p>
                  </div>
                )}
                {novel.warning_notice && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Warning notice
                    </p>
                    <p className="mt-1">{novel.warning_notice}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Synopsis
                  </p>
                  <div className="mt-1 leading-6 text-muted-foreground [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:font-display [&_h4]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-3 [&_ul]:list-disc">
                    {novel.description ? (
                      <RichText content={novel.description} />
                    ) : (
                      "No synopsis added yet."
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="order-1 md:order-2">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Chapters</CardTitle>
              <div className="flex items-center gap-2">
                <Dialog open={aiImportOpen} onOpenChange={(open) => {
                  if (!open && aiImporting) stopChapterImport();
                  setAiImportOpen(open);
                }}>
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Import chapters with AI"
                      title="Import chapters with AI"
                    >
                      <Bot />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[min(92vw,520px)]">
                    <DialogHeader>
                      <DialogTitle>Import chapters with AI</DialogTitle>
                      <DialogDescription>
                        Paste a novel page URL. Each chapter is saved as a draft
                        as soon as its selected processing steps finish, before the next chapter starts.
                      </DialogDescription>
                    </DialogHeader>
                    {aiImporting && (
                      <ProcessProgress
                        label="Importing chapters"
                        completed={importProgress.completed}
                        failed={importProgress.failed}
                        total={importProgress.total}
                        current={importProgress.current}
                      />
                    )}
                    <div className="space-y-3 rounded-sm border border-border bg-muted/30 p-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="chapter-range"
                          checked={chapterRangeEnabled}
                          onCheckedChange={setChapterRangeEnabled}
                          disabled={aiImporting}
                        />
                        <label
                          htmlFor="chapter-range"
                          className="cursor-pointer text-sm font-medium"
                        >
                          Import a specific chapter range
                        </label>
                      </div>
                      {chapterRangeEnabled && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label
                              htmlFor="chapter-from"
                              className="text-xs text-muted-foreground"
                            >
                              From
                            </label>
                            <Input
                              id="chapter-from"
                              type="number"
                              min="1"
                              step="1"
                              value={chapterFrom}
                              onChange={(event) =>
                                setChapterFrom(event.target.value)
                              }
                              disabled={aiImporting}
                              placeholder="1"
                            />
                          </div>
                          <div className="space-y-1">
                            <label
                              htmlFor="chapter-to"
                              className="text-xs text-muted-foreground"
                            >
                              To
                            </label>
                            <Input
                              id="chapter-to"
                              type="number"
                              min="1"
                              step="1"
                              value={chapterTo}
                              onChange={(event) =>
                                setChapterTo(event.target.value)
                              }
                              disabled={aiImporting}
                              placeholder="10"
                            />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Switch
                          id="skip-glossary-extraction"
                          checked={skipGlossaryExtraction}
                          onCheckedChange={setSkipGlossaryExtraction}
                          disabled={aiImporting}
                        />
                        <label
                          htmlFor="skip-glossary-extraction"
                          className="cursor-pointer text-sm font-medium"
                        >
                          Skip glossary extraction
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="skip-translation"
                          checked={skipTranslation}
                          onCheckedChange={setSkipTranslation}
                          disabled={aiImporting}
                        />
                        <label
                          htmlFor="skip-translation"
                          className="cursor-pointer text-sm font-medium"
                        >
                          Skip translation
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={aiImportUrl}
                        onChange={(event) => setAiImportUrl(event.target.value)}
                        placeholder="https://example.com/novel"
                        disabled={aiImporting}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void importChapterJob();
                        }}
                      />
                      <Button
                        type="button"
                        onClick={() => void importChapterJob()}
                        disabled={aiImporting || !aiImportUrl.trim()}
                      >
                        {aiImporting ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Bot />
                        )}{" "}
                        Import
                      </Button>
                      {aiImporting && (
                        <Button type="button" variant="destructive" onClick={stopChapterImport}>
                          Stop
                        </Button>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
                <GlossaryTrigger onClick={() => setGlossaryOpen(true)} />
                {novelId && user && (
                  <GlossaryManager
                    novelId={novelId}
                    userId={user.id}
                    open={glossaryOpen}
                    onOpenChange={setGlossaryOpen}
                  />
                )}
                <Button
                  variant="outline"
                  size="icon"
                  className="sm:w-auto sm:px-3"
                  asChild
                >
                  <Link to={`/workbook/${novel.id}`} aria-label="Add chapter">
                    <Plus />{" "}
                    <span className="hidden sm:inline">Add chapter</span>
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="space-y-4"
              >
                <TabsList className="grid h-auto w-full grid-cols-3 border-b border-border bg-transparent p-0">
                  <TabsTrigger
                    value="draft"
                    className="rounded-none border-b-2 border-transparent px-3 py-3 text-muted-foreground shadow-none transition-colors data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Draft
                  </TabsTrigger>
                  <TabsTrigger
                    value="published"
                    className="rounded-none border-b-2 border-transparent px-3 py-3 text-muted-foreground shadow-none transition-colors data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Published
                  </TabsTrigger>
                  <TabsTrigger
                    value="trash"
                    className="rounded-none border-b-2 border-transparent px-3 py-3 text-muted-foreground shadow-none transition-colors data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Trash
                  </TabsTrigger>
                </TabsList>
                {(["draft", "published", "trash"] as const).map((tab) => (
                  <TabsContent key={tab} value={tab} className="space-y-3">
                    {tab === "trash" && chaptersForTab("trash").length > 0 && (
                      <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border pb-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void restoreAllChapters()}
                        >
                          Restore all
                        </Button>
                        <ConfirmationDialog
                          trigger={
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                            >
                              Clear all Trash
                            </Button>
                          }
                          title="Clear all Trash?"
                          description="Every chapter currently in Trash will be permanently deleted. This action cannot be undone."
                          confirmLabel="Clear all Trash"
                          destructive
                          onConfirm={() => void permanentlyDeleteAllChapters()}
                        />
                      </div>
                    )}
                    {chaptersForTab(tab).length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No {tab} chapters.
                      </p>
                    ) : (
                      chaptersForTab(tab).map((chapter) => (
                        <div
                          key={chapter.id}
                          className="flex items-center justify-between rounded-sm border border-border px-4 py-3"
                        >
                          <div
                            className={`min-w-0 flex-1 rounded-sm ${tab !== "trash" ? "cursor-pointer hover:bg-muted/50" : ""}`}
                            role={tab !== "trash" ? "link" : undefined}
                            tabIndex={tab !== "trash" ? 0 : undefined}
                            onClick={() =>
                              tab !== "trash" &&
                              navigate(
                                `/workbook/${novel.id}?chapter=${chapter.id}`,
                              )
                            }
                            onKeyDown={(event) => {
                              if (
                                tab !== "trash" &&
                                (event.key === "Enter" || event.key === " ")
                              ) {
                                event.preventDefault();
                                navigate(
                                  `/workbook/${novel.id}?chapter=${chapter.id}`,
                                );
                              }
                            }}
                          >
                            <p className="font-medium">
                              Chapter {chapter.chapter_number}
                              {chapter.title.trim() !==
                              `Chapter ${chapter.chapter_number}`
                                ? `: ${chapter.title}`
                                : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {tab === "trash"
                                ? "Trash"
                                : chapter.status.charAt(0).toUpperCase() +
                                  chapter.status.slice(1)}
                              {chapter.updated_at
                                ? ` · Updated ${new Date(chapter.updated_at).toLocaleString()}`
                                : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {tab === "trash" ? (
                              <>
                                <ConfirmationDialog
                                  trigger={
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      aria-label="Restore chapter"
                                    >
                                      <Plus />
                                    </Button>
                                  }
                                  title="Restore chapter?"
                                  description="Restore this chapter to its previous status?"
                                  confirmLabel="Restore"
                                  onConfirm={() => void restoreChapter(chapter)}
                                />
                                <ConfirmationDialog
                                  trigger={
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                      aria-label="Delete chapter permanently"
                                    >
                                      <Trash2 />
                                    </Button>
                                  }
                                  title="Delete chapter permanently?"
                                  description="This action cannot be undone. The chapter and its content will be permanently deleted."
                                  confirmLabel="Delete permanently"
                                  destructive
                                  onConfirm={() =>
                                    void permanentlyDeleteChapter(chapter)
                                  }
                                />
                              </>
                            ) : tab === "draft" ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Move draft to trash"
                                onClick={() => void softDeleteChapter(chapter)}
                              >
                                <Trash2 />
                              </Button>
                            ) : (
                              <ConfirmationDialog
                                trigger={
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Move chapter to trash"
                                  >
                                    <Trash2 />
                                  </Button>
                                }
                                title="Move chapter to trash?"
                                description="This chapter will be moved to Trash and hidden from readers."
                                confirmLabel="Move to trash"
                                destructive
                                onConfirm={() =>
                                  void softDeleteChapter(chapter)
                                }
                              />
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </RimoraShell>
  );
};

export default NovelWorkspace;
