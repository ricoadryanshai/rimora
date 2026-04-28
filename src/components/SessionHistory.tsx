import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CopyPlus, FolderOpen, History, MoreVertical, Pencil, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import {
  ChapterSession,
  deleteChapterSession,
  duplicateChapterSession,
  getSessionTitle,
  listChapterSessions,
  normalizeCards,
  renameChapterSession,
} from "@/lib/sessions";

interface SessionHistoryProps {
  userId: string | null;
  currentSessionId: string | null;
  refreshKey: number;
  onOpenSession: (session: ChapterSession) => void;
  onDeletedCurrent: () => void;
}

const SessionHistory: React.FC<SessionHistoryProps> = ({
  userId,
  currentSessionId,
  refreshKey,
  onOpenSession,
  onDeletedCurrent,
}) => {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<ChapterSession[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const loadSessions = useCallback(async () => {
    if (!userId) {
      setSessions([]);
      return;
    }

    setIsLoading(true);
    try {
      setSessions(await listChapterSessions(userId));
    } catch (error) {
      toast({
        title: "Could not load sessions",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, userId]);

  useEffect(() => {
    if (open) {
      loadSessions();
    }
  }, [open, userId, refreshKey]);

  const filteredSessions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return sessions;

    return sessions.filter((session) =>
      getSessionTitle(session).toLowerCase().includes(normalizedQuery) ||
      session.original_text.toLowerCase().includes(normalizedQuery)
    );
  }, [query, sessions]);

  const handleRename = async (session: ChapterSession) => {
    if (!userId) return;
    const title = window.prompt("Rename this session", getSessionTitle(session));
    if (!title?.trim()) return;

    try {
      const updated = await renameChapterSession(session.id, userId, title.slice(0, 100));
      setSessions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      toast({ title: "Session renamed", description: `"${getSessionTitle(updated)}" is ready.` });
    } catch (error) {
      toast({
        title: "Rename failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDuplicate = async (session: ChapterSession) => {
    if (!userId) return;

    try {
      const duplicated = await duplicateChapterSession(session, userId);
      setSessions((prev) => [duplicated, ...prev]);
      toast({ title: "Session duplicated", description: `"${getSessionTitle(duplicated)}" was created.` });
    } catch (error) {
      toast({
        title: "Duplicate failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (session: ChapterSession) => {
    if (!userId) return;
    const confirmed = window.confirm(`Delete "${getSessionTitle(session)}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await deleteChapterSession(session.id, userId);
      setSessions((prev) => prev.filter((item) => item.id !== session.id));
      if (session.id === currentSessionId) {
        onDeletedCurrent();
      }
      toast({ title: "Session deleted", description: "The saved session was removed." });
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const openSession = (session: ChapterSession) => {
    onOpenSession(session);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" disabled={!userId} className="min-h-[44px]">
          <History className="mr-2 h-4 w-4" />
          Sessions
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[88vh] overflow-hidden p-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:w-[420px] sm:max-w-[420px] sm:border-l">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-border p-4 text-left">
            <SheetTitle>Session History</SheetTitle>
            <SheetDescription>Open, rename, duplicate, or delete saved chapter work.</SheetDescription>
          </SheetHeader>

          <div className="border-b border-border p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search sessions"
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {!userId ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Sign in to save and reopen chapter sessions.
              </div>
            ) : isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-20 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No saved sessions found.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSessions.map((session) => {
                  const cards = normalizeCards(session.separated_cards);
                  const isActive = session.id === currentSessionId;

                  return (
                    <div
                      key={session.id}
                      className={`rounded-lg border bg-card p-3 shadow-sm ${isActive ? "border-primary" : "border-border"}`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => openSession(session)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-semibold text-foreground">
                              {getSessionTitle(session)}
                            </h3>
                            {isActive && <Badge variant="secondary" className="shrink-0 text-xs">Open</Badge>}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(session.updated_at).toLocaleString()}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline">{cards.length} cards</Badge>
                            <Badge variant="outline">{session.separation_mode || "paragraph"}</Badge>
                          </div>
                        </button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openSession(session)}>
                              <FolderOpen className="mr-2 h-4 w-4" />
                              Open
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleRename(session)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(session)}>
                              <CopyPlus className="mr-2 h-4 w-4" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(session)} className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SessionHistory;
