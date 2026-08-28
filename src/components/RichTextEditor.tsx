import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Underline,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface RichTextEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showCopyButton?: boolean;
}

const RichTextEditor = ({
  id,
  value,
  onChange,
  placeholder,
  className,
  showCopyButton = false,
}: RichTextEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const applyFormat = (command: string) => {
    editorRef.current?.focus();
    document.execCommand(command);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const copyContent = async () => {
    const plainText = (editorRef.current?.innerText ?? "").trim();
    if (!plainText) return;
    await navigator.clipboard.writeText(plainText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="overflow-hidden rounded-sm border border-input bg-background/60 ring-offset-background focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40">
      <div
        className="flex flex-wrap gap-1 border-b border-input p-1"
        role="toolbar"
        aria-label="Synopsis formatting"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Bold"
          title="Bold"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyFormat("bold")}
        >
          <Bold />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Italic"
          title="Italic"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyFormat("italic")}
        >
          <Italic />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Underline"
          title="Underline"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyFormat("underline")}
        >
          <Underline />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Bullet list"
          title="Bullet list"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyFormat("insertUnorderedList")}
        >
          <List />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Numbered list"
          title="Numbered list"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyFormat("insertOrderedList")}
        >
          <ListOrdered />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Blockquote"
          title="Blockquote"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyFormat("formatBlock")}
        >
          <Quote />
        </Button>
        {showCopyButton && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Copy chapter content"
            title={copied ? "Copied" : "Copy chapter content"}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void copyContent()}
          >
            <Copy />
          </Button>
        )}
      </div>
      <div
        id={id}
        ref={editorRef}
        contentEditable
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        className={`min-h-[138px] px-3 py-2 text-sm leading-6 outline-none empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] ${className ?? ""}`}
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        suppressContentEditableWarning
      />
    </div>
  );
};

export default RichTextEditor;
