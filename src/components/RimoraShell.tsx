import { Link, NavLink } from "react-router-dom";
import { BookOpen, Compass, Library, LogOut, PenLine, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const links = [
  { to: "/", label: "Library", icon: Library },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/novels/new", label: "Create", icon: PenLine },
  { to: "/settings", label: "Settings", icon: Settings },
];

export const RimoraShell = ({ children }: { children: React.ReactNode }) => {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-sm bg-primary text-primary-foreground shadow-[0_0_20px_hsl(182_100%_50%/0.2)]"><BookOpen className="h-5 w-5" /></span>
            <span className="font-display text-lg font-bold tracking-wide">RIMORA</span>
          </Link>
          {user && <div className="flex items-center gap-2"><span className="hidden text-xs text-muted-foreground sm:inline">{user.email}</span><Button variant="ghost" size="icon" onClick={() => void signOut()} aria-label="Sign out"><LogOut /></Button></div>}
        </div>
      </header>
      <div className="mx-auto flex max-w-[1440px]">
        <aside className="hidden min-h-[calc(100vh-4rem)] w-60 shrink-0 border-r border-border px-4 py-8 md:block">
          <p className="mb-4 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Workspace</p>
          <nav className="space-y-1">{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm transition-colors ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Icon className="h-4 w-4" />{label}</NavLink>)}</nav>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-8 pb-24 sm:px-8">{children}</main>
      </div>
      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-4 border-t border-border bg-background/95 backdrop-blur-md p-2 md:hidden">{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `flex flex-col items-center gap-1 py-2 text-[10px] uppercase tracking-wide ${isActive ? "text-primary" : "text-muted-foreground"}`}><Icon className="h-4 w-4" />{label}</NavLink>)}</nav>
    </div>
  );
};