import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowLeft,
  BookOpen,
  CircleHelp,
  ImagePlus,
  Plus,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/LoadingButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import RichTextEditor from "@/components/RichTextEditor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RimoraShell } from "@/components/RimoraShell";
import { MessageAlert } from "@/components/MessageAlert";
import { useAuth } from "@/contexts/AuthContext";
import { rimora } from "@/lib/rimora";
import { supabase } from "@/integrations/supabase/client";

const NovelCreate = () => {
  const { user, session, loading: authLoading } = useAuth();
  const location = useLocation();
  const { novelId } = useParams();
  const navigate = useNavigate();
  const editMode = Boolean(novelId);
  const [showForm, setShowForm] = useState(false);
  const [ownedNovels, setOwnedNovels] = useState<
    Array<{
      id: string;
      title: string;
      translation_title: string | null;
      cover_url: string | null;
      novel_type: string;
      status: string;
    }>
  >([]);
  const [novelsLoading, setNovelsLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [novelType, setNovelType] = useState("Novel");
  const [leadingGender, setLeadingGender] = useState("");
  const [genre, setGenre] = useState("");
  const [language, setLanguage] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [coverPreview, setCoverPreview] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [length, setLength] = useState("Novel");
  const [description, setDescription] = useState("");
  const [warningNotice, setWarningNotice] = useState("General Audiences");
  const [fanficTopic, setFanficTopic] = useState("");
  const [fanficCategory, setFanficCategory] = useState("Gen");
  const [translationTitle, setTranslationTitle] = useState("");
  const [translationLanguage, setTranslationLanguage] = useState("");
  const [customTranslationLanguage, setCustomTranslationLanguage] =
    useState("");
  const [originalPlatform, setOriginalPlatform] = useState("");
  const [translator, setTranslator] = useState("");
  const [translatorGroup, setTranslatorGroup] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importMissingFields, setImportMissingFields] = useState<string[]>([]);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const originalLanguageRef = useRef<HTMLButtonElement>(null);
  const translationLanguageRef = useRef<HTMLButtonElement>(null);
  const customTranslationLanguageRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!user) return;
    void supabase
      .from("novels")
      .select("id,title,translation_title,cover_url,novel_type,status")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        setOwnedNovels(
          (data ?? []) as Array<{
            id: string;
            title: string;
            translation_title: string | null;
            cover_url: string | null;
            novel_type: string;
            status: string;
          }>,
        );
        setNovelsLoading(false);
      });
  }, [user]);
  useEffect(() => {
    if (!user || !novelId) return;
    void supabase
      .from("novels")
      .select("*")
      .eq("id", novelId)
      .eq("owner_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) {
          setError("Novel not found or you do not have permission to edit it.");
          return;
        }
        setTitle(data.title ?? "");
        setAuthor(data.author ?? "");
        setNovelType(data.novel_type ?? "Novel");
        setLeadingGender(data.leading_gender ?? "");
        setGenre(data.genre ?? "");
        setLanguage(data.language ?? "");
        setCoverUrl(data.cover_url ?? "");
        setCoverPreview(data.cover_url ?? "");
        setAbbreviation(data.abbreviation ?? "");
        setLength(data.length ?? "Novel");
        setDescription(data.description ?? "");
        setWarningNotice(data.warning_notice ?? "General Audiences");
        setFanficTopic(data.fanfic_topic ?? "");
        setFanficCategory(data.fanfic_category ?? "Gen");
        setTranslationTitle(data.translation_title ?? "");
        setTranslationLanguage(data.translation_language ?? "");
        setOriginalPlatform(data.original_platform ?? "");
        setTranslator(data.translator ?? "");
        setTranslatorGroup(data.translator_group ?? "");
        setShowForm(true);
      });
  }, [novelId, user]);
  const createNovel = async (event: FormEvent) => {
    event.preventDefault();
    if (abbreviation.length > 15) {
      setError("Abbreviation must be 15 characters or fewer.");
      return;
    }
    if (!leadingGender) {
      setError("Select a leading gender before creating your novel.");
      return;
    }
    const effectiveTranslationLanguage =
      translationLanguage === "Other"
        ? customTranslationLanguage.trim()
        : translationLanguage;
    if (novelType === "Translation" && !effectiveTranslationLanguage) {
      setError("Specify the translation language before creating your novel.");
      return;
    }
    setSaving(true);
    setError(null);
    const novelValues = {
      owner_id: user?.id,
      title,
      author,
      description,
      novel_type: novelType,
      leading_gender: leadingGender,
      genre,
      language:
        novelType === "Translation" ? effectiveTranslationLanguage : language,
      cover_url: coverUrl || null,
      abbreviation,
      length,
      warning_notice: warningNotice,
      fanfic_topic: novelType === "Fanfic" ? fanficTopic : null,
      fanfic_category: novelType === "Fanfic" ? fanficCategory : null,
      original_title: novelType === "Translation" ? title : null,
      translation_title: novelType === "Translation" ? translationTitle : null,
      original_language: novelType === "Translation" ? language : null,
      translation_language:
        novelType === "Translation" ? effectiveTranslationLanguage : null,
      original_platform: novelType === "Translation" ? originalPlatform : null,
      translator: novelType === "Translation" ? translator : null,
      translator_group:
        novelType === "Translation" ? translatorGroup || null : null,
      status: editMode ? undefined : "ongoing",
      visibility: editMode ? undefined : "public",
      published_at: editMode ? undefined : new Date().toISOString(),
    };
    const result = editMode
      ? await rimora
          .from("novels")
          .update(novelValues)
          .eq("id", novelId)
          .eq("owner_id", user?.id)
          .select("id")
          .single()
      : await rimora.from("novels").insert(novelValues).select("id").single();
    if (result.error) setError(result.error.message);
    else if (result.data) navigate(`/workspace/${result.data.id}`);
    setSaving(false);
  };
  const maleNovelGenres = [
    "Urban",
    "Fantasy",
    "History",
    "Horror",
    "Sci-fi",
    "Sports",
    "Games",
    "Eastern",
    "Realistic",
    "Action",
    "War",
  ];
  const femaleNovelGenres = [
    "Urban",
    "History",
    "Fantasy",
    "Sci-fi",
    "Teen",
    "LGBT+",
  ];
  const translationMaleGenres = [...maleNovelGenres, "Others"];
  const translationFemaleGenres = [...femaleNovelGenres, "Others"];
  const fanficGenres = [
    "Book & Literature",
    "Celebrities & Real People",
    "Music & Bands",
    "Theater",
    "Video Games",
    "Anime & Comics",
    "Movies",
    "TV",
    "Others",
  ];
  const genres =
    novelType === "Fanfic"
      ? fanficGenres
      : leadingGender === "Male-Oriented"
        ? novelType === "Translation"
          ? translationMaleGenres
          : maleNovelGenres
        : leadingGender === "Female-Oriented"
          ? novelType === "Translation"
            ? translationFemaleGenres
            : femaleNovelGenres
          : [];
  const handleTypeChange = (value: string) => {
    setNovelType(value);
    setGenre(
      value === "Fanfic" ? "Book & Literature" : leadingGender ? "Urban" : "",
    );
  };
  const handleGenderChange = (value: string) => {
    setLeadingGender(value);
    setGenre(
      value ? (novelType === "Fanfic" ? "Book & Literature" : "Urban") : "",
    );
  };
  const handleAiImport = async () => {
    const focusRequiredField = (
      field: HTMLButtonElement | HTMLInputElement | null,
    ) => {
      field?.scrollIntoView({ behavior: "smooth", block: "center" });
      field?.focus({ preventScroll: true });
    };
    if (!language) {
      setError("Select an original language before importing.");
      focusRequiredField(originalLanguageRef.current);
      return;
    }
    if (!translationLanguage) {
      setError("Select a translation language before importing.");
      focusRequiredField(translationLanguageRef.current);
      return;
    }
    if (translationLanguage === "Other" && !customTranslationLanguage.trim()) {
      setError("Specify the target translation language before importing.");
      focusRequiredField(customTranslationLanguageRef.current);
      return;
    }
    if (authLoading) {
      setError("Checking your sign-in session. Please try again in a moment.");
      return;
    }
    if (!session?.access_token) {
      setError("Sign in before using AI import.");
      navigate("/auth");
      return;
    }
    if (!importUrl.trim()) {
      setError("Enter the novel information page URL before importing.");
      return;
    }
    setIsImporting(true);
    setError(null);
    try {
      const { data, error: importError } = await supabase.functions.invoke(
        "ai-novel-import",
        { body: { url: importUrl.trim() } },
      );
      if (importError) throw new Error(importError.message);
      if (!data?.success || !data.novel) {
        throw new Error(data?.error || "Could not import novel information.");
      }
      const imported = data.novel;
      if (typeof imported.title === "string") setTitle(imported.title);
      if (typeof imported.author === "string") setAuthor(imported.author);
      if (
        imported.leadingGender === "Male-Oriented" ||
        imported.leadingGender === "Female-Oriented"
      )
        setLeadingGender(imported.leadingGender);
      if (
        ["Novel", "Short Story", "Super-Short Story"].includes(imported.length)
      )
        setLength(imported.length);
      if (
        [
          "General Audiences",
          "Parental Guidance Suggested",
          "Parents Strongly Cautioned",
          "Restricted",
          "No One 17 and Under Admitted",
        ].includes(imported.warningNotice)
      )
        setWarningNotice(imported.warningNotice);
      if (typeof imported.abbreviation === "string")
        setAbbreviation(imported.abbreviation.slice(0, 15));
      if (typeof imported.description === "string")
        setDescription(imported.description);
      if (typeof imported.originalPlatform === "string")
        setOriginalPlatform(imported.originalPlatform);
      const importedGenre =
        typeof imported.genre === "string" ? imported.genre.trim() : "";
      const hasUsableGenre =
        importedGenre.length > 0 && genres.includes(importedGenre);
      setGenre(hasUsableGenre ? importedGenre : "");
      if (typeof imported.coverUrl === "string") {
        setCoverUrl(imported.coverUrl);
        setCoverPreview(imported.coverUrl);
      }
      if (typeof imported.translationTitle === "string")
        setTranslationTitle(imported.translationTitle);
      const ignoredFields = new Set([
        "originalLanguage",
        "translationLanguage",
        "translator",
        "translatorGroup",
      ]);
      const missingFields = Array.isArray(data.missingFields)
        ? data.missingFields.filter(
            (field: unknown) =>
              typeof field === "string" && !ignoredFields.has(field),
          )
        : [];
      if (!hasUsableGenre && !missingFields.includes("genre")) {
        missingFields.push("genre");
      }
      if (
        typeof imported.originalPlatform === "string" &&
        imported.originalPlatform.trim()
      ) {
        const isValidUrl = /^https?:\/\//i.test(
          imported.originalPlatform.trim(),
        );
        if (isValidUrl) {
          setImportMissingFields(
            missingFields.filter(
              (field: string) => field !== "originalPlatform",
            ),
          );
        } else {
          setImportMissingFields(missingFields);
        }
      } else {
        setImportMissingFields(missingFields);
      }
      setImportUrl("");
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Could not import novel information.",
      );
    } finally {
      setIsImporting(false);
    }
  };
  const handleCoverFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCoverUrl("");
      setCoverPreview(URL.createObjectURL(file));
    }
  };
  const openCoverPicker = () => coverInputRef.current?.click();
  if (!showForm && location.pathname !== "/novel/new") {
    return (
      <RimoraShell>
        <div className="page-container max-w-6xl space-y-8">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Your writing space
                </p>
                <h1 className="font-display text-4xl font-semibold">
                  My Novels
                </h1>
              </div>
            </div>
            <Button onClick={() => navigate("/novel/new")}>
              <Plus />
              Create novel
            </Button>
          </header>
          {novelsLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading your novels...
            </p>
          ) : ownedNovels.length === 0 ? (
            <Card>
              <CardContent className="flex min-h-48 flex-col items-center justify-center gap-4 text-center">
                <p className="text-muted-foreground">
                  You have not created any novels yet.
                </p>
                <Button onClick={() => navigate("/novel/new")}>
                  <Plus />
                  Create your first novel
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {ownedNovels.map((novel) => {
                const displayTitle =
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
                return (
                  <Card
                    key={novel.id}
                    className="overflow-hidden transition-shadow hover:shadow-lg"
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/workspace/${novel.id}`)}
                      className="block w-full text-left"
                    >
                      <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                        <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${typeBadgeClass}`}
                          >
                            {novel.novel_type}
                          </span>
                        </div>
                        {novel.cover_url ? (
                          <img
                            src={novel.cover_url}
                            alt={`${displayTitle} cover`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="grid h-full place-items-center text-muted-foreground">
                            <BookOpen className="h-10 w-10" />
                          </div>
                        )}
                      </div>
                      <CardContent className="p-4">
                        <h2 className="line-clamp-2 font-display font-semibold">
                          {displayTitle}
                        </h2>
                      </CardContent>
                    </button>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </RimoraShell>
    );
  }
  return (
    <RimoraShell>
      <div className="page-container max-w-5xl">
        <Button variant="ghost" size="sm" asChild className="mb-6">
          <Link
            to={editMode && novelId ? `/workspace/${novelId}` : "/workspace"}
          >
            <ArrowLeft /> My Novels
          </Link>
        </Button>
        {error && <MessageAlert type="error" message={error} />}
        {importMissingFields.length > 0 && (
          <MessageAlert
            type="warning"
            title="Review imported fields"
            message={`The source did not provide: ${importMissingFields.join(", ")}. Please complete these fields manually.`}
          />
        )}
        <Card>
          <CardHeader className="relative">
            <div className="relative flex items-start gap-4 pr-12">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-sm bg-primary/10 text-primary">
                <BookOpen />
              </div>
              <div className="min-w-0 space-y-1">
                <CardTitle className="font-display text-3xl">
                  {editMode ? "Edit Novel" : "Novel Information"}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Give your story a home. You can refine everything later.
                </p>
              </div>
              {novelType === "Translation" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="absolute right-0 top-0"
                      aria-label="Import translation source"
                    >
                      <Sparkles />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80 space-y-3">
                    <div>
                      <p className="text-sm font-semibold">Import with AI</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Add a source URL to prepare the translation details.
                      </p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        Use the novel's actual information page with details
                        such as the title, author, and synopsis so the import
                        can succeed.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={importUrl}
                        onChange={(event) => setImportUrl(event.target.value)}
                        placeholder="Paste source URL"
                        type="url"
                        aria-label="Translation source URL"
                      />
                      <LoadingButton
                        type="button"
                        size="sm"
                        onClick={() => void handleAiImport()}
                        loading={isImporting}
                        loadingLabel="Importing..."
                      >
                        Import
                      </LoadingButton>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={createNovel} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title">
                  {novelType === "Translation" ? "Original Title" : "Title"}
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="The name readers will remember"
                  required
                />
              </div>
              {novelType === "Translation" && (
                <div className="space-y-2">
                  <Label htmlFor="translationTitle">Translation Title</Label>
                  <Input
                    id="translationTitle"
                    value={translationTitle}
                    onChange={(event) =>
                      setTranslationTitle(event.target.value)
                    }
                    placeholder="The title readers will see"
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="author">Author</Label>
                <Input
                  id="author"
                  value={author}
                  onChange={(event) => setAuthor(event.target.value)}
                  placeholder="The author's name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <RadioGroup
                  value={novelType}
                  onValueChange={handleTypeChange}
                  className="flex gap-5 pt-2"
                >
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <RadioGroupItem value="Novel" /> Novel
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <RadioGroupItem value="Fanfic" /> Fanfic
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <RadioGroupItem value="Translation" /> Translation
                  </label>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label>Leading Gender</Label>
                <RadioGroup
                  value={leadingGender}
                  onValueChange={handleGenderChange}
                  className="flex gap-5 pt-2"
                >
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <RadioGroupItem value="Male-Oriented" /> Male-Oriented
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <RadioGroupItem value="Female-Oriented" /> Female-Oriented
                  </label>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label>Genre</Label>
                <Select
                  value={genre}
                  onValueChange={setGenre}
                  disabled={!leadingGender}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        leadingGender ? "Select a genre" : "Select gender first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {genres.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  {novelType === "Translation"
                    ? "Original Language"
                    : "Language"}
                </Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger ref={originalLanguageRef}>
                    <SelectValue placeholder="Select original language" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "English",
                      "Japanese",
                      "Korean",
                      "Chinese",
                      "Spanish",
                      "French",
                      "Other",
                    ].map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {novelType === "Translation" && (
                <div className="space-y-2">
                  <Label>Translation Language</Label>
                  <Select
                    value={translationLanguage}
                    onValueChange={setTranslationLanguage}
                  >
                    <SelectTrigger ref={translationLanguageRef}>
                      <SelectValue placeholder="Select translation language" />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "English",
                        "Japanese",
                        "Korean",
                        "Chinese",
                        "Spanish",
                        "French",
                        "Other",
                      ].map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {translationLanguage === "Other" && (
                    <Input
                      ref={customTranslationLanguageRef}
                      value={customTranslationLanguage}
                      onChange={(event) =>
                        setCustomTranslationLanguage(event.target.value)
                      }
                      placeholder="Specify the target language not listed above"
                      aria-label="Custom translation language"
                      required
                    />
                  )}
                </div>
              )}
              <div className="space-y-3">
                <Label>Book Cover</Label>
                <button
                  type="button"
                  onClick={openCoverPicker}
                  className="group relative grid h-32 w-24 place-items-center overflow-hidden rounded-sm border border-dashed border-border text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label={
                    coverPreview ? "Change book cover" : "Choose a book cover"
                  }
                >
                  {coverPreview ? (
                    <img
                      src={coverPreview}
                      alt="Book cover preview. Click to choose a different image."
                      className="h-full w-full object-cover transition-opacity group-hover:opacity-70"
                      onError={() => setCoverPreview("")}
                    />
                  ) : (
                    <span className="px-2 text-center text-xs text-muted-foreground">
                      Preview
                    </span>
                  )}
                  <span className="absolute inset-0 grid place-items-center bg-background/60 px-1 text-center text-xs font-semibold uppercase tracking-wide text-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    {coverPreview ? "Change cover" : "Choose cover"}
                  </span>
                </button>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-sm border border-dashed border-input p-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                    <Upload className="h-4 w-4" /> Upload from device
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleCoverFile}
                    />
                  </label>
                  <div className="relative">
                    <ImagePlus className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      value={coverUrl}
                      onChange={(event) => {
                        setCoverUrl(event.target.value);
                        setCoverPreview(event.target.value);
                      }}
                      placeholder="Paste cover image URL"
                      type="url"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="abbreviation">Abbreviation</Label>
                <Input
                  id="abbreviation"
                  value={abbreviation}
                  maxLength={15}
                  onChange={(event) => setAbbreviation(event.target.value)}
                  placeholder="e.g. TLOU"
                />
                <p className="text-right text-xs text-muted-foreground">
                  {abbreviation.length}/15
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Length</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 rounded-full p-0 text-muted-foreground hover:text-primary"
                        aria-label="Length definitions"
                      >
                        <CircleHelp className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-64 space-y-1 text-sm"
                    >
                      <p>
                        <strong>Novels:</strong> ≥100 chapters
                      </p>
                      <p>
                        <strong>Short Stories:</strong> 20–99 chapters
                      </p>
                      <p>
                        <strong>Super-Short-Stories:</strong> &lt;20 chapters
                      </p>
                    </PopoverContent>
                  </Popover>
                </div>
                <Select value={length} onValueChange={setLength}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Novel", "Short Story", "Super-Short Story"].map(
                      (value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Synopsis</Label>
                <RichTextEditor
                  id="description"
                  value={description}
                  onChange={setDescription}
                  placeholder="What is this story about?"
                />
              </div>
              {novelType === "Translation" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="originalPlatform">
                      Original Novel Platform/Link
                    </Label>
                    <Input
                      id="originalPlatform"
                      value={originalPlatform}
                      onChange={(event) =>
                        setOriginalPlatform(event.target.value)
                      }
                      placeholder="e.g. Webnovel or source URL"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="translator">Translator</Label>
                    <Input
                      id="translator"
                      value={translator}
                      onChange={(event) => setTranslator(event.target.value)}
                      placeholder="Your name or pen name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="translatorGroup">
                      Translator Group{" "}
                      <span className="font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </Label>
                    <Input
                      id="translatorGroup"
                      value={translatorGroup}
                      onChange={(event) =>
                        setTranslatorGroup(event.target.value)
                      }
                      placeholder="Leave blank for an individual translator"
                    />
                  </div>
                </>
              )}
              {novelType === "Fanfic" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fanficTopic">Topic</Label>
                    <Input
                      id="fanficTopic"
                      value={fanficTopic}
                      onChange={(event) => setFanficTopic(event.target.value)}
                      placeholder="e.g. Marvel, Harry Potter, Original Character(s)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={fanficCategory}
                      onValueChange={setFanficCategory}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["M/M", "F/F", "F/M", "Gen", "Multi", "Other"].map(
                          (value) => (
                            <SelectItem key={value} value={value}>
                              {value}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label>Warning Notice</Label>
                <Select value={warningNotice} onValueChange={setWarningNotice}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "General Audiences",
                      "Parental Guidance Suggested",
                      "Parents Strongly Cautioned",
                      "Restricted",
                      "No One 17 and Under Admitted",
                    ].map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end">
                <LoadingButton
                  type="submit"
                  loading={saving}
                  loadingLabel={editMode ? "Saving..." : "Creating..."}
                >
                  {saving
                    ? editMode
                      ? "Saving..."
                      : "Creating..."
                    : editMode
                      ? "Save changes"
                      : "Create"}
                  <ArrowRight />
                </LoadingButton>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </RimoraShell>
  );
};
export default NovelCreate;
