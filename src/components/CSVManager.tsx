
import React, { useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Upload, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface WordReplacement {
  id: string;
  original_word: string;
  replacement_word: string;
}

interface CSVManagerProps {
  replacements: WordReplacement[];
  onImport: (replacements: Omit<WordReplacement, 'id'>[]) => void;
  userRole: string | null;
}

const CSVManager: React.FC<CSVManagerProps> = ({ replacements, onImport, userRole }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const canUseFeature = () => {
    if (!user) return false;
    if (userRole === 'super_user') return true;
    // For now, we'll assume regular users have paid - in a real app, you'd check payment status
    return userRole === 'user';
  };

  const exportToCSV = () => {
    if (!canUseFeature()) {
      toast({
        title: "Feature Restricted",
        description: !user ? "Please sign in to use this feature." : "This feature requires a premium account.",
        variant: "destructive",
      });
      return;
    }

    if (replacements.length === 0) {
      toast({
        title: "No Data to Export",
        description: "Add some word replacements before exporting.",
        variant: "destructive",
      });
      return;
    }

    const csvContent = [
      'Original Word,Replacement Word',
      ...replacements.map(r => `"${r.original_word}","${r.replacement_word}"`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'word-replacements.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Successful",
      description: `Exported ${replacements.length} word replacements to CSV.`,
    });
  };

  const importFromCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!canUseFeature()) {
      toast({
        title: "Feature Restricted",
        description: !user ? "Please sign in to use this feature." : "This feature requires a premium account.",
        variant: "destructive",
      });
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast({
        title: "Invalid File Type",
        description: "Please select a CSV file.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        // Skip header row if it exists
        const dataLines = lines[0].toLowerCase().includes('original') ? lines.slice(1) : lines;
        
        const importedReplacements: Omit<WordReplacement, 'id'>[] = [];
        
        for (const line of dataLines) {
          // Parse CSV line with proper quote handling
          const match = line.match(/^"([^"]*)","([^"]*)"$/) || line.match(/^([^,]*),(.*)$/);
          if (match) {
            const [, original, replacement] = match;
            if (original?.trim() && replacement?.trim()) {
              importedReplacements.push({
                original_word: original.trim(),
                replacement_word: replacement.trim(),
              });
            }
          }
        }

        if (importedReplacements.length === 0) {
          toast({
            title: "No Valid Data",
            description: "No valid word replacement pairs found in the CSV file.",
            variant: "destructive",
          });
          return;
        }

        onImport(importedReplacements);
        
        toast({
          title: "Import Successful",
          description: `Imported ${importedReplacements.length} word replacement pairs.`,
        });
      } catch (error) {
        console.error('Error parsing CSV:', error);
        toast({
          title: "Import Failed",
          description: "Failed to parse the CSV file. Please check the format.",
          variant: "destructive",
        });
      }
    };

    reader.readAsText(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileInput = () => {
    if (!canUseFeature()) {
      toast({
        title: "Feature Restricted",
        description: !user ? "Please sign in to use this feature." : "This feature requires a premium account.",
        variant: "destructive",
      });
      return;
    }
    fileInputRef.current?.click();
  };

  return (
    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl">
          <FileText className="h-5 w-5 text-green-600" />
          Import/Export Word Mappings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!user && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              Sign in to access import/export features for your word replacements.
            </p>
          </div>
        )}
        
        {user && userRole !== 'super_user' && userRole !== 'user' && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-orange-800 text-sm">
              Premium account required to use import/export features.
            </p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Export to CSV</Label>
            <Button
              onClick={exportToCSV}
              variant="outline"
              className="w-full border-green-200 text-green-600 hover:bg-green-50"
              disabled={!canUseFeature() || replacements.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
          
          <div className="space-y-2">
            <Label className="text-sm font-medium">Import from CSV</Label>
            <Button
              onClick={triggerFileInput}
              variant="outline"
              className="w-full border-blue-200 text-blue-600 hover:bg-blue-50"
              disabled={!canUseFeature()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={importFromCSV}
              className="hidden"
            />
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-800 mb-2">CSV Format Example:</h4>
          <code className="text-sm text-gray-600 block">
            Original Word,Replacement Word<br />
            "hello","hi"<br />
            "world","universe"
          </code>
        </div>
      </CardContent>
    </Card>
  );
};

export default CSVManager;
