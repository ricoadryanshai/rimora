import { useEffect, useState } from "react";
import { Library as LibraryIcon } from "lucide-react";
import { ComingSoon } from "@/components/ComingSoon";
import { RimoraShell } from "@/components/RimoraShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ViewModeToggle, type ViewMode } from "@/components/ViewModeToggle";
import { NovelListCard } from "@/components/NovelListCard";
import { NovelGridCard, NovelGridSkeleton } from "@/components/NovelGridCard";

type SavedNovel = {
  id: string;
  title: string;
  translation_title: string | null;
  novel_type: string;
  cover_url: string | null;
  description: string | null;
  chapters: { count: number }[];
};
type ReadingProgress = { novel_id: string; chapter_id: string };
type ChapterNumber = { id: string; chapter_number: number };

const Library = () => {
  const { user } = useAuth();
  const [savedNovels, setSavedNovels] = useState<SavedNovel[]>([]);
  const [readingProgress, setReadingProgress] = useState<ReadingProgress[]>([]);
  const [chapterNumbers, setChapterNumbers] = useState<ChapterNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = window.localStorage.getItem("rimora-library-view");
    return saved === "list" ? "list" : "grid";
  });
  useEffect(() => {
    if (!user) {
      setSavedNovels([]);
      setLoading(false);
      return;
    }
    void supabase
      .from("library_entries")
      .select(
        "novels(id,title,translation_title,novel_type,cover_url,description,chapters(count))",
      )
      .eq("user_id", user.id)
      .eq("entry_type", "saved")
      .order("created_at", { ascending: false })
      .then(async ({ data }) => {
        const novels = (data ?? []).flatMap((entry) =>
          entry.novels ? [entry.novels as unknown as SavedNovel] : [],
        );
        const novelIds = novels.map((novel) => novel.id);
        const { data: progressData } = novelIds.length
          ? await supabase
              .from("reading_progress")
              .select("novel_id,chapter_id")
              .eq("user_id", user.id)
              .in("novel_id", novelIds)
          : { data: [] as ReadingProgress[] };
        const chapterIds = (progressData ?? []).map(
          (progress) => progress.chapter_id,
        );
        const { data: chapterData } = chapterIds.length
          ? await supabase
              .from("chapters")
              .select("id,chapter_number")
              .in("id", chapterIds)
          : { data: [] as ChapterNumber[] };
        setSavedNovels(novels);
        setReadingProgress((progressData ?? []) as ReadingProgress[]);
        setChapterNumbers((chapterData ?? []) as ChapterNumber[]);
        setLoading(false);
      });
  }, [user]);
  return (
    <RimoraShell>
      <div className="page-container max-w-6xl space-y-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
              <LibraryIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Your reading space
              </p>
              <h1 className="font-display text-4xl font-semibold">Library</h1>
            </div>
          </div>
          <ViewModeToggle value={viewMode} onChange={setViewMode} storageKey="rimora-library-view" />
        </header>
        <Tabs defaultValue="bookmark" className="space-y-6">
          <TabsList className="grid h-auto w-full grid-cols-2 border-b border-border bg-transparent p-0">
            <TabsTrigger
              value="bookmark"
              className="rounded-none border-b-2 border-transparent px-3 py-3 text-muted-foreground shadow-none transition-colors data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Bookmark
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="rounded-none border-b-2 border-transparent px-3 py-3 text-muted-foreground shadow-none transition-colors data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              History
            </TabsTrigger>
          </TabsList>
          <TabsContent value="bookmark">
            {loading ? (
              <NovelGridSkeleton />
            ) : savedNovels.length === 0 ? (
              <ComingSoon
                title="No bookmarks yet"
                description="Save stories from across Rimora and find them here."
              />
            ) : (
              <div className={viewMode === "grid" ? "grid grid-cols-2 gap-5 lg:grid-cols-3 xl:grid-cols-4" : "space-y-3"}>
                {savedNovels.map((novel) => {
                  const title =
                    novel.novel_type === "Translation" &&
                    novel.translation_title?.trim()
                      ? novel.translation_title
                      : novel.title;
                  const progress = readingProgress.find(
                    (entry) => entry.novel_id === novel.id,
                  );
                  const chapterNumber = progress
                    ? chapterNumbers.find(
                        (chapter) => chapter.id === progress.chapter_id,
                      )?.chapter_number
                    : undefined;
                  const totalChapters = novel.chapters?.[0]?.count ?? 0;
                  if (viewMode === "list")
                    return (
                      <NovelListCard
                        key={novel.id}
                        title={title}
                        synopsis={novel.description}
                        novelType={novel.novel_type}
                        coverUrl={novel.cover_url}
                        metadata={chapterNumber ? `Last read: Chapter ${chapterNumber} of ${totalChapters}` : "Not started"}
                        href={`/novels/${novel.id}`}
                      />
                    );
                  return (
                    <NovelGridCard
                      key={novel.id}
                      to={`/novels/${novel.id}`}
                      title={title}
                      novelType={novel.novel_type}
                      coverUrl={novel.cover_url}
                      subtitle={
                        chapterNumber
                          ? `Last read: Chapter ${chapterNumber} of ${totalChapters}`
                          : "Not started"
                      }
                      progress={
                        chapterNumber && totalChapters
                          ? chapterNumber / totalChapters
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            )}
          </TabsContent>
          <TabsContent value="history">
            <ComingSoon
              title="Reading history is coming"
              description="Your recently opened stories and reading progress will appear here in a future update."
            />
          </TabsContent>
        </Tabs>
      </div>
    </RimoraShell>
  );
};

export default Library;
