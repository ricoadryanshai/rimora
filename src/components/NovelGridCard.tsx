import { BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

export const NovelTypeBadge = ({ novelType }: { novelType: string }) => {
  const badgeClass =
    novelType === "Translation"
      ? "bg-sky-700 text-white"
      : novelType === "Fanfic"
        ? "bg-fuchsia-700 text-white"
        : "bg-emerald-700 text-white";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${badgeClass}`}
    >
      {novelType}
    </span>
  );
};

type NovelGridCardProps = {
  to: string;
  title: string;
  novelType: string;
  coverUrl?: string | null;
  subtitle?: string;
  /** 0-1 fraction of chapters read; hidden when undefined. */
  progress?: number;
};

export const NovelGridCard = ({
  to,
  title,
  novelType,
  coverUrl,
  subtitle,
  progress,
}: NovelGridCardProps) => (
  <Link
    to={to}
    className="group block overflow-hidden rounded-sm border bg-card/60 transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:hover:translate-y-0"
  >
    <div className="relative aspect-[3/4] bg-muted">
      <span className="absolute left-3 top-3 z-10">
        <NovelTypeBadge novelType={novelType} />
      </span>
      {coverUrl ? (
        <img
          src={coverUrl}
          alt={`${title} cover`}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="grid h-full place-items-center text-muted-foreground">
          <BookOpen className="h-10 w-10" aria-hidden="true" />
        </div>
      )}
      {progress !== undefined && progress > 0 && (
        <div
          className="absolute inset-x-0 bottom-0 h-1 bg-background/60"
          role="progressbar"
          aria-label="Reading progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div
            className="h-full bg-accent"
            style={{ width: `${Math.min(progress, 1) * 100}%` }}
          />
        </div>
      )}
    </div>
    <div className="p-4">
      <h2 className="line-clamp-2 font-display font-semibold leading-snug">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-2 text-xs capitalize text-muted-foreground">
          {subtitle}
        </p>
      )}
    </div>
  </Link>
);

export const NovelGridSkeleton = ({ count = 8 }: { count?: number }) => (
  <div
    role="status"
    aria-label="Loading novels"
    className="grid grid-cols-2 gap-5 lg:grid-cols-3 xl:grid-cols-4"
  >
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="overflow-hidden rounded-sm border bg-card/60">
        <Skeleton className="aspect-[3/4] w-full rounded-none" />
        <div className="space-y-2 p-4">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
    ))}
  </div>
);
