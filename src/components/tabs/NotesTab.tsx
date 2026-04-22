import { useEffect, useMemo, useRef, useState } from "react";
import { useNotes, type Note } from "@/hooks/useNotes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Star, Pin, Trash2, ArrowDownUp, Filter, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

type SortMode = "newest" | "alpha" | "important";
type FilterMode = "all" | "important";

export function NotesTab() {
  const { notes, loading, createNote, updateNote, deleteNote } = useNotes();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("newest");
  const [filter, setFilter] = useState<FilterMode>("all");

  // Local editor state (debounced save)
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const saveTimer = useRef<number | null>(null);
  const lastLoadedId = useRef<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = notes.filter((n) => {
      if (filter === "important" && !n.is_important) return false;
      if (!q) return true;
      return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
    });
    list = [...list].sort((a, b) => {
      // Pinned always on top
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      if (sort === "alpha") {
        return (a.title || "Untitled").localeCompare(b.title || "Untitled");
      }
      if (sort === "important" && a.is_important !== b.is_important) {
        return a.is_important ? -1 : 1;
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
    return list;
  }, [notes, search, sort, filter]);

  // Auto-select first note
  useEffect(() => {
    if (!selectedId && filtered.length > 0) {
      setSelectedId(filtered[0].id);
    }
    if (selectedId && !filtered.find((n) => n.id === selectedId) && filtered.length > 0) {
      setSelectedId(filtered[0].id);
    }
    if (filtered.length === 0) {
      setSelectedId(null);
    }
  }, [filtered, selectedId]);

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  // Hydrate editor when selection changes
  useEffect(() => {
    if (!selected) {
      setDraftTitle("");
      setDraftContent("");
      lastLoadedId.current = null;
      return;
    }
    if (lastLoadedId.current !== selected.id) {
      setDraftTitle(selected.title);
      setDraftContent(selected.content);
      lastLoadedId.current = selected.id;
    }
  }, [selected]);

  // Debounced auto-save
  useEffect(() => {
    if (!selected) return;
    if (lastLoadedId.current !== selected.id) return;
    if (draftTitle === selected.title && draftContent === selected.content) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      updateNote(selected.id, { title: draftTitle, content: draftContent });
    }, 600);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [draftTitle, draftContent, selected, updateNote]);

  const handleNew = async () => {
    const n = await createNote();
    if (n) {
      setSelectedId(n.id);
      lastLoadedId.current = null;
    }
  };

  // Bullet auto-formatting on Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return;
    const ta = e.currentTarget;
    const pos = ta.selectionStart;
    const before = draftContent.slice(0, pos);
    const lineStart = before.lastIndexOf("\n") + 1;
    const currentLine = before.slice(lineStart);
    const match = currentLine.match(/^(\s*)([-*•])\s(.*)$/);
    if (match) {
      e.preventDefault();
      const [, indent, bullet, rest] = match;
      if (rest.trim() === "") {
        // Empty bullet → exit list
        const newContent = draftContent.slice(0, lineStart) + draftContent.slice(pos);
        setDraftContent(newContent);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = lineStart;
        });
      } else {
        const insert = `\n${indent}${bullet} `;
        const newContent = before + insert + draftContent.slice(pos);
        setDraftContent(newContent);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = pos + insert.length;
        });
      }
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 h-[calc(100vh-280px)] min-h-[500px]">
      {/* Sidebar */}
      <div className="flex flex-col rounded-2xl border border-border/70 bg-card overflow-hidden">
        <div className="p-3 border-b border-border/60 space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-semibold flex-1">Notes</h2>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleNew} aria-label="New note">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes…"
              className="pl-8 h-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1">
                  <ArrowDownUp className="h-3 w-3" />
                  {sort === "newest" ? "Newest" : sort === "alpha" ? "A–Z" : "Important"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Sort</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setSort("newest")}>Newest first</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort("alpha")}>Alphabetical</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort("important")}>Important on top</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1">
                  <Filter className="h-3 w-3" />
                  {filter === "all" ? "All" : "Important"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Filter</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setFilter("all")}>All notes</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter("important")}>Important only</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <StickyNote className="h-6 w-6 mx-auto mb-2 opacity-50" />
              No notes yet
            </div>
          ) : (
            <ul className="p-2 space-y-1">
              {filtered.map((n) => (
                <NoteListItem
                  key={n.id}
                  note={n}
                  active={n.id === selectedId}
                  onClick={() => setSelectedId(n.id)}
                />
              ))}
            </ul>
          )}
        </ScrollArea>
      </div>

      {/* Editor */}
      <div className="flex flex-col rounded-2xl border border-border/70 bg-card overflow-hidden">
        {selected ? (
          <NoteEditor
            key={selected.id}
            note={selected}
            title={draftTitle}
            content={draftContent}
            onTitleChange={setDraftTitle}
            onContentChange={setDraftContent}
            onKeyDown={handleKeyDown}
            onToggleImportant={() => updateNote(selected.id, { is_important: !selected.is_important })}
            onTogglePinned={() => updateNote(selected.id, { is_pinned: !selected.is_pinned })}
            onDelete={() => deleteNote(selected.id)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <StickyNote className="h-10 w-10 opacity-40" />
            <p className="text-sm">Select a note or create a new one</p>
            <Button size="sm" onClick={handleNew} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New note
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function NoteListItem({ note, active, onClick }: { note: Note; active: boolean; onClick: () => void }) {
  const preview =
    (note.content || "").replace(/\n+/g, " ").replace(/[-*•]\s/g, "").trim().slice(0, 60) || "No additional text";
  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          "w-full text-left rounded-lg px-3 py-2 transition-colors duration-150",
          "hover:bg-muted/60",
          active && "bg-muted",
        )}
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          {note.is_pinned && <Pin className="h-3 w-3 text-accent fill-accent" />}
          {note.is_important && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
          <span className="font-medium text-sm truncate flex-1">{note.title || "Untitled"}</span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{preview}</p>
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
          {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
        </p>
      </button>
    </li>
  );
}

function NoteEditor({
  note,
  title,
  content,
  onTitleChange,
  onContentChange,
  onKeyDown,
  onToggleImportant,
  onTogglePinned,
  onDelete,
}: {
  note: Note;
  title: string;
  content: string;
  onTitleChange: (v: string) => void;
  onContentChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onToggleImportant: () => void;
  onTogglePinned: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-col h-full animate-in fade-in duration-200">
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border/60">
        <span className="text-xs text-muted-foreground flex-1">
          Edited {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={onTogglePinned}
          aria-label="Toggle pin"
          title={note.is_pinned ? "Unpin" : "Pin to top"}
        >
          <Pin className={cn("h-4 w-4", note.is_pinned && "text-accent fill-accent")} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={onToggleImportant}
          aria-label="Toggle important"
          title={note.is_important ? "Remove star" : "Mark important"}
        >
          <Star className={cn("h-4 w-4", note.is_important && "text-amber-500 fill-amber-500")} />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete note?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="flex-1 overflow-auto px-6 sm:px-10 py-6">
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Title"
          className="w-full bg-transparent border-0 outline-none font-display text-2xl sm:text-3xl font-semibold tracking-tight placeholder:text-muted-foreground/50 mb-4"
        />
        <Textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Start writing… Type '- ' for a bullet list."
          className="w-full bg-transparent border-0 outline-none resize-none text-[15px] leading-7 text-foreground/90 min-h-[400px] focus-visible:ring-0 focus-visible:ring-offset-0 px-0 py-0 shadow-none"
        />
      </div>
    </div>
  );
}
