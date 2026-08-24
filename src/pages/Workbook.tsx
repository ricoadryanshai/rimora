import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Eye, Globe, Languages, Link as LinkIcon, Pencil, Search, Settings, Sparkles, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import RichTextEditor from "@/components/RichTextEditor";
import { RimoraShell } from "@/components/RimoraShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import UrlImport from "@/components/UrlImport";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import type { WordReplacementInput } from "@/lib/word-replacements-csv";

const hasRichText = (value: string) => value.replace(/<[^>]*>/g, "").trim().length > 0;
type GlossaryEntry = { id: string; source_term: string; preferred_term: string };

const Workbook = () => {
	const { novelId } = useParams();
	const [searchParams] = useSearchParams();
	const editingChapterId = searchParams.get("chapter");
	const { user } = useAuth();
	const navigate = useNavigate();
	const { toast } = useToast();
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [authorThoughts, setAuthorThoughts] = useState("");
	const [chapterNumber, setChapterNumber] = useState<number | null>(null);
	const [latestChapterTitle, setLatestChapterTitle] = useState<string | null>(null);
	const [latestChapterNumber, setLatestChapterNumber] = useState<number | null>(null);
	const [novelTitle, setNovelTitle] = useState("Untitled novel");
	const [novelAbbreviation, setNovelAbbreviation] = useState("Workspace");
	const [novelType, setNovelType] = useState("");
	const [originalLanguage, setOriginalLanguage] = useState("");
	const [translationLanguage, setTranslationLanguage] = useState("");
	const [authorUsername, setAuthorUsername] = useState("Author");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [editingChapter, setEditingChapter] = useState(false);
	const [importOpen, setImportOpen] = useState(false);
	const [glossaryOpen, setGlossaryOpen] = useState(false);
	const [previewOpen, setPreviewOpen] = useState(false);
	const [translateOpen, setTranslateOpen] = useState(false);
	const [translating, setTranslating] = useState(false);
	const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
	const [glossaryEntries, setGlossaryEntries] = useState<GlossaryEntry[]>([]);
	const [originalTerm, setOriginalTerm] = useState("");
	const [translatedTerm, setTranslatedTerm] = useState("");
	const [editingGlossaryId, setEditingGlossaryId] = useState<string | null>(null);
	const [editingOriginal, setEditingOriginal] = useState("");
	const [editingTranslated, setEditingTranslated] = useState("");
	const [glossarySearch, setGlossarySearch] = useState("");
	const [glossaryAiLoading, setGlossaryAiLoading] = useState(false);
	const [selectedGlossaryIds, setSelectedGlossaryIds] = useState<string[]>([]);
	const [glossaryPage, setGlossaryPage] = useState(1);
	const glossaryPageSize = 5;
	const filteredGlossaryEntries = glossaryEntries.filter((entry) => {
		const query = glossarySearch.trim().toLocaleLowerCase();
		return !query || entry.source_term.toLocaleLowerCase().includes(query) || entry.preferred_term.toLocaleLowerCase().includes(query);
	}).sort((left, right) => right.source_term.length - left.source_term.length);
	const glossaryPageCount = Math.max(1, Math.ceil(filteredGlossaryEntries.length / glossaryPageSize));
	const visibleGlossaryEntries = filteredGlossaryEntries.slice((glossaryPage - 1) * glossaryPageSize, glossaryPage * glossaryPageSize);
	const canSave = hasRichText(content) && chapterNumber !== null;
	const contentText = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
	const contentCharacters = contentText.length;
	const contentLines = contentText ? content.split(/<br\s*\/?>|\n/i).filter((line) => line.replace(/<[^>]*>/g, "").trim()).length : 0;
	const contentParagraphs = contentText ? (content.match(/<p\b[^>]*>/gi)?.length ?? content.split(/\n\s*\n/).filter((paragraph) => paragraph.trim()).length) : 0;

	useEffect(() => {
		if (!novelId || !user) return;
		void Promise.all([
			supabase.from("novels").select("title,abbreviation,novel_type,language,translation_language").eq("id", novelId).eq("owner_id", user.id).maybeSingle(),
			supabase.from("chapters").select("chapter_number,title").eq("novel_id", novelId).is("deleted_at", null).order("chapter_number", { ascending: false }).limit(1),
			supabase.from("profiles").select("username").eq("id", user.id).maybeSingle(),
		]).then(([novelResult, chaptersResult, profileResult]) => {
			if (novelResult.data?.title) setNovelTitle(novelResult.data.title);
			if (novelResult.data?.abbreviation) setNovelAbbreviation(novelResult.data.abbreviation);
			setNovelType(novelResult.data?.novel_type ?? "");
			setOriginalLanguage(novelResult.data?.language ?? "");
			setTranslationLanguage(novelResult.data?.translation_language ?? "");
			setAuthorUsername(profileResult.data?.username || user.user_metadata?.full_name || user.email?.split("@")[0] || "Author");
			const latestVisibleNumber = chaptersResult.data?.[0]?.chapter_number ?? 0;
			setLatestChapterTitle(chaptersResult.data?.[0]?.title ?? null);
			setLatestChapterNumber(latestVisibleNumber || null);
			setChapterNumber(latestVisibleNumber + 1);
			setLoading(false);
		});
		if (editingChapterId) {
			void supabase.from("chapters").select("id,title,chapter_number,content,author_thoughts,status").eq("id", editingChapterId).eq("novel_id", novelId).maybeSingle().then(({ data }) => {
				if (!data) return;
				setTitle(data.title === `Chapter ${data.chapter_number}` ? "" : data.title);
				setChapterNumber(data.chapter_number);
				setContent(data.content ?? "");
				setAuthorThoughts(data.author_thoughts ?? "");
				setEditingChapter(true);
			});
		}
		void supabase.from("glossary_entries").select("id,source_term,preferred_term").eq("novel_id", novelId).order("created_at", { ascending: true }).then(({ data }) => setGlossaryEntries((data ?? []) as GlossaryEntry[]));
	}, [novelId, user, editingChapterId]);

	const addGlossaryEntry = async () => {
		if (!novelId || !user || !originalTerm.trim() || !translatedTerm.trim()) return;
		if (originalTerm.trim().length < 2 || originalTerm.trim().length > 6) {
			toast({ title: "Original term length is invalid", description: "Original terms must contain between 2 and 6 characters.", variant: "destructive" });
			return;
		}
		const normalizedOriginal = originalTerm.trim().toLocaleLowerCase();
		if (glossaryEntries.some((entry) => entry.source_term.trim().toLocaleLowerCase() === normalizedOriginal)) {
			toast({
				title: "Original term already exists",
				description: `“${originalTerm.trim()}” is already in this novel's glossary.`,
				variant: "destructive",
			});
			return;
		}
		const { data, error } = await supabase.from("glossary_entries").insert({ owner_id: user.id, novel_id: novelId, source_term: originalTerm.trim(), preferred_term: translatedTerm.trim() }).select("id,source_term,preferred_term").single();
		if (error) { toast({ title: "Could not add glossary entry", description: error.message, variant: "destructive" }); return; }
		setGlossaryEntries((current) => [...current, data as GlossaryEntry]);
		setOriginalTerm(""); setTranslatedTerm("");
	};
	const saveGlossaryEntry = async (entryId: string) => {
		if (!editingOriginal.trim() || !editingTranslated.trim()) return;
		if (editingOriginal.trim().length < 2 || editingOriginal.trim().length > 6) {
			toast({ title: "Original term length is invalid", description: "Original terms must contain between 2 and 6 characters.", variant: "destructive" });
			return;
		}
		const { error } = await supabase.from("glossary_entries").update({ source_term: editingOriginal.trim(), preferred_term: editingTranslated.trim() }).eq("id", entryId);
		if (error) { toast({ title: "Could not update glossary entry", description: error.message, variant: "destructive" }); return; }
		setGlossaryEntries((current) => current.map((entry) => entry.id === entryId ? { ...entry, source_term: editingOriginal.trim(), preferred_term: editingTranslated.trim() } : entry));
		setEditingGlossaryId(null);
	};
	const deleteGlossaryEntry = async (entryId: string) => {
		const { error } = await supabase.from("glossary_entries").delete().eq("id", entryId);
		if (error) { toast({ title: "Could not delete glossary entry", description: error.message, variant: "destructive" }); return; }
		setGlossaryEntries((current) => current.filter((entry) => entry.id !== entryId));
		setSelectedGlossaryIds((current) => current.filter((id) => id !== entryId));
	};
	const deleteGlossaryEntries = async (entryIds: string[]) => {
		if (!entryIds.length) return;
		const { error } = await supabase.from("glossary_entries").delete().in("id", entryIds);
		if (error) { toast({ title: "Could not delete glossary entries", description: error.message, variant: "destructive" }); return; }
		setGlossaryEntries((current) => current.filter((entry) => !entryIds.includes(entry.id)));
		setSelectedGlossaryIds([]);
		toast({ title: "Glossary entries deleted", description: `${entryIds.length} entries permanently deleted.` });
	};
	const mergeGlossaryEntries = async (entries: WordReplacementInput[]) => {
		if (!novelId || !user) return;
		const existing = new Set(glossaryEntries.map((entry) => entry.source_term.trim().toLocaleLowerCase()));
		const unique = entries.filter((entry) => {
			const key = entry.original_word.trim().toLocaleLowerCase();
			if (!entry.original_word.trim() || !entry.replacement_word.trim() || entry.original_word.trim().length < 2 || entry.original_word.trim().length > 6 || existing.has(key)) return false;
			existing.add(key); return true;
		});
		if (!unique.length) { toast({ title: "No new glossary terms", description: "All imported original terms already exist or are invalid." }); return; }
		const { data, error } = await supabase.from("glossary_entries").insert(unique.map((entry) => ({ owner_id: user.id, novel_id: novelId, source_term: entry.original_word.trim(), preferred_term: entry.replacement_word.trim() }))).select("id,source_term,preferred_term");
		if (error) { toast({ title: "Glossary import failed", description: error.message, variant: "destructive" }); return; }
		setGlossaryEntries((current) => [...current, ...(data ?? []) as GlossaryEntry[]]);
		toast({ title: "Glossary imported", description: `${data?.length ?? 0} new terms added.` });
	};
	const extractGlossaryWithAi = async () => {
		if (!hasRichText(content)) { toast({ title: "Content required", description: "Fill the chapter content before using AI glossary extraction.", variant: "destructive" }); return; }
		setGlossaryAiLoading(true);
		try { const { data, error } = await supabase.functions.invoke("ai-glossary-extract", { body: { text: contentText, originalLanguage, translatedLanguage: novelType === "Translation" ? translationLanguage : originalLanguage } }); if (error) throw error; const entries = (data?.entries ?? []).map((entry: { original_word: string; replacement_word: string }) => ({ original_word: entry.original_word, replacement_word: entry.replacement_word })); await mergeGlossaryEntries(entries); } catch (error) { toast({ title: "AI extraction failed", description: error instanceof Error ? error.message : "Could not extract glossary terms.", variant: "destructive" }); } finally { setGlossaryAiLoading(false); }
	};
	const applyGlossary = () => {
		if (!glossaryEntries.length) { toast({ title: "Glossary is empty", description: "Add terms before applying the glossary." }); return; }
		let nextContent = content;
		for (const entry of glossaryEntries) nextContent = nextContent.split(entry.source_term).join(entry.preferred_term);
		setContent(nextContent); toast({ title: "Glossary applied", description: `${glossaryEntries.length} terms applied to the chapter content.` });
	};
	const translateChapter = async () => {
		if (!hasRichText(content)) { toast({ title: "Content required", description: "Add chapter content before translating.", variant: "destructive" }); return; }
		setTranslating(true);
		try {
			const lines = content.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "").split("\n");
			const { data, error } = await supabase.functions.invoke("ai-translate", { body: { lines, targetLanguage: translationLanguage || "English", originalLanguage: originalLanguage || "source language", contextLines: lines.slice(0, 10) } });
			if (error) throw error;
			if (!Array.isArray(data?.translations) || data.translations.length !== lines.length) throw new Error("Translation returned a different number of lines. Your content was not changed.");
			setContent(data.translations.map((line: string) => line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")).join("<br>"));
			setTranslateOpen(false);
			toast({ title: "Translation complete", description: `${lines.length} lines translated without changing their order.` });
		} catch (error) { toast({ title: "Translation failed", description: error instanceof Error ? error.message : "Could not translate the chapter.", variant: "destructive" }); } finally { setTranslating(false); }
	};
	useEffect(() => {
		setGlossaryPage((current) => Math.min(current, glossaryPageCount));
	}, [glossaryEntries.length, glossarySearch, glossaryPageCount]);

	const saveChapter = async (status: "draft" | "published") => {
		if (!novelId || !canSave) {
			toast({ title: "Chapter content required", description: "Add some content before saving this chapter." });
			return;
		}
		setSaving(true);
		const chapterPayload = {
			novel_id: novelId,
			title: title.trim() || `Chapter ${chapterNumber}`,
			chapter_number: chapterNumber,
			content,
			author_thoughts: authorThoughts,
			status,
			published_at: status === "published" ? new Date().toISOString() : null,
		};
		const result = editingChapterId
			? await supabase.from("chapters").update(chapterPayload).eq("id", editingChapterId).eq("novel_id", novelId).select("id").maybeSingle()
			: await supabase.from("chapters").insert(chapterPayload).select("id").maybeSingle();
		const error = result.error ?? (editingChapterId && !result.data ? new Error("The chapter could not be found for editing.") : null);
		setSaving(false);
		if (error) {
			toast({ title: "Could not save chapter", description: error.message, variant: "destructive" });
			return;
		}
		toast({ title: editingChapter ? "Chapter updated" : status === "published" ? "Chapter published" : "Draft saved" });
		navigate(`/workspace/${novelId}`);
	};

	if (loading) return <RimoraShell><div className="page-container max-w-5xl"><p className="text-sm text-muted-foreground">Loading workbook...</p></div></RimoraShell>;

	return (
		<RimoraShell>
			<div className="page-container max-w-6xl">
				<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
					<div className="min-w-0 space-y-6">
					<div className="flex items-center justify-between gap-4">
					<Button variant="ghost" size="sm" asChild>
						<Link to={`/workspace/${novelId}`}><ArrowLeft /> {novelAbbreviation}</Link>
					</Button>
					{latestChapterNumber !== null && (
						<p className="flex items-center gap-2 text-sm text-muted-foreground">
							<span className="rounded-sm bg-primary/10 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.05em] text-primary">Prev chapter</span>
							<span>Chapter {latestChapterNumber}: {latestChapterTitle ?? "-"}</span>
						</p>
					)}
					</div>
					<Card>
					<CardContent className="space-y-5 pt-6">
						<div className="space-y-2">
							<Label htmlFor="chapter-title">Chapter title</Label>
							<Input id="chapter-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Enter a chapter title" maxLength={200} />
						</div>
						<div className="space-y-2">
							<Label htmlFor="chapter-content">Content</Label>
							<RichTextEditor id="chapter-content" value={content} onChange={setContent} placeholder="Write your chapter here..." className="min-h-[420px] max-h-[640px] overflow-y-auto leading-7" />
							<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
								<span>{contentText ? contentText.split(" ").length.toLocaleString() : "0"} words</span>
								<span>{contentCharacters.toLocaleString()} characters</span>
								<span>{contentLines.toLocaleString()} lines</span>
								<span>{contentParagraphs.toLocaleString()} paragraphs</span>
							</div>
						</div>
						<div className="space-y-2">
							<Label htmlFor="author-thoughts">Author&apos;s thoughts</Label>
							<RichTextEditor id="author-thoughts" value={authorThoughts} onChange={setAuthorThoughts} placeholder="Share your thoughts about this chapter..." className="min-h-[180px]" />
						</div>
						<div className="flex flex-wrap justify-end gap-3 border-t border-border pt-5">
							<Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
								<DialogTrigger asChild><Button type="button" variant="outline"><Eye /> Preview</Button></DialogTrigger>
								<DialogContent className="h-screen w-screen max-w-none rounded-none border-0 p-0">
									<DialogHeader className="sr-only"><DialogTitle>Chapter preview</DialogTitle><DialogDescription>Preview this chapter before saving or publishing it.</DialogDescription></DialogHeader>
									<div className="h-full overflow-y-auto bg-background px-6 py-12 sm:px-12 lg:px-24">
										<div className="mx-auto max-w-3xl">
											<p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Chapter {chapterNumber ?? "-"}</p>
											<h1 className="mb-10 text-center font-display text-3xl font-semibold">{title.trim() || `Chapter ${chapterNumber ?? "-"}`}</h1>
											<div className="whitespace-pre-wrap text-base leading-8" dangerouslySetInnerHTML={{ __html: content }} />
													{hasRichText(authorThoughts) && (
														<section className="mt-12 border-t border-border pt-8">
															<div className="border-l-2 border-primary/50 pl-5 italic leading-8" dangerouslySetInnerHTML={{ __html: authorThoughts }} />
															<p className="mt-4 text-right text-sm font-medium text-muted-foreground">- {authorUsername}</p>
														</section>
													)}
										</div>
									</div>
								</DialogContent>
							</Dialog>
							<Button variant="outline" onClick={() => void saveChapter("draft")} disabled={saving || !canSave}><Save /> Save</Button>
							<Button onClick={() => void saveChapter("published")} disabled={saving || !canSave}><Globe /> Publish</Button>
						</div>
					</CardContent>
					</Card>
					<div className="flex items-center gap-2 text-sm text-muted-foreground"><BookOpen className="h-4 w-4" /> Your chapter will appear in the workspace after saving.</div>
					</div>
					<aside className="order-last hidden space-y-4 lg:sticky lg:top-6 lg:block">
						<Card>
							<CardContent className="space-y-4 p-5">
								<p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">Tools</p>
								<TooltipProvider>
									<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
											<Dialog open={importOpen} onOpenChange={setImportOpen}>
												<Tooltip>
													<TooltipTrigger asChild><Button type="button" variant="outline" size="icon" aria-label="Import chapter from webpage" onClick={() => setImportOpen(true)}><LinkIcon /></Button></TooltipTrigger>
													<TooltipContent>Import from webpage</TooltipContent>
												</Tooltip>
												<DialogContent className="max-w-2xl">
													<DialogHeader><DialogTitle>Import chapter from webpage</DialogTitle><DialogDescription>Fetch chapter content from a webpage and add it to the editor.</DialogDescription></DialogHeader>
													<UrlImport onContentReady={(scrapedContent) => { setContent(scrapedContent); setImportOpen(false); }} onTitleReady={() => undefined} />
												</DialogContent>
											</Dialog>
											<Dialog open={glossaryOpen} onOpenChange={setGlossaryOpen}>
												<Tooltip>
													<TooltipTrigger asChild><Button type="button" variant="outline" size="icon" aria-label="Open glossary" onClick={() => setGlossaryOpen(true)}><BookOpen /></Button></TooltipTrigger>
													<TooltipContent>Glossary</TooltipContent>
												</Tooltip>
													<DialogContent>
														<DialogHeader><DialogTitle>Glossary</DialogTitle><DialogDescription>Add original and translated terms for this novel.</DialogDescription></DialogHeader>
														<div className="space-y-4">
																<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
																	<div className="flex gap-2">
																		<Button type="button" variant="outline" size="sm" onClick={applyGlossary}><BookOpen /> Apply</Button>
																	</div>
																	<Button type="button" variant="outline" size="sm" onClick={() => void extractGlossaryWithAi()} disabled={glossaryAiLoading}><Sparkles /> {glossaryAiLoading ? "Extracting..." : "AI extract"}</Button>
																</div>
																	{glossaryEntries.length > 0 && <div className="flex justify-end gap-2"><ConfirmationDialog trigger={<Button type="button" variant="outline" size="sm" disabled={!selectedGlossaryIds.length}>Delete selected ({selectedGlossaryIds.length})</Button>} title="Delete selected glossary entries?" description={`This will permanently delete ${selectedGlossaryIds.length} selected entries.`} confirmLabel="Delete selected" destructive onConfirm={() => void deleteGlossaryEntries(selectedGlossaryIds)} /><ConfirmationDialog trigger={<Button type="button" variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive">Delete all</Button>} title="Delete all glossary entries?" description={`This will permanently delete all ${glossaryEntries.length} entries.`} confirmLabel="Delete all" destructive onConfirm={() => void deleteGlossaryEntries(glossaryEntries.map((entry) => entry.id))} /></div>}
															<div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
																		<div className="space-y-1"><Label htmlFor="glossary-original">Original term</Label><Input id="glossary-original" value={originalTerm} onChange={(event) => setOriginalTerm(event.target.value)} maxLength={6} /></div>
																<div className="space-y-1"><Label htmlFor="glossary-translated">Translated term</Label><Input id="glossary-translated" value={translatedTerm} onChange={(event) => setTranslatedTerm(event.target.value)} /></div>
																<Button type="button" onClick={() => void addGlossaryEntry()} disabled={!originalTerm.trim() || !translatedTerm.trim()}>Add</Button>
															</div>
															<div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={glossarySearch} onChange={(event) => { setGlossarySearch(event.target.value); setGlossaryPage(1); }} placeholder="Search glossary" className="pl-9" aria-label="Search glossary" /></div>
															<div className="max-h-64 overflow-y-auto rounded-sm border border-border">
																{glossaryEntries.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No glossary entries yet.</p> : visibleGlossaryEntries.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No matching glossary entries.</p> : visibleGlossaryEntries.map((entry) => editingGlossaryId === entry.id ? (
																	<div key={entry.id} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 border-b border-border p-3 last:border-0"><Input value={editingOriginal} onChange={(event) => setEditingOriginal(event.target.value)} aria-label="Edit original term" /><Input value={editingTranslated} onChange={(event) => setEditingTranslated(event.target.value)} aria-label="Edit translated term" /><div className="flex gap-1"><Button type="button" size="icon" aria-label="Save glossary edit" onClick={() => void saveGlossaryEntry(entry.id)}><Save /></Button><Button type="button" variant="ghost" size="icon" aria-label="Cancel glossary edit" onClick={() => setEditingGlossaryId(null)}><X /></Button></div></div>
																	) : <div key={entry.id} className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-2 border-b border-border p-3 last:border-0"><Checkbox checked={selectedGlossaryIds.includes(entry.id)} onCheckedChange={(checked) => setSelectedGlossaryIds((current) => checked ? [...current, entry.id] : current.filter((id) => id !== entry.id))} aria-label={`Select ${entry.source_term}`} /><span className="truncate text-sm">{entry.source_term}</span><span className="text-xs text-muted-foreground">{entry.source_term.length}</span><span className="truncate text-sm text-muted-foreground">{entry.preferred_term}</span><div className="flex gap-1"><Button type="button" variant="ghost" size="icon" aria-label="Edit glossary entry" onClick={() => { setEditingGlossaryId(entry.id); setEditingOriginal(entry.source_term); setEditingTranslated(entry.preferred_term); }}><Pencil /></Button><ConfirmationDialog trigger={<Button type="button" variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label="Delete glossary entry"><Trash2 /></Button>} title="Delete glossary entry?" description="This glossary entry will be permanently deleted." confirmLabel="Delete permanently" destructive onConfirm={() => void deleteGlossaryEntry(entry.id)} /></div></div>)}
															</div>
															{filteredGlossaryEntries.length > glossaryPageSize && <div className="flex items-center justify-between pt-2"><Button type="button" variant="ghost" size="icon" aria-label="Previous glossary page" onClick={() => setGlossaryPage((current) => Math.max(1, current - 1))} disabled={glossaryPage === 1}><ChevronLeft /></Button><span className="text-xs text-muted-foreground">Page {glossaryPage} of {glossaryPageCount}</span><Button type="button" variant="ghost" size="icon" aria-label="Next glossary page" onClick={() => setGlossaryPage((current) => Math.min(glossaryPageCount, current + 1))} disabled={glossaryPage === glossaryPageCount}><ChevronRight /></Button></div>}
														</div>
													</DialogContent>
											</Dialog>
										<Dialog open={translateOpen} onOpenChange={setTranslateOpen}>
											<Tooltip>
												<TooltipTrigger asChild><Button type="button" variant="outline" size="icon" aria-label="AI Translate" onClick={() => setTranslateOpen(true)} disabled={translating || !hasRichText(content)}><Languages /></Button></TooltipTrigger>
												<TooltipContent>AI Translate</TooltipContent>
											</Tooltip>
													<DialogContent>
														<DialogHeader><DialogTitle>Translate chapter?</DialogTitle><DialogDescription>Translate all {content.split(/<br\s*\/?>|\n/i).length} lines into {translationLanguage || "English"}. The original line order and count will be preserved.</DialogDescription></DialogHeader>
														<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setTranslateOpen(false)}>Cancel</Button><Button type="button" onClick={() => void translateChapter()} disabled={translating}><Languages /> {translating ? "Translating..." : "Translate"}</Button></div>
													</DialogContent>
										</Dialog>
									</div>
								</TooltipProvider>
							</CardContent>
						</Card>
					</aside>
				</div>
				<div className="fixed bottom-20 right-4 z-40 lg:hidden">
					<Popover open={mobileToolsOpen} onOpenChange={setMobileToolsOpen}>
						<PopoverTrigger asChild><Button type="button" variant="outline" size="icon" className="h-12 w-12 rounded-full bg-background shadow-lg" aria-label="Open writing tools"><Settings /></Button></PopoverTrigger>
						<PopoverContent align="end" side="top" className="w-auto p-3">
							<div className="grid grid-cols-3 gap-2">
								<Button type="button" variant="outline" size="icon" aria-label="Import chapter from webpage" onClick={() => { setMobileToolsOpen(false); setImportOpen(true); }}><LinkIcon /></Button>
								<Button type="button" variant="outline" size="icon" aria-label="Open glossary" onClick={() => { setMobileToolsOpen(false); setGlossaryOpen(true); }}><BookOpen /></Button>
								<Button type="button" variant="outline" size="icon" aria-label="AI Translate" disabled={translating || !hasRichText(content)} onClick={() => { setMobileToolsOpen(false); setTranslateOpen(true); }}><Languages /></Button>
							</div>
						</PopoverContent>
					</Popover>
				</div>
			</div>
		</RimoraShell>
	);
};

export default Workbook;
