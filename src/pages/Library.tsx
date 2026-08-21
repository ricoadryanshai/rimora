import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Library as LibraryIcon } from "lucide-react";
import { ComingSoon } from "@/components/ComingSoon";
import { RimoraShell } from "@/components/RimoraShell";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type NovelCard = {
  id: string;
  title: string;
  translation_title: string | null;
  novel_type: string;
  cover_url: string | null;
  chapters: { count: number }[];
};

const Library = () => {
  const { user } = useAuth();
  const [novels, setNovels] = useState<NovelCard[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setNovels([]);
      return;
    }
    setLoading(true);
    void supabase
      .from("novels")
      .select("id,title,translation_title,novel_type,cover_url,chapters(count)")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error("Failed to load novels:", error);
          setNovels([]);
        } else {
          setNovels((data ?? []) as unknown as NovelCard[]);
        }
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
        <Tabs defaultValue="my-novels" className="space-y-6">
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl bg-muted/70 p-1">
            <TabsTrigger value="my-novels" className="rounded-lg py-2.5">
              My Novels
            </TabsTrigger>
            <TabsTrigger value="bookmark" className="rounded-lg py-2.5">
              Bookmark
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg py-2.5">
              History
            </TabsTrigger>
          </TabsList>
          <TabsContent value="my-novels">
            {loading ? (
              <Card>
                <CardContent className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
                  Loading your novels...
                </CardContent>
              </Card>
            ) : novels.length === 0 ? (
              <ComingSoon
                title="Your novels are on the way"
                description="Create a novel and it will appear here in your personal writing workspace."
              />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {novels.map((novel) => {
                  const displayTitle =
                    novel.novel_type === "Translation" &&
                    novel.translation_title?.trim()
                      ? novel.translation_title
                      : novel.title;
                  const chapterCount = novel.chapters?.[0]?.count ?? 0;
                  return (
                    <Card
                      key={novel.id}
                      className="group cursor-pointer overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                    >
                      <Link to={`/novels/${novel.id}`} className="block">
                      <div className="aspect-[3/4] overflow-hidden bg-muted">
                        {novel.cover_url ? (
                          <img
                            src={novel.cover_url}
                            alt={`${displayTitle} cover`}
                            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                          />
                        ) : (
                          <div className="grid h-full place-items-center text-muted-foreground transition-transform duration-300 group-hover:scale-105">
                            <BookOpen className="h-10 w-10" />
                          </div>
                        )}
                      </div>
                      <CardContent className="space-y-2 p-4">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="line-clamp-2 min-h-12 cursor-help font-display font-semibold">
                              {displayTitle}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent>{displayTitle}</TooltipContent>
                        </Tooltip>
                        <p className="text-sm text-muted-foreground">
                          {chapterCount}{" "}
                          {chapterCount === 1 ? "chapter" : "chapters"}
                        </p>
                      </CardContent>
                      </Link>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
          <TabsContent value="bookmark">
            <ComingSoon
              title="Bookmarks are coming soon"
              description="Save stories from across Rimora and find them here when bookmarks are ready."
            />
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
