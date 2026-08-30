import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  Compass,
  Inbox,
  Library,
  LogIn,
  LogOut,
  Moon,
  PenLine,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const links = [
  { to: "/library", label: "Library", icon: Library },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/workspace", label: "Create", icon: PenLine },
];

export const RimoraShell = ({
  children,
  immersiveMobile = false,
}: {
  children: ReactNode;
  immersiveMobile?: boolean;
}) => {
  const location = useLocation();
  const isImmersiveMobile =
    immersiveMobile || location.pathname.includes("/read");
  const { user, signOut } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("username,avatar_url,theme")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("Could not load saved theme:", error);
          return;
        }
        setProfileUsername(data?.username ?? null);
        setProfileAvatar(data?.avatar_url ?? null);
        if (data?.theme === "light" || data?.theme === "dark")
          setTheme(data.theme);
      });
  }, [user, setTheme]);
  const profileName =
    profileUsername ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Reader";
  const isDarkTheme = resolvedTheme === "dark";
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header
        className={`${isImmersiveMobile ? "hidden md:flex" : "flex"} z-40 flex-none border-b border-border bg-background/80 backdrop-blur-md`}
      >
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-8">
          <Link to="/" className="flex items-center gap-4">
            <span className="rounded-lg bg-transparent p-1">
              <img
                src="/logo-rimora-dark.svg"
                alt="Rimora"
                className="h-10 w-auto object-contain"
              />
            </span>
          </Link>
          <nav
            className="hidden items-center gap-3 md:flex"
            aria-label="Primary navigation"
          >
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/library"}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <nav
              className="flex items-center gap-2 md:hidden"
              aria-label="Primary navigation"
            >
              {links.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/library"}
                  aria-label={label}
                  className={({ isActive }) =>
                    `rounded-sm p-2 transition-colors ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`
                  }
                >
                  <Icon className="h-4 w-4" />
                </NavLink>
              ))}
            </nav>
            {user ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const nextTheme = isDarkTheme ? "light" : "dark";
                    setTheme(nextTheme);
                    window.localStorage.setItem("rimora-theme", nextTheme);
                    void supabase
                      .from("profiles")
                      .update({ theme: nextTheme })
                      .eq("id", user.id)
                      .then(({ error }) => {
                        if (error)
                          console.error("Could not save theme preference:", error);
                      });
                  }}
                  className="grid h-10 w-10 place-items-center rounded-full border border-primary/30 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={isDarkTheme ? "Switch to light theme" : "Switch to dark theme"}
                  title={isDarkTheme ? "Switch to light theme" : "Switch to dark theme"}
                >
                  {isDarkTheme ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                </button>
                <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label="Open profile menu"
                  >
                    <ProfileAvatar
                      name={profileName}
                      avatarUrl={profileAvatar}
                      className="h-10 w-10 border border-primary/30"
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-2">
                  <div className="flex flex-col gap-1">
                    <Link
                      to={`/profile/${user.id}`}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <ProfileAvatar
                        name={profileName}
                        avatarUrl={profileAvatar}
                        className="h-9 w-9"
                      />
                      <span className="min-w-0 truncate font-medium">
                        {profileName}
                      </span>
                    </Link>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <Inbox className="h-4 w-4" />
                      Inbox
                    </button>
                    <ConfirmationDialog
                      trigger={
                        <button
                          type="button"
                          className="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign Out
                        </button>
                      }
                      title="Sign out?"
                      description="Are you sure you want to sign out of your account?"
                      confirmLabel="Sign Out"
                      destructive
                      onConfirm={() => void signOut()}
                    />
                  </div>
                </PopoverContent>
                </Popover>
              </div>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link to="/auth">
                  <LogIn className="mr-2 h-4 w-4" />
                  Login
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>
      <div className="flex min-h-0 w-full flex-1 overflow-hidden">
        <main
          className={`min-w-0 flex-1 overflow-y-auto ${isImmersiveMobile ? "px-0 py-0 pb-0 md:px-4 md:py-8 md:pb-24 sm:px-8" : "px-4 py-8 pb-24 sm:px-8"}`}
        >
          {children}
        </main>
      </div>
    </div>
  );
};
