import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Library as LibraryIcon } from "lucide-react";
import { ComingSoon } from "@/components/ComingSoon";
import { RimoraShell } from "@/components/RimoraShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type SavedNovel = {
  id: string;
  title: string;
  translation_title: string | null;
  novel_type: string;
  cover_url: string | null;
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
  useEffect(() => {
    if (!user) {
      setSavedNovels([]);
      setLoading(false);
      return;
    }
    void supabase
      .from("library_entries")
      .select(
        "novels(id,title,translation_title,novel_type,cover_url,chapters(count))",
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
        <header className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <LibraryIcon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Your reading space
            </p>
            <h1 className="font-display text-4xl font-semibold">Library</h1>
          </div>
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
              <p className="text-sm text-muted-foreground">
                Loading bookmarks...
              </p>
            ) : savedNovels.length === 0 ? (
              <ComingSoon
                title="No bookmarks yet"
                description="Save stories from across Rimora and find them here."
              />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {savedNovels.map((novel) => {
                  const title =
                    novel.novel_type === "Translation" &&
                    novel.translation_title?.trim()
                      ? novel.translation_title
                      : novel.title;
                  const typeBadgeClass =
                    novel.novel_type === "Translation"
                      ? "bg-sky-600 text-white"
                      : novel.novel_type === "Fanfic"
                        ? "bg-fuchsia-600 text-white"
                        : "bg-emerald-600 text-white";
                  const progress = readingProgress.find(
                    (entry) => entry.novel_id === novel.id,
                  );
                  const chapterNumber = progress
                    ? chapterNumbers.find(
                        (chapter) => chapter.id === progress.chapter_id,
                      )?.chapter_number
                    : undefined;
                  const totalChapters = novel.chapters?.[0]?.count ?? 0;
                  return (
                    <Link
                      key={novel.id}
                      to={`/novels/${novel.id}`}
                      className="overflow-hidden rounded-sm border bg-card/60 transition-shadow hover:shadow-lg"
                    >
                      <div className="relative aspect-[3/4] bg-muted">
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
                            <BookOpen />
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h2 className="line-clamp-2 font-display font-semibold">
                          {title}
                        </h2>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {chapterNumber
                            ? `Last read: Chapter ${chapterNumber} of ${totalChapters}`
                            : "Not started"}
                        </p>
                      </div>
                    </Link>
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
