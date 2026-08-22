import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { Compass, Inbox, Library, LogOut, PenLine, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const links = [
  { to: "/library", label: "Library", icon: Library },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/novels/new", label: "Create", icon: PenLine },
  { to: "/settings", label: "Settings", icon: Settings },
];

export const RimoraShell = ({ children }: { children: ReactNode }) => {
  const { user, signOut } = useAuth();
  const { resolvedTheme } = useTheme();
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    void supabase.from("profiles").select("username,avatar_url").eq("id", user.id).maybeSingle().then(({ data }) => { setProfileUsername(data?.username ?? null); setProfileAvatar(data?.avatar_url ?? null); });
  }, [user]);
  const profileName = profileUsername || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Reader";
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="z-40 flex-none border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="rounded-lg bg-transparent p-1">
              <img
                src={resolvedTheme === "dark" ? "/logo-rimora-light.svg" : "/logo-rimora-dark.svg"}
                alt="Rimora"
                className="h-10 w-auto object-contain"
              />
            </span>
            <span className="font-display text-lg font-semibold uppercase tracking-[0.12em] text-foreground">
              RIMORA
            </span>
          </Link>
          {user && <Popover><PopoverTrigger asChild><button type="button" className="cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label="Open profile menu"><ProfileAvatar name={profileName} avatarUrl={profileAvatar} className="h-10 w-10 border border-primary/30" /></button></PopoverTrigger><PopoverContent align="end" className="w-64 p-2"><div className="flex flex-col gap-1"><Link to={`/profile/${user.id}`} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground"><ProfileAvatar name={profileName} avatarUrl={profileAvatar} className="h-9 w-9" /><span className="min-w-0 truncate font-medium">{profileName}</span></Link><button type="button" className="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"><Inbox className="h-4 w-4" />Inbox</button><button type="button" onClick={() => void signOut()} className="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"><LogOut className="h-4 w-4" />Sign Out</button></div></PopoverContent></Popover>}
        </div>
      </header>
      <div className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 overflow-hidden">
        <aside className="hidden h-full w-60 shrink-0 overflow-y-auto border-r border-border px-4 py-8 md:block">
          <p className="mb-4 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Workspace</p>
          <nav className="space-y-1">{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === "/library"} className={({ isActive }) => `flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm transition-colors ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Icon className="h-4 w-4" />{label}</NavLink>)}</nav>
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-8 pb-24 sm:px-8">{children}</main>
      </div>
      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-4 border-t border-border bg-background/95 backdrop-blur-md p-2 md:hidden">{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === "/library"} className={({ isActive }) => `flex flex-col items-center gap-1 py-2 text-[10px] uppercase tracking-wide ${isActive ? "text-primary" : "text-muted-foreground"}`}><Icon className="h-4 w-4" />{label}</NavLink>)}</nav>
    </div>
  );
};