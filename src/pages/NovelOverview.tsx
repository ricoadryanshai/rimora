import { createElement, useEffect, useState, type ReactNode } from "react";
import { Bookmark, BookOpen, Star } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ComingSoon } from "@/components/ComingSoon";
import { RimoraShell } from "@/components/RimoraShell";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Novel = {
  id: string;
  title: string;
  translation_title: string | null;
  novel_type: string;
  genre: string | null;
  author: string | null;
  translator: string | null;
  cover_url: string | null;
  description: string | null;
  chapters: { count: number }[];
};
type Chapter = {
  id: string;
  title: string;
  chapter_number: number;
  status: string;
  published_at: string | null;
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

const NovelOverview = () => {
  const { novelId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [novel, setNovel] = useState<Novel | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!novelId) return;
    void Promise.all([
      supabase
        .from("novels")
        .select(
          "id,title,translation_title,novel_type,genre,author,translator,cover_url,description,chapters(count)",
        )
        .eq("id", novelId)
        .maybeSingle(),
      supabase
        .from("chapters")
        .select("id,title,chapter_number,status,published_at")
        .eq("novel_id", novelId)
        .order("chapter_number", { ascending: true }),
    ]).then(([novelResult, chaptersResult]) => {
      setNovel(novelResult.data as unknown as Novel | null);
      setChapters((chaptersResult.data ?? []) as Chapter[]);
      setLoading(false);
    });
  }, [novelId]);
  useEffect(() => {
    if (!user || !novelId) {
      setIsBookmarked(false);
      return;
    }
    void supabase
      .from("library_entries")
      .select("id")
      .eq("user_id", user.id)
      .eq("novel_id", novelId)
      .eq("entry_type", "saved")
      .maybeSingle()
      .then(({ data }) => setIsBookmarked(Boolean(data)));
  }, [novelId, user]);
  const toggleBookmark = async () => {
    if (!user) {
      toast({
        title: "Sign in to bookmark",
        description: "Log in to save this novel to your library.",
      });
      return;
    }
    if (!novelId || bookmarking) return;
    setBookmarking(true);
    const result = isBookmarked
      ? await supabase
          .from("library_entries")
          .delete()
          .eq("user_id", user.id)
          .eq("novel_id", novelId)
          .eq("entry_type", "saved")
      : await supabase
          .from("library_entries")
          .insert({ user_id: user.id, novel_id: novelId, entry_type: "saved" });
    if (result.error)
      toast({
        title: "Could not update bookmark",
        description: result.error.message,
        variant: "destructive",
      });
    else {
      setIsBookmarked(!isBookmarked);
      toast({
        title: isBookmarked ? "Removed from library" : "Added to library",
      });
    }
    setBookmarking(false);
  };
  if (loading)
    return (
      <RimoraShell>
        <div className="page-container max-w-5xl">
          <ComingSoon
            title="Loading novel"
            description="Preparing this story's details..."
          />
        </div>
      </RimoraShell>
    );
  if (!novel)
    return (
      <RimoraShell>
        <div className="page-container max-w-5xl">
          <ComingSoon
            title="Novel not found"
            description="This story could not be found or is no longer available."
          />
        </div>
      </RimoraShell>
    );
  const title =
    novel.novel_type === "Translation" && novel.translation_title?.trim()
      ? novel.translation_title
      : novel.title;
  const visibleChapters = chapters.filter(
    (chapter) => chapter.status !== "draft",
  );
  const chapterCount = visibleChapters.length;
  const averageRating = 0;
  const ratingCount = 0;
  const typeBadgeClass =
    novel.novel_type === "Translation"
      ? "bg-sky-600 text-white"
      : novel.novel_type === "Fanfic"
        ? "bg-fuchsia-600 text-white"
        : "bg-emerald-600 text-white";
  return (
    <RimoraShell>
      <div className="page-container max-w-5xl space-y-8">
        <Card>
          <CardContent className="flex flex-col gap-8 p-6 md:flex-row md:gap-10">
            <div className="mx-auto w-full max-w-[260px] shrink-0 md:mx-0">
              <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted">
                <span
                  className={`absolute left-3 top-3 z-10 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${typeBadgeClass}`}
                >
                  {novel.novel_type}
                </span>
                {novel.cover_url ? (
                  <img
                    src={novel.cover_url}
                    alt={`${title} cover`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-muted-foreground">
                    <BookOpen className="h-14 w-14" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div>
                <h1 className="font-display text-4xl font-semibold tracking-tight">
                  {title}
                </h1>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  <span>{novel.genre || "Genre not set"}</span>
                  <span>
                    {chapterCount} {chapterCount === 1 ? "chapter" : "chapters"}
                  </span>
                  <span>0 views</span>
                </div>
                <p className="mt-5 text-sm text-muted-foreground">
                  By{" "}
                  <span className="font-medium text-foreground">
                    {novel.author || "Author not set"}
                  </span>
                </p>
                {novel.novel_type === "Translation" && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Translated by{" "}
                    <span className="font-medium text-foreground">
                      {novel.translator || "Translator not set"}
                    </span>
                  </p>
                )}
                <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <div
                    className="flex items-center gap-0.5"
                    aria-label={`${averageRating.toFixed(1)} out of 5 stars`}
                    role="img"
                  >
                    {[0, 1, 2, 3, 4].map((star) => (
                      <span key={star} className="relative h-5 w-5">
                        <Star className="absolute h-5 w-5 text-muted-foreground/40" />
                        <span
                          className="absolute inset-0 overflow-hidden"
                          style={{
                            width: `${Math.max(0, Math.min(1, averageRating - star)) * 100}%`,
                          }}
                        >
                          <Star className="h-5 w-5 fill-current text-primary" />
                        </span>
                      </span>
                    ))}
                  </div>
                  <span className="font-medium text-foreground">
                    {averageRating.toFixed(1)}
                  </span>
                  <span>({ratingCount.toLocaleString()} ratings)</span>
                </div>
              </div>
              <div className="mt-8 flex gap-3">
                <Button className="flex-1" asChild>
                  <Link to={`/novels/${novel.id}/read${visibleChapters[0] ? `?chapter=${visibleChapters[0].id}` : ""}`}>
                    Read <BookOpen />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => void toggleBookmark()}
                  disabled={bookmarking}
                >
                  <Bookmark
                    className={isBookmarked ? "fill-current" : undefined}
                  />{" "}
                  {isBookmarked ? "Saved" : "Bookmark"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Tabs defaultValue="about" className="space-y-6">
          <TabsList className="grid h-auto w-full grid-cols-2 border-b border-border bg-transparent p-0">
            <TabsTrigger
              value="about"
              className="rounded-none border-b-2 border-transparent px-3 py-3 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              About
            </TabsTrigger>
            <TabsTrigger
              value="contents"
              className="rounded-none border-b-2 border-transparent px-3 py-3 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Table of contents
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="about"
            className="space-y-3 text-sm leading-7 text-muted-foreground"
          >
            <h2 className="font-display text-lg font-semibold text-foreground">
              Synopsis
            </h2>
            <div className="[&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:font-display [&_h4]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-3 [&_ul]:list-disc">
              {novel.description ? (
                <RichText content={novel.description} />
              ) : (
                "No description has been added yet."
              )}
            </div>
          </TabsContent>
          <TabsContent value="contents" className="space-y-2">
            {visibleChapters.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No chapters have been published yet.
              </p>
            ) : (
              visibleChapters.map((chapter) => (
                <Link
                  key={chapter.id}
                  to={`/novels/${novel.id}/read?chapter=${chapter.id}`}
                  className="flex items-center justify-between border-b border-border py-3 transition-colors hover:bg-muted/50"
                >
                  <span>
                    Chapter {chapter.chapter_number}: {chapter.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {chapter.published_at
                      ? `Published ${new Date(chapter.published_at).toLocaleString()}`
                      : chapter.status}
                  </span>
                </Link>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </RimoraShell>
  );
};
export default NovelOverview;
