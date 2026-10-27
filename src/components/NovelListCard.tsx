import { BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { NovelTypeBadge } from "@/components/NovelGridCard";

const allowedSynopsisTags = new Set([
  "P",
  "STRONG",
  "B",
  "EM",
  "I",
  "U",
  "S",
  "BR",
  "UL",
  "OL",
  "LI",
]);

const sanitizeSynopsis = (value: string) => {
  if (!value.includes("<")) return value;
  const document = new DOMParser().parseFromString(value, "text/html");
  const sanitizeNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const element = node as HTMLElement;
    const children = Array.from(element.childNodes).map(sanitizeNode).join("");
    if (!allowedSynopsisTags.has(element.tagName)) return children;
    const tag = element.tagName.toLowerCase() === "b" ? "strong" : element.tagName.toLowerCase();
    return `<${tag}>${children}</${tag}>`;
  };
  return Array.from(document.body.childNodes).map(sanitizeNode).join("");
};

type NovelListCardProps = {
  title: string;
  synopsis?: string | null;
  novelType: string;
  coverUrl?: string | null;
  metadata?: string;
  onClick?: () => void;
  href?: string;
};

export const NovelListCard = ({
  title,
  synopsis,
  novelType,
  coverUrl,
  metadata,
  onClick,
  href,
}: NovelListCardProps) => {
  const content = (
    <div className="grid min-h-40 grid-cols-[112px_minmax(0,1fr)] items-center gap-5 p-4 sm:grid-cols-[144px_minmax(0,1fr)] sm:gap-6 sm:p-5">
      <div className="flex h-32 items-center justify-center sm:h-36">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={`${title} cover`}
            className="h-full w-auto max-w-full rounded-sm object-contain"
          />
        ) : (
          <div className="grid h-full w-24 place-items-center rounded-sm bg-muted text-muted-foreground sm:w-28">
            <BookOpen className="h-10 w-10" />
          </div>
        )}
      </div>
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <NovelTypeBadge novelType={novelType} />
          {metadata && <span className="text-xs text-muted-foreground">{metadata}</span>}
        </div>
        <h2 className="font-display text-lg font-semibold leading-tight">{title}</h2>
        <div
          className="line-clamp-3 text-sm leading-6 text-muted-foreground [&_br]:inline [&_li]:ml-4 [&_li]:list-item [&_ol]:list-decimal [&_p]:mb-1 [&_ul]:list-disc"
          dangerouslySetInnerHTML={{
            __html: sanitizeSynopsis(synopsis?.trim() || "No synopsis available."),
          }}
        />
      </div>
    </div>
  );

  if (href) {
    return <Link to={href} className="block overflow-hidden rounded-sm border bg-card/60 transition-[box-shadow,border-color] duration-200 hover:border-primary/30 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">{content}</Link>;
  }
  return <Card className="overflow-hidden transition-shadow hover:shadow-lg"><button type="button" onClick={onClick} className="block w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">{content}</button></Card>;
};
