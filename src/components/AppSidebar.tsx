import React from 'react';
import { BookOpen, Scissors, FileText, Settings, Moon, Sun, Monitor, Brain } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarSeparator, useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
interface AppSidebarProps {
  onSectionClick: (sectionId: string) => void;
  currentSection: string;
}
const AppSidebar = ({
  onSectionClick,
  currentSection
}: AppSidebarProps) => {
  const {
    state,
    toggleSidebar
  } = useSidebar();
  const collapsed = state === 'collapsed';
  const isMobile = useIsMobile();
  const {
    theme,
    setTheme
  } = useTheme();
  const sections = [{
    id: 'input-settings',
    title: 'Chapter Input & Settings',
    icon: Scissors
  }, {
    id: 'glossary',
    title: 'Glossary',
    icon: BookOpen
  }, {
    id: 'results',
    title: 'Separated Cards',
    icon: FileText
  }, {
    id: 'ai-providers',
    title: 'AI Providers',
    icon: Brain
  }];
  const themeIcon = theme === 'dark' ? Sun : theme === 'light' ? Monitor : Moon;
  const ThemeIcon = themeIcon;
  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };
  return <Sidebar className={`${collapsed ? 'w-14' : 'w-64'} border-r border-border bg-sidebar-background`}>
      <SidebarHeader className="border-b border-sidebar-border p-3 sm:p-4">
        {!collapsed && <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-lg">
              <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <span className="font-semibold text-sidebar-foreground text-sm sm:text-base">Chapter Separator</span>
          </div>}
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarMenu>
          {sections.map(section => <SidebarMenuItem key={section.id}>
              <SidebarMenuButton onClick={() => {
                onSectionClick(section.id);
                if (isMobile) toggleSidebar();
              }} isActive={currentSection === section.id} className={`w-full justify-start p-2 sm:p-3 rounded-lg transition-colors ${currentSection === section.id ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-sidebar-accent/50 text-sidebar-foreground'}`}>
                <section.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="ml-2 sm:ml-3 text-sm sm:text-base">{section.title}</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>)}
        </SidebarMenu>

        <SidebarSeparator className="my-3 sm:my-4" />

        <SidebarMenu>
          <SidebarMenuItem>
            <Button variant="ghost" size="sm" onClick={cycleTheme} className={`w-full justify-start p-2 sm:p-3 hover:bg-sidebar-accent/50 text-sm sm:text-base ${collapsed ? 'px-2 sm:px-3' : ''}`}>
              <ThemeIcon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="ml-2 sm:ml-3 capitalize">
                  {theme === 'system' ? 'Auto' : theme} Mode
                </span>}
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>;
};
export default AppSidebar;