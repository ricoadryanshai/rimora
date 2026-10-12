import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Compass } from "lucide-react";
import { RimoraShell } from "@/components/RimoraShell";
import { NovelListCard } from "@/components/NovelListCard";
import { ViewModeToggle, type ViewMode } from "@/components/ViewModeToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { EXPLORE_PAGE_SIZE, fetchPublishedNovels } from "@/lib/published-novels";

const Explore = () => {
  const { user, loading: authLoading } = useAuth();
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    window.localStorage.getItem("rimora-explore-view") === "list" ? "list" : "grid",
  );
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ["published-novels", user?.id ?? "public", page],
    queryFn: () => fetchPublishedNovels(page),
    enabled: !authLoading,
    retry: 1,
  });
  const totalPages = Math.ceil((data?.total ?? 0) / EXPLORE_PAGE_SIZE);

  return (
  <RimoraShell>
    <div className="page-container max-w-6xl space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
          <Compass className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            The public shelf
          </p>
          <h1 className="font-display text-4xl font-semibold">Explore</h1>
        </div>
        </div>
        <ViewModeToggle value={viewMode} onChange={setViewMode} storageKey="rimora-explore-view" />
      </header>
      {isPending ? (
        <p role="status" className="text-sm text-muted-foreground">Loading published novels...</p>
      ) : isError ? (
        <div role="alert" className="rounded-sm border bg-card/60 p-6 space-y-3">
          <h2 className="font-display text-xl font-semibold">Could not load novels</h2>
          <p className="text-sm text-muted-foreground">The story shelf could not be reached. Please check your connection and try again.</p>
          <Button onClick={() => void refetch()} disabled={isFetching}>{isFetching ? "Retrying..." : "Try again"}</Button>
        </div>
      ) : data.novels.length === 0 ? (
        <div className="rounded-sm border bg-card/60 p-8 text-center space-y-3">
          <h2 className="font-display text-xl font-semibold">No published novels yet</h2>
          <p className="text-sm text-muted-foreground">Published stories will appear here when they are available.</p>
          {page > 0 && <Button onClick={() => setPage(0)}>Back to first page</Button>}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{data.total} published {data.total === 1 ? "novel" : "novels"}</p>
          <div className={viewMode === "grid" ? "grid grid-cols-2 gap-5 lg:grid-cols-3 xl:grid-cols-4" : "space-y-3"}>
            {data.novels.map((novel) => {
              const title = novel.novel_type === "Translation" && novel.translation_title?.trim() ? novel.translation_title : novel.title;
              const typeBadgeClass = novel.novel_type === "Translation"
                ? "bg-sky-600 text-white"
                : novel.novel_type === "Fanfic" ? "bg-fuchsia-600 text-white" : "bg-emerald-600 text-white";
              if (viewMode === "list") return (
              <NovelListCard
                key={novel.id}
                title={title}
                synopsis={novel.description}
                novelType={novel.novel_type}
                coverUrl={novel.cover_url}
                metadata={novel.status}
                href={`/novels/${novel.id}`}
              />
              );
              return (
                <Link key={novel.id} to={`/novels/${novel.id}`} className="overflow-hidden rounded-sm border bg-card/60 transition-shadow hover:shadow-lg">
                  <div className="relative aspect-[3/4] bg-muted">
                    <span className={`absolute left-3 top-3 z-10 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${typeBadgeClass}`}>{novel.novel_type}</span>
                    {novel.cover_url ? (
                      <img src={novel.cover_url} alt={`${title} cover`} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-muted-foreground"><BookOpen className="h-10 w-10" /></div>
                    )}
                  </div>
                  <div className="p-4">
                    <h2 className="line-clamp-2 font-display font-semibold">{title}</h2>
                    <p className="mt-2 text-xs capitalize text-muted-foreground">{novel.status}</p>
                  </div>
                </Link>
              );
            })}
          </div>
          {totalPages > 1 && (
            <nav aria-label="Novel pages" className="flex items-center justify-center gap-4">
              <Button variant="outline" disabled={page === 0 || isFetching} onClick={() => setPage((value) => value - 1)}>Previous</Button>
              <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <Button variant="outline" disabled={page + 1 >= totalPages || isFetching} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </nav>
          )}
        </>
      )}
    </div>
  </RimoraShell>
  );
};
export default Explore;
