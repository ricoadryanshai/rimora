import React from 'react';
import { Scissors, BookOpen, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileBottomNavProps {
  currentSection: string;
  onSectionClick: (sectionId: string) => void;
}

const items = [
  { id: 'input-settings', label: 'Input', icon: Scissors },
  { id: 'glossary', label: 'Glossary', icon: BookOpen },
  { id: 'results', label: 'Cards', icon: FileText },
];

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentSection, onSectionClick }) => {
  return (
    <nav
      className="fixed bottom-[76px] left-0 right-0 z-30 sm:hidden bg-background/95 backdrop-blur-sm border-t border-border pb-[env(safe-area-inset-bottom,0px)]"
      aria-label="Primary"
    >
      <ul className="flex items-stretch justify-around">
        {items.map(({ id, label, icon: Icon }) => {
          const active = currentSection === id;
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                onClick={() => onSectionClick(id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'w-full min-h-[52px] flex flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default MobileBottomNav;
