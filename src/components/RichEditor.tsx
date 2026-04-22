import { useEffect, useRef } from "react";
import { Bold, Italic, Heading1, Heading2, List, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Lightweight contenteditable rich text editor.
 * Supports H1, H2, bold, italic, bullet lists, checklists.
 * Stores HTML.
 */
export function RichEditor({ value, onChange, placeholder, className }: RichEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);

  // Sync external value -> editor (only when meaningfully different)
  useEffect(() => {
    if (!ref.current) return;
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    if (ref.current.innerHTML !== (value || "")) {
      ref.current.innerHTML = value || "";
    }
  }, [value]);

  const exec = (cmd: string, arg?: string) => {
    document.execCommand(cmd, false, arg);
    ref.current?.focus();
    handleInput();
  };

  const handleInput = () => {
    if (!ref.current) return;
    isInternalChange.current = true;
    onChange(ref.current.innerHTML);
  };

  const insertChecklist = () => {
    // Insert a checklist line at the caret. We mark the LI with data-check.
    const html = `<ul data-checklist="true"><li data-check="false">New item</li></ul>`;
    document.execCommand("insertHTML", false, html);
    handleInput();
  };

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "LI" && target.dataset.check !== undefined) {
      // Click near the bullet (left ~24px) toggles
      const rect = target.getBoundingClientRect();
      if (e.clientX - rect.left < 28) {
        target.dataset.check = target.dataset.check === "true" ? "false" : "true";
        handleInput();
        e.preventDefault();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Tab inside checklist: do nothing fancy; let default
    if (e.key === "Tab") {
      e.preventDefault();
      document.execCommand("insertText", false, "  ");
      handleInput();
    }
  };

  const tools: { icon: React.ReactNode; title: string; onClick: () => void }[] = [
    { icon: <Heading1 className="h-3.5 w-3.5" />, title: "Heading 1", onClick: () => exec("formatBlock", "H1") },
    { icon: <Heading2 className="h-3.5 w-3.5" />, title: "Heading 2", onClick: () => exec("formatBlock", "H2") },
    { icon: <Bold className="h-3.5 w-3.5" />, title: "Bold", onClick: () => exec("bold") },
    { icon: <Italic className="h-3.5 w-3.5" />, title: "Italic", onClick: () => exec("italic") },
    { icon: <List className="h-3.5 w-3.5" />, title: "Bullets", onClick: () => exec("insertUnorderedList") },
    { icon: <CheckSquare className="h-3.5 w-3.5" />, title: "Checklist", onClick: insertChecklist },
  ];

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex flex-wrap items-center gap-0.5 mb-3 pb-3 border-b border-border/60">
        {tools.map((t, i) => (
          <Button
            key={i}
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onMouseDown={(e) => { e.preventDefault(); t.onClick(); }}
            title={t.title}
          >
            {t.icon}
          </Button>
        ))}
        <span className="ml-auto text-[11px] text-muted-foreground">Auto-saved</span>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder ?? "Start writing…"}
        className={cn(
          "rich-editor flex-1 outline-none text-[15px] leading-7 text-foreground/90",
          "prose-headings:font-display prose-headings:tracking-tight",
        )}
      />
    </div>
  );
}
