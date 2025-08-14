import React from 'react';
import { 
  BookOpen, 
  Scissors, 
  FileText, 
  Settings,
  Moon,
  Sun,
  Monitor
} from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

interface AppSidebarProps {
  onSectionClick: (sectionId: string) => void;
  currentSection: string;
}

const AppSidebar = ({ onSectionClick, currentSection }: AppSidebarProps) => {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { theme, setTheme } = useTheme();

  const sections = [
    {
      id: 'input-settings',
      title: 'Chapter Input & Settings',
      icon: Scissors,
    },
    {
      id: 'glossary',
      title: 'Glossary',
      icon: BookOpen,
    },
    {
      id: 'results',
      title: 'Separated Cards',
      icon: FileText,
    },
  ];

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

  return (
    <Sidebar className={`${collapsed ? 'w-14' : 'w-64'} border-r border-border bg-sidebar-background`}>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-lg">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <span className="font-semibold text-sidebar-foreground">Chapter Scribe</span>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarMenu>
          {sections.map((section) => (
            <SidebarMenuItem key={section.id}>
              <SidebarMenuButton
                onClick={() => onSectionClick(section.id)}
                isActive={currentSection === section.id}
                className={`w-full justify-start p-3 rounded-lg transition-colors ${
                  currentSection === section.id
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'hover:bg-sidebar-accent/50 text-sidebar-foreground'
                }`}
              >
                <section.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="ml-3">{section.title}</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>

        <SidebarSeparator className="my-4" />

        <SidebarMenu>
          <SidebarMenuItem>
            <Button
              variant="ghost"
              size="sm"
              onClick={cycleTheme}
              className={`w-full justify-start p-3 hover:bg-sidebar-accent/50 ${
                collapsed ? 'px-3' : ''
              }`}
            >
              <ThemeIcon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <span className="ml-3 capitalize">
                  {theme === 'system' ? 'Auto' : theme} Mode
                </span>
              )}
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
};

export default AppSidebar;