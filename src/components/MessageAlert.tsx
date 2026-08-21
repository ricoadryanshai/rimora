import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type MessageAlertType = "success" | "error" | "warning" | "info";

interface MessageAlertProps {
  type: MessageAlertType;
  message: ReactNode;
  title?: string;
  className?: string;
}

const styles: Record<
  MessageAlertType,
  { icon: typeof Info; border: string; iconColor: string; title: string }
> = {
  success: {
    icon: CheckCircle2,
    border: "border-emerald-500/60 bg-emerald-500/10",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    title: "Success",
  },
  error: {
    icon: AlertCircle,
    border: "border-red-500/60 bg-red-500/10",
    iconColor: "text-red-600 dark:text-red-400",
    title: "Error",
  },
  warning: {
    icon: TriangleAlert,
    border: "border-amber-500/60 bg-amber-500/10",
    iconColor: "text-amber-700 dark:text-amber-400",
    title: "Warning",
  },
  info: {
    icon: Info,
    border: "border-sky-500/60 bg-sky-500/10",
    iconColor: "text-sky-600 dark:text-sky-400",
    title: "Information",
  },
};

export const MessageAlert = ({
  type,
  message,
  title,
  className,
}: MessageAlertProps) => {
  const style = styles[type];
  const Icon = style.icon;

  return (
    <Alert className={cn("mb-6 shadow-sm", style.border, className)}>
      <Icon className={style.iconColor} />
      <AlertTitle className={style.iconColor}>{title ?? style.title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
};
