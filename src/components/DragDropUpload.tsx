
import React, { useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Upload, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { isSupportedWordMappingsFile, parseWordMappingsFile } from "@/lib/word-replacements-file";
import type { User } from "@supabase/supabase-js";

interface WordReplacement {
  id: string;
  original_word: string;
  replacement_word: string;
}

interface DragDropUploadProps {
  onImport: (replacements: Omit<WordReplacement, 'id'>[]) => Promise<void>;
  canUseFeature: boolean;
  user: User | null;
}

const DragDropUpload: React.FC<DragDropUploadProps> = ({ onImport, canUseFeature, user }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (canUseFeature) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (!canUseFeature) {
      toast({
        title: "Feature Restricted",
        description: !user ? "Please sign in to use this feature." : "This feature requires a premium account.",
        variant: "destructive",
      });
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    const mappingsFile = files.find(isSupportedWordMappingsFile);

    if (!mappingsFile) {
      toast({
        title: "Invalid File Type",
        description: "Please drop a CSV or Excel file.",
        variant: "destructive",
      });
      return;
    }

    processFile(mappingsFile);
  };

  const processFile = async (file: File) => {
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
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileInput = () => {
    if (!canUseFeature) {
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
    <div className="space-y-4">
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer",
          isDragOver && canUseFeature
            ? "border-primary bg-primary/10"
            : "border-border hover:border-primary/60 hover:bg-primary/5",
          !canUseFeature && "opacity-60 cursor-not-allowed"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileInput}
      >
        <div className="flex flex-col items-center gap-4">
          <div className={cn(
            "p-4 rounded-full transition-colors",
            isDragOver && canUseFeature
              ? "bg-primary/15"
              : "bg-muted"
          )}>
            <Upload className={cn(
              "h-8 w-8",
              isDragOver && canUseFeature
                ? "text-primary"
                : "text-muted-foreground"
            )} />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-muted-foreground">
              <span className="hidden sm:inline">
                {isDragOver ? "Drop your file here" : "Drag & drop CSV or Excel file"}
              </span>
              <span className="sm:hidden">Tap to upload CSV or Excel</span>
            </h3>
            <p className="text-sm text-muted-foreground/70 hidden sm:block">
              or click to browse files
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="border-primary/30 text-primary hover:bg-primary/10"
            disabled={!canUseFeature}
            onClick={(e) => {
              e.stopPropagation();
              triggerFileInput();
            }}
          >
            <FileText className="mr-2 h-4 w-4" />
            Choose File
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="bg-muted/50 border border-muted rounded-lg p-4">
        <h4 className="font-medium text-foreground mb-2">CSV or Excel Table Format:</h4>
        <code className="text-sm text-muted-foreground block">
          Original Word,Replacement Word<br />
          "hello","hi"<br />
          "world","universe"
        </code>
      </div>
    </div>
  );
};

export default DragDropUpload;
