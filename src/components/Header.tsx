
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogOut, User, Crown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const Header = () => {
  const { user, userRole, signOut } = useAuth();
  const { toast } = useToast();

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed Out",
      description: "You have been successfully signed out.",
    });
  };

  if (!user) return null;

  return (
    <Card className="mb-4 sm:mb-8 shadow-lg border-0 <Card className="mb-4 sm:mb-8 shadow-lg border-0 bg-card/80 backdrop-blur-sm">">
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <User className="h-5 w-5 text-primary shrink-0" />
              <span className="font-medium text-foreground truncate text-sm">{user.email}</span>
            </div>
            {userRole && (
              <Badge 
                variant={userRole === 'super_user' ? 'default' : 'secondary'}
                className={userRole === 'super_user' ? 'bg-purple-600 hover:bg-purple-700' : ''}
              >
                {userRole === 'super_user' && <Crown className="h-3 w-3 mr-1" />}
                {userRole === 'super_user' ? 'Super User' : 'User'}
              </Badge>
            )}
          </div>
          <Button 
            onClick={handleSignOut}
            variant="outline"
            size="sm"
            className="border-destructive/30 text-destructive hover:bg-destructive/10 shrink-0"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default Header;
