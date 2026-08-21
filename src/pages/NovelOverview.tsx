import { useEffect, useState } from "react";
import { Bookmark, BookOpen, ChevronLeft, Star } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ComingSoon } from "@/components/ComingSoon";
import { RimoraShell } from "@/components/RimoraShell";
import { supabase } from "@/integrations/supabase/client";

type Novel = { id: string; title: string; translation_title: string | null; novel_type: string; genre: string | null; author: string | null; translator: string | null; cover_url: string | null; description: string | null; chapters: { count: number }[] };

const NovelOverview = () => {
	const { novelId } = useParams();
	const [novel, setNovel] = useState<Novel | null>(null);
	const [loading, setLoading] = useState(true);
	useEffect(() => { if (!novelId) return; void supabase.from("novels").select("id,title,translation_title,novel_type,genre,author,translator,cover_url,description,chapters(count)").eq("id", novelId).maybeSingle().then(({ data }) => { setNovel(data as unknown as Novel | null); setLoading(false); }); }, [novelId]);
	if (loading) return <RimoraShell><div className="page-container max-w-5xl"><ComingSoon title="Loading novel" description="Preparing this story's details..." /></div></RimoraShell>;
	if (!novel) return <RimoraShell><div className="page-container max-w-5xl"><ComingSoon title="Novel not found" description="This story could not be found or is no longer available." /></div></RimoraShell>;
	const title = novel.novel_type === "Translation" && novel.translation_title?.trim() ? novel.translation_title : novel.title;
	const chapters = novel.chapters?.[0]?.count ?? 0;
	return <RimoraShell><div className="page-container max-w-5xl space-y-8"><Button variant="ghost" size="sm" asChild><Link to="/library"><ChevronLeft /> Back to Library</Link></Button><Card><CardContent className="flex flex-col gap-8 p-6 md:flex-row md:gap-10"><div className="mx-auto w-full max-w-[260px] shrink-0 md:mx-0"><div className="aspect-[3/4] overflow-hidden rounded-xl bg-muted">{novel.cover_url ? <img src={novel.cover_url} alt={`${title} cover`} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-muted-foreground"><BookOpen className="h-14 w-14" /></div>}</div></div><div className="flex min-w-0 flex-1 flex-col"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{novel.novel_type}</p><h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">{title}</h1><div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground"><span>{novel.genre || "Genre not set"}</span><span>{chapters} {chapters === 1 ? "chapter" : "chapters"}</span><span>0 views</span></div><p className="mt-5 text-sm text-muted-foreground">By <span className="font-medium text-foreground">{novel.author || "Author not set"}</span></p>{novel.novel_type === "Translation" && <p className="mt-2 text-sm text-muted-foreground">Translated by <span className="font-medium text-foreground">{novel.translator || "Translator not set"}</span></p>}<div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><span className="flex items-center gap-1 text-primary"><Star className="h-4 w-4 fill-current" /> 0.0</span><span>(0 ratings)</span></div><p className="mt-6 whitespace-pre-line text-sm leading-7 text-muted-foreground">{novel.description || "No synopsis has been added yet."}</p></div><div className="mt-8 flex gap-3"><Button className="flex-1" asChild><Link to={`/novels/${novel.id}/read`}>Read <BookOpen /></Link></Button><Button variant="outline" className="flex-1"><Bookmark /> Bookmark</Button></div></div></CardContent></Card></div></RimoraShell>;
};
export default NovelOverview;