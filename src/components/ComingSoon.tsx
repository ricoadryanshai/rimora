import { Clock3, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ComingSoonProps {
  title?: string;
  description?: string;
}

export const ComingSoon = ({
  title = "Coming soon",
  description = "This part of Rimora is still taking shape. Check back soon for more.",
}: ComingSoonProps) => (
  <Card className="overflow-hidden border-primary/20 bg-card/60 shadow-sm">
    <CardContent className="relative flex min-h-72 flex-col items-center justify-center gap-5 overflow-hidden p-8 text-center">
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full border border-primary/10 bg-primary/[0.04]" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 h-36 w-36 rounded-full border border-accent/20 bg-accent/[0.05]" />
      <div className="relative grid h-16 w-16 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary shadow-[0_0_28px_hsl(var(--primary)/0.12)]">
        <Clock3 className="h-7 w-7" />
        <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-accent" />
      </div>
      <div className="relative space-y-2">
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
    </CardContent>
  </Card>
);
