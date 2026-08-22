import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ProfileAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
}

export const ProfileAvatar = ({
  name,
  avatarUrl,
  alt = "Profile photo",
  className,
  fallbackClassName,
}: ProfileAvatarProps) => {
  const displayName = name?.trim() || "Reader";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Avatar className={className}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt={alt} /> : null}
      <AvatarFallback className={cn("bg-card font-semibold text-primary", fallbackClassName)}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
};
