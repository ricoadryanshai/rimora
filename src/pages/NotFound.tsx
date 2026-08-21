import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Compass, Library, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RimoraShell } from "@/components/RimoraShell";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <RimoraShell>
      <div className="relative isolate flex min-h-[calc(100vh-10rem)] items-center overflow-hidden py-12">
        <div className="pointer-events-none absolute -right-24 top-1/2 -z-10 h-80 w-80 -translate-y-1/2 rounded-full border border-primary/10 bg-primary/[0.03] shadow-[0_0_120px_hsl(182_100%_50%/0.08)]" />
        <div className="pointer-events-none absolute -right-4 top-1/2 -z-10 h-56 w-56 -translate-y-1/2 rounded-full border border-primary/10" />
        <div className="grid w-full gap-12 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
          <div className="max-w-2xl">
            <div className="mb-8 flex items-center gap-3 text-primary">
              <span className="grid h-10 w-10 place-items-center rounded-sm border border-primary/30 bg-primary/10">
                <Map className="h-5 w-5" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.2em]">
                Lost chapter
              </span>
            </div>
            <p className="font-display text-[clamp(6rem,18vw,12rem)] font-bold leading-[0.78] tracking-[-0.06em] text-foreground/10">
              404
            </p>
            <h1 className="mt-8 max-w-xl font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              This page slipped between the chapters.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
              The route you followed does not exist in this workspace. Return to
              your library or explore another story to continue reading.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/">
                  <Library /> Return to Library
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/explore">
                  <Compass /> Explore Stories
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <button type="button" onClick={() => window.history.back()}>
                  <ArrowLeft /> Go Back
                </button>
              </Button>
            </div>
            <p
              className="mt-8 max-w-full truncate border-l-2 border-primary/30 pl-3 font-mono text-xs text-muted-foreground"
              title={location.pathname}
            >
              {location.pathname}
            </p>
          </div>
          <div className="hidden lg:block">
            <div className="relative mx-auto aspect-[3/4] max-w-[220px] rotate-3 border border-border bg-card/40 p-3 shadow-2xl">
              <div className="flex h-full flex-col justify-between border border-dashed border-primary/20 p-5">
                <div className="flex items-center justify-between text-primary/50">
                  <Map className="h-5 w-5" />
                  <span className="font-mono text-[10px]">RMR / 404</span>
                </div>
                <div>
                  <div className="mb-3 h-px w-16 bg-primary/50" />
                  <p className="font-display text-2xl font-semibold text-foreground/70">
                    Uncharted
                    <br />
                    territory
                  </p>
                </div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  No record found
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RimoraShell>
  );
};

export default NotFound;
