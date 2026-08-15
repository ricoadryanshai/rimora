import { useEffect, useRef, useState } from "react";
import {
  Copy,
  Expand,
  Loader2,
  Minimize,
  Languages,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { AiModel, AiSettings } from "@/hooks/use-ai-config";

interface TranslationViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: string;
  title: string;
  models: AiModel[];
  settings: AiSettings;
  activeModel: AiModel | null;
  saveSettings: (next: Partial<AiSettings>) => Promise<void> | void;
  onApply?: (translation: string) => void;
}

const SUPABASE_URL = "https://okjetbwkeozsnjkwhqix.supabase.co";

const TranslationView = ({
  open,
  onOpenChange,
  text,
  title,
  models,
  settings,
  activeModel,
  saveSettings,
  onApply,
}: TranslationViewProps) => {
  const { toast } = useToast();
  const readingRef = useRef<HTMLDivElement>(null);
  const [translation, setTranslation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [fontSize, setFontSize] = useState(18);
  const [fullscreen, setFullscreen] = useState(false);
  const [usesFallbackFullscreen, setUsesFallbackFullscreen] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(document.fullscreenElement === readingRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!open) {
      if (document.fullscreenElement === readingRef.current) {
        document.exitFullscreen().catch(() => undefined);
      }
      setTranslation("");
      setError(null);
      setStreaming(false);
      setApplied(false);
      setUsesFallbackFullscreen(false);
      setFullscreen(false);
    }
  }, [open]);

  const translate = async () => {
    if (!activeModel) {
      setError("Select an active model in AI Providers before translating.");
      return;
    }
    setStreaming(true);
    setTranslation("");
    setError(null);
    setApplied(false);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sign in before using AI translation.");

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/ai-translate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            targetLanguage: settings.target_language,
            modelRowId: activeModel.id,
          }),
        },
      );

      if (!response.ok || !response.body) {
        const detail = await response.text();
        let message = detail;
        try {
          message = JSON.parse(detail).error ?? detail;
        } catch {
          /* plain provider error */
        }
        throw new Error(message || `Translation failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) {
          const data = event
            .split("\n")
            .find((line) => line.startsWith("data:"))
            ?.slice(5)
            .trim();
          if (!data || data === "[DONE]") continue;
          try {
            const chunk = JSON.parse(data);
            const content = chunk.choices?.[0]?.delta?.content;
            if (typeof content === "string")
              setTranslation((current) => current + content);
          } catch {
            /* ignore non-JSON SSE comments */
          }
        }
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Translation failed.",
      );
    } finally {
      setStreaming(false);
    }
  };

  const copyTranslation = async () => {
    if (!translation) return;
    await navigator.clipboard.writeText(translation);
    toast({ title: "Translation copied" });
  };

  const toggleFullscreen = async () => {
    const readingElement = readingRef.current;
    if (!readingElement) return;

    if (fullscreen || usesFallbackFullscreen) {
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => undefined);
      }
      setUsesFallbackFullscreen(false);
      setFullscreen(false);
      return;
    }

    if (typeof readingElement.requestFullscreen === "function") {
      try {
        await readingElement.requestFullscreen();
        return;
      } catch {
        // Fall through to the CSS fallback used by iOS Safari and PWAs.
      }
    }

    setUsesFallbackFullscreen(true);
    setFullscreen(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          usesFallbackFullscreen
            ? "fixed inset-0 left-0 top-0 z-[60] flex h-[100dvh] min-h-screen max-h-none w-screen max-w-none translate-x-0 translate-y-0 flex-col overscroll-contain overflow-hidden rounded-none p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-6"
            : "max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        }
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Stream a translation, review it, then copy or apply it when it is
            ready.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 min-h-0">
          <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="translation-language">Target language</Label>
              <Input
                id="translation-language"
                value={settings.target_language}
                onChange={(event) =>
                  saveSettings({ target_language: event.target.value })
                }
                placeholder="English"
              />
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Select
                value={settings.active_model_id ?? ""}
                onValueChange={(value) =>
                  saveSettings({ active_model_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={translate}
              disabled={streaming || !text.trim() || !activeModel}
              className="min-h-[44px]"
            >
              {streaming ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Languages className="mr-2 h-4 w-4" />
              )}
              {streaming ? "Translating" : "Translate"}
            </Button>
          </div>

          <div
            ref={readingRef}
            className="flex min-h-[220px] flex-col overflow-hidden rounded-lg border border-border bg-muted/30"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background/80 p-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="translation-font-size" className="text-xs">
                  Text size
                </Label>
                <Slider
                  id="translation-font-size"
                  min={14}
                  max={30}
                  step={1}
                  value={[fontSize]}
                  onValueChange={([value]) => setFontSize(value)}
                  className="w-24"
                />
                <span className="w-8 text-xs text-muted-foreground">
                  {fontSize}
                </span>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyTranslation}
                  disabled={!translation}
                  aria-label="Copy translation"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleFullscreen}
                  aria-label="Toggle fullscreen"
                >
                  {fullscreen ? (
                    <Minimize className="h-4 w-4" />
                  ) : (
                    <Expand className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div
              className="flex-1 overflow-y-auto p-5 sm:p-8"
              style={{ fontSize }}
            >
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : translation ? (
                <p className="whitespace-pre-wrap leading-relaxed">
                  {translation}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Your translation will appear here.
                </p>
              )}
            </div>
          </div>
          {onApply && translation && !streaming && (
            <Button
              variant="outline"
              onClick={() => {
                onApply(translation);
                setApplied(true);
              }}
              className="min-h-[44px]"
            >
              {applied ? <Check className="mr-2 h-4 w-4" /> : null}
              {applied ? "Applied" : "Apply translation"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TranslationView;
