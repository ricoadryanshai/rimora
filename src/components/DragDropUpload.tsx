
import React, { useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Upload, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { parseWordReplacementsCsv } from "@/lib/word-replacements-csv";
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
    const csvFile = files.find(file => file.type === 'text/csv' || file.name.endsWith('.csv'));

    if (!csvFile) {
      toast({
        title: "Invalid File Type",
        description: "Please drop a CSV file.",
        variant: "destructive",
      });
      return;
    }

    processFile(csvFile);
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const importedReplacements = parseWordReplacementsCsv(text);

        if (importedReplacements.length === 0) {
          toast({
            title: "No Valid Data",
            description: "No valid word replacement pairs found in the CSV file.",
            variant: "destructive",
          });
          return;
        }

        await onImport(importedReplacements);
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
            ? "border-blue-400 bg-blue-50" 
            : "border-gray-300 hover:border-blue-300 hover:bg-blue-50/50",
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
              ? "bg-blue-100" 
              : "bg-gray-100"
          )}>
            <Upload className={cn(
              "h-8 w-8",
              isDragOver && canUseFeature 
                ? "text-blue-600" 
                : "text-gray-500"
            )} />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-muted-foreground">
              <span className="hidden sm:inline">
                {isDragOver ? "Drop your CSV file here" : "Drag & drop CSV file"}
              </span>
              <span className="sm:hidden">Tap to upload CSV</span>
            </h3>
            <p className="text-sm text-muted-foreground/70 hidden sm:block">
              or click to browse files
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="border-blue-200 text-blue-600 hover:bg-blue-50"
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
        accept=".csv"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-800 mb-2">CSV Format Expected:</h4>
        <code className="text-sm text-gray-600 block">
          Original Word,Replacement Word<br />
          "hello","hi"<br />
          "world","universe"
        </code>
      </div>
    </div>
  );
};

export default DragDropUpload;
