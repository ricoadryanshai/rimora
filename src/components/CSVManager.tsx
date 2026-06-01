
import React, { useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Upload, Download, FileSpreadsheet } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { isSupportedWordMappingsFile, parseWordMappingsFile } from "@/lib/word-replacements-file";

interface WordReplacement {
  id: string;
  original_word: string;
  replacement_word: string;
}

interface CSVManagerProps {
  replacements: WordReplacement[];
  onImport: (replacements: Omit<WordReplacement, 'id'>[]) => Promise<void>;
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

  const triggerDownload = (blob: Blob, filename: string) => {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const ensureExportable = () => {
    if (!canUseFeature()) {
      toast({
        title: "Feature Restricted",
        description: !user ? "Please sign in to use this feature." : "This feature requires a premium account.",
        variant: "destructive",
      });
      return false;
    }
    if (replacements.length === 0) {
      toast({
        title: "No Data to Export",
        description: "Add some word replacements before exporting.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const exportToCSV = () => {
    if (!ensureExportable()) return;

    const csvContent = [
      'Original Word,Replacement Word',
      ...replacements.map(r => `"${r.original_word}","${r.replacement_word}"`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, 'word-replacements.csv');

    toast({
      title: "Export Successful",
      description: `Exported ${replacements.length} word replacements to CSV.`,
    });
  };

  const exportToExcel = async () => {
    if (!ensureExportable()) return;

    try {
      const { default: writeXlsxFile } = await import('write-excel-file/browser');
      const schema = [
        { column: 'Original Word', type: String, value: (r: WordReplacement) => r.original_word },
        { column: 'Replacement Word', type: String, value: (r: WordReplacement) => r.replacement_word },
      ];
      const blob = await writeXlsxFile(replacements, {
        schema,
        fileName: undefined,
      } as never) as unknown as Blob;
      triggerDownload(blob, 'word-replacements.xlsx');

      toast({
        title: "Export Successful",
        description: `Exported ${replacements.length} word replacements to Excel.`,
      });
    } catch (error) {
      console.error('Excel export failed:', error);
      toast({
        title: "Export Failed",
        description: "Could not generate the Excel file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const importFromFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

    if (!isSupportedWordMappingsFile(file)) {
      toast({
        title: "Invalid File Type",
        description: "Please select a CSV or Excel file.",
        variant: "destructive",
      });
      return;
    }

    try {
      const importedReplacements = await parseWordMappingsFile(file);

      if (importedReplacements.length == 0) {
        toast({
          title: "No Valid Data",
          description: "No valid word replacement pairs found in the selected file.",
          variant: "destructive",
        });
        return;
      }

      await onImport(importedReplacements);
    } catch (error) {
      console.error('Error parsing word mappings file:', error);
      toast({
        title: "Import Failed",
        description: "Failed to parse the file. Please check the CSV or Excel table format.",
        variant: "destructive",
      });
    }
    
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
    <Card className="glass-card shadow-elegant hover:shadow-glow transition-smooth">
      <CardHeader className="pb-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-t-lg">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="gradient-primary p-2 rounded-lg shadow-sm">
            <FileText className="h-5 w-5 text-primary-foreground" />
          </div>
          Import/Export Word Mappings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!user && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 transition-smooth">
            <p className="text-primary text-sm font-medium">
              Sign in to access import/export features for your word replacements.
            </p>
          </div>
        )}
        
        {user && userRole !== 'super_user' && userRole !== 'user' && (
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 transition-smooth">
            <p className="text-warning-foreground text-sm font-medium">
              Premium account required to use import/export features.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Export to CSV or Excel</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full border-accent/30 text-accent hover:bg-accent/10 hover:border-accent/50 transition-smooth shadow-accent/20 hover:shadow-accent"
                  disabled={!canUseFeature() || replacements.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={exportToCSV}>
                  <FileText className="mr-2 h-4 w-4" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToExcel}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Export as Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          
          <div className="space-y-2">
            <Label className="text-sm font-medium">Import from CSV or Excel</Label>
            <Button
              onClick={triggerFileInput}
              variant="outline"
              className="w-full border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 transition-smooth shadow-primary/20 hover:shadow-glow"
              disabled={!canUseFeature()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import File
            </Button>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              onChange={importFromFile}
              className="hidden"
            />
          </div>
        </div>

        <div className="bg-muted/50 border border-muted rounded-lg p-4 transition-smooth">
          <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-accent rounded-full"></div>
            CSV or Excel Table Format:
          </h4>
          <code className="text-sm text-muted-foreground block font-mono bg-background/50 p-2 rounded border">
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
