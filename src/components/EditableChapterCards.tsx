import React, { useCallback, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Merge,
  MoreHorizontal,
  Pencil,
  Scissors,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface EditableChapterCardsProps {
  cards: string[];
  mobileCardIndex: number;
  copiedIndex: number | null;
  onCardsChange: (cards: string[]) => void;
  onMobileCardIndexChange: (index: number) => void;
  onCopyCard: (text: string, cardIndex: number) => void;
  onCopyAll: () => void;
}

const getCardStats = (card: string) => ({
  paragraphs: card.split("\n\n").filter((paragraph) => paragraph.trim()).length,
  characters: card.length,
});

const splitCardText = (card: string) => {
  const paragraphs = card.split(/\n{2,}/).filter((paragraph) => paragraph.trim());
  if (paragraphs.length > 1) {
    const splitAt = Math.ceil(paragraphs.length / 2);
    return [
      paragraphs.slice(0, splitAt).join("\n\n"),
      paragraphs.slice(splitAt).join("\n\n"),
    ];
  }

  const middle = Math.ceil(card.length / 2);
  const nearestSpace = card.indexOf(" ", middle);
  const splitAt = nearestSpace > -1 ? nearestSpace : middle;
  return [card.slice(0, splitAt).trim(), card.slice(splitAt).trim()].filter(Boolean);
};

const EditableChapterCards: React.FC<EditableChapterCardsProps> = ({
  cards,
  mobileCardIndex,
  copiedIndex,
  onCardsChange,
  onMobileCardIndexChange,
  onCopyCard,
  onCopyAll,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftText, setDraftText] = useState("");
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setDraftText(cards[index] || "");
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setDraftText("");
  };

  const saveEditing = () => {
    if (editingIndex === null) return;
    const updated = [...cards];
    updated[editingIndex] = draftText;
    onCardsChange(updated);
    cancelEditing();
  };

  const deleteCard = (index: number) => {
    const confirmed = window.confirm(`Delete card ${index + 1}?`);
    if (!confirmed) return;

    const updated = cards.filter((_, cardIndex) => cardIndex !== index);
    onCardsChange(updated);
    onMobileCardIndexChange(Math.max(0, Math.min(mobileCardIndex, updated.length - 1)));
  };

  const splitCard = (index: number) => {
    const split = splitCardText(cards[index]);
    if (split.length < 2) return;

    const updated = [
      ...cards.slice(0, index),
      split[0],
      split[1],
      ...cards.slice(index + 1),
    ];
    onCardsChange(updated);
    onMobileCardIndexChange(index + 1);
  };

  const mergeCard = (index: number, direction: "previous" | "next") => {
    if (direction === "previous" && index > 0) {
      const updated = [...cards];
      updated[index - 1] = `${updated[index - 1]}\n\n${updated[index]}`.trim();
      updated.splice(index, 1);
      onCardsChange(updated);
      onMobileCardIndexChange(index - 1);
    }

    if (direction === "next" && index < cards.length - 1) {
      const updated = [...cards];
      updated[index] = `${updated[index]}\n\n${updated[index + 1]}`.trim();
      updated.splice(index + 1, 1);
      onCardsChange(updated);
      onMobileCardIndexChange(index);
    }
  };

  const moveCard = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= cards.length) return;

    const updated = [...cards];
    [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
    onCardsChange(updated);
    onMobileCardIndexChange(targetIndex);
  };

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (editingIndex !== null) return;
    setTouchStartX(event.touches[0].clientX);
  }, [editingIndex]);

  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    if (touchStartX === null || editingIndex !== null) return;
    const delta = event.changedTouches[0].clientX - touchStartX;
    const threshold = 50;
    if (delta < -threshold && mobileCardIndex < cards.length - 1) {
      onMobileCardIndexChange(mobileCardIndex + 1);
    } else if (delta > threshold && mobileCardIndex > 0) {
      onMobileCardIndexChange(mobileCardIndex - 1);
    }
    setTouchStartX(null);
  }, [cards.length, editingIndex, mobileCardIndex, onMobileCardIndexChange, touchStartX]);

  const CardActions = ({ index }: { index: number }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="min-h-[44px] min-w-[44px] p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => startEditing(index)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => splitCard(index)}>
          <Scissors className="mr-2 h-4 w-4" />
          Split
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => mergeCard(index, "previous")} disabled={index === 0}>
          <Merge className="mr-2 h-4 w-4" />
          Merge Previous
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => mergeCard(index, "next")} disabled={index === cards.length - 1}>
          <Merge className="mr-2 h-4 w-4" />
          Merge Next
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => moveCard(index, "up")} disabled={index === 0}>
          <ArrowUp className="mr-2 h-4 w-4" />
          Move Earlier
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => moveCard(index, "down")} disabled={index === cards.length - 1}>
          <ArrowDown className="mr-2 h-4 w-4" />
          Move Later
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onCopyCard(cards[index], index)}>
          <Copy className="mr-2 h-4 w-4" />
          Copy
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => deleteCard(index)} className="text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderCardBody = (card: string, index: number, compact = false) => {
    const isEditing = editingIndex === index;
    const stats = getCardStats(isEditing ? draftText : card);

    return (
      <CardContent className="space-y-3 flex-1 flex flex-col min-h-0">
        {isEditing ? (
          <Textarea
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            className={`${compact ? "min-h-[260px]" : "min-h-[180px]"} flex-1 resize-none text-sm`}
          />
        ) : (
          <div className="text-card-foreground leading-relaxed text-sm whitespace-pre-wrap break-words bg-muted/50 p-4 rounded-lg border border-border/50 flex-1 overflow-auto min-h-0">
            {card}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground flex-shrink-0">
          <div className="flex gap-3">
            <div className="flex items-center gap-1">
              <span className="font-medium">Paragraphs:</span>
              <Badge variant="secondary" className="text-xs">{stats.paragraphs}</Badge>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">Characters:</span>
              <Badge variant="secondary" className="text-xs">{stats.characters}</Badge>
            </div>
          </div>

          {isEditing && (
            <div className="flex w-full gap-2 sm:w-auto">
              <Button onClick={cancelEditing} variant="outline" size="sm" className="min-h-[44px] flex-1 sm:flex-none">
                Cancel
              </Button>
              <Button onClick={saveEditing} size="sm" className="min-h-[44px] flex-1 sm:flex-none">
                Save
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    );
  };

  if (cards.length === 0) {
    return null;
  }

  const activeCard = cards[mobileCardIndex] || cards[0];

  return (
    <Card className="shadow-lg border-0 bg-card">
      <CardHeader className="pb-6 bg-gradient-to-r from-primary/5 to-primary/10 rounded-t-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="bg-primary/10 p-2 rounded-lg shadow-sm">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            Separated Chapter Cards ({cards.length})
          </CardTitle>
          <Button onClick={onCopyAll} variant="outline" size="sm" className="min-h-[44px] shrink-0">
            <Copy className="mr-2 h-4 w-4" />
            Copy All Cards
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <div className="sm:hidden" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <Card className="border-border bg-card min-h-[360px] max-h-[72vh] flex flex-col">
            <CardHeader className="pb-3 flex-shrink-0">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold text-card-foreground flex min-w-0 items-center gap-2">
                  <div className="bg-primary/10 p-1.5 rounded-md shadow-sm">
                    <BookOpen className="h-4 w-4 text-primary" />
                  </div>
                  <span className="truncate">Card {mobileCardIndex + 1} / {cards.length}</span>
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    onClick={() => onCopyCard(activeCard, mobileCardIndex)}
                    variant="outline"
                    size="sm"
                    className="min-h-[44px]"
                  >
                    {copiedIndex === mobileCardIndex ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <CardActions index={mobileCardIndex} />
                </div>
              </div>
            </CardHeader>
            {renderCardBody(activeCard, mobileCardIndex, true)}
          </Card>

          <div className="flex items-center justify-between mt-4">
            <Button
              onClick={() => onMobileCardIndexChange(Math.max(0, mobileCardIndex - 1))}
              variant="outline"
              size="sm"
              disabled={mobileCardIndex === 0}
              className="min-h-[44px] min-w-[44px]"
            >
              <ChevronLeft className="h-5 w-5" />
              Prev
            </Button>
            <div className="flex items-center gap-1 text-sm text-muted-foreground font-medium">
              <Input
                type="number"
                min={1}
                max={cards.length}
                value={mobileCardIndex + 1}
                onChange={(event) => {
                  const val = parseInt(event.target.value, 10);
                  if (val >= 1 && val <= cards.length) {
                    onMobileCardIndexChange(val - 1);
                  }
                }}
                className="w-12 h-8 text-center p-0 text-sm"
              />
              <span>/ {cards.length}</span>
            </div>
            <Button
              onClick={() => onMobileCardIndexChange(Math.min(cards.length - 1, mobileCardIndex + 1))}
              variant="outline"
              size="sm"
              disabled={mobileCardIndex === cards.length - 1}
              className="min-h-[44px] min-w-[44px]"
            >
              Next
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="hidden sm:grid gap-4 grid-cols-1 sm:gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((card, index) => (
            <Card key={`${index}-${card.slice(0, 12)}`} className="group hover:shadow-lg transition-all duration-300 border-border hover:border-primary/50 bg-card h-96 flex flex-col">
              <CardHeader className="pb-3 flex-shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg font-semibold text-card-foreground flex min-w-0 items-center gap-2">
                    <div className="bg-primary/10 p-1.5 rounded-md shadow-sm">
                      <BookOpen className="h-4 w-4 text-primary" />
                    </div>
                    <span className="truncate">Card {index + 1}</span>
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => onCopyCard(card, index)}
                      variant="outline"
                      size="sm"
                      className="group-hover:border-primary/50 group-hover:text-primary transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      {copiedIndex === index ? "Copied" : "Copy"}
                    </Button>
                    <CardActions index={index} />
                  </div>
                </div>
              </CardHeader>
              {renderCardBody(card, index)}
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default EditableChapterCards;
