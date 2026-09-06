import { Grid2X2, List } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ViewMode = "grid" | "list";

type ViewModeToggleProps = {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  storageKey?: string;
};

export const ViewModeToggle = ({
  value,
  onChange,
  storageKey,
}: ViewModeToggleProps) => {
  const selectMode = (mode: ViewMode) => {
    if (storageKey) window.localStorage.setItem(storageKey, mode);
    onChange(mode);
  };

  return (
    <div
      className="flex items-center rounded-sm border border-border p-1"
      aria-label="View mode"
    >
      <Button
        type="button"
        variant={value === "grid" ? "secondary" : "ghost"}
        size="icon"
        className="h-8 w-8"
        aria-label="Grid view"
        aria-pressed={value === "grid"}
        onClick={() => selectMode("grid")}
      >
        <Grid2X2 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={value === "list" ? "secondary" : "ghost"}
        size="icon"
        className="h-8 w-8"
        aria-label="List view"
        aria-pressed={value === "list"}
        onClick={() => selectMode("list")}
      >
        <List className="h-4 w-4" />
      </Button>
    </div>
  );
};
