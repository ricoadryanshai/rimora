import { FormEvent, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  ImagePlus,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RimoraShell } from "@/components/RimoraShell";
import { useAuth } from "@/contexts/AuthContext";
import { rimora } from "@/lib/rimora";

const NovelCreate = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [novelType, setNovelType] = useState("Novel");
  const [leadingGender, setLeadingGender] = useState("");
  const [genre, setGenre] = useState("");
  const [language, setLanguage] = useState("English");
  const [coverUrl, setCoverUrl] = useState("");
  const [coverPreview, setCoverPreview] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [length, setLength] = useState("Novel");
  const [description, setDescription] = useState("");
  const [warningNotice, setWarningNotice] = useState("General Audiences");
  const [fanficTopic, setFanficTopic] = useState("");
  const [fanficCategory, setFanficCategory] = useState("Gen");
  const [translationTitle, setTranslationTitle] = useState("");
  const [translationLanguage, setTranslationLanguage] = useState("English");
  const [originalPlatform, setOriginalPlatform] = useState("");
  const [translator, setTranslator] = useState("");
  const [translatorGroup, setTranslatorGroup] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
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
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await rimora
      .from("novels")
      .insert({
        owner_id: user?.id,
        title,
        author,
        description,
        novel_type: novelType,
        leading_gender: leadingGender,
        genre,
        language: novelType === "Translation" ? translationLanguage : language,
        cover_url: coverUrl || null,
        abbreviation,
        length,
        warning_notice: warningNotice,
        fanfic_topic: novelType === "Fanfic" ? fanficTopic : null,
        fanfic_category: novelType === "Fanfic" ? fanficCategory : null,
        original_title: novelType === "Translation" ? title : null,
        translation_title:
          novelType === "Translation" ? translationTitle : null,
        original_language: novelType === "Translation" ? language : null,
        translation_language:
          novelType === "Translation" ? translationLanguage : null,
        original_platform:
          novelType === "Translation" ? originalPlatform : null,
        translator: novelType === "Translation" ? translator : null,
        translator_group:
          novelType === "Translation" ? translatorGroup || null : null,
      })
      .select("id")
      .single();
    if (insertError) setError(insertError.message);
    else if (data) navigate(`/novels/${data.id}`);
    setSaving(false);
  };
  const genres =
    leadingGender === "Male-Oriented"
      ? ["Fantasy", "Action", "Adventure", "Xianxia", "Science Fiction"]
      : leadingGender === "Female-Oriented"
        ? ["Romance", "Drama", "Historical", "Contemporary", "Fantasy Romance"]
        : [];
  const handleGenderChange = (value: string) => {
    setLeadingGender(value);
    setGenre(value === "Male-Oriented" ? "Fantasy" : "Romance");
  };
  const handleCoverFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCoverUrl("");
      setCoverPreview(URL.createObjectURL(file));
    }
  };
  const openCoverPicker = () => coverInputRef.current?.click();
  return (
    <RimoraShell>
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader className="relative">
            {novelType === "Translation" && (
              <HoverCard openDelay={120} closeDelay={180}>
                <HoverCardTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="absolute right-6 top-6"
                    aria-label="Import translation source"
                  >
                    <Sparkles />
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent align="end" className="w-80 space-y-3">
                  <div>
                    <p className="text-sm font-semibold">Import with AI</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add a source URL to prepare the translation details.
                    </p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      Use the novel's actual information page with details such
                      as the title, author, and synopsis so the import can
                      succeed.
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
                    <Button type="button" size="sm">
                      Import
                    </Button>
                  </div>
                </HoverCardContent>
              </HoverCard>
            )}
            <div className="mb-3 grid h-11 w-11 place-items-center rounded-sm bg-primary/10 text-primary">
              <BookOpen />
            </div>
            <CardTitle className="font-display text-3xl">
              Novel Information
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Give your story a home. You can refine everything later.
            </p>
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
                  onValueChange={setNovelType}
                  className="flex gap-5 pt-2"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="Novel" /> Novel
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="Fanfic" /> Fanfic
                  </label>
                  <label className="flex items-center gap-2 text-sm">
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
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="Male-Oriented" /> Male-Oriented
                  </label>
                  <label className="flex items-center gap-2 text-sm">
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
                  <SelectTrigger>
                    <SelectValue />
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
                    <SelectTrigger>
                      <SelectValue />
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
                <Label>Length</Label>
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
                <Textarea
                  id="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What is this story about?"
                  rows={6}
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
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={saving}>
                {saving ? "Creating..." : "Create"}
                <ArrowRight />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </RimoraShell>
  );
};
export default NovelCreate;
