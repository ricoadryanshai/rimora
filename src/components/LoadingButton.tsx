import type { ComponentProps } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LoadingButtonProps extends ComponentProps<typeof Button> {
  loading?: boolean;
  loadingLabel?: string;
}

export const LoadingButton = ({
  loading = false,
  loadingLabel = "Loading...",
  children,
  disabled,
  ...props
}: LoadingButtonProps) => (
  <Button {...props} disabled={disabled || loading} aria-busy={loading}>
    {loading ? <Loader2 className="animate-spin" /> : null}
    {loading ? loadingLabel : children}
  </Button>
);
