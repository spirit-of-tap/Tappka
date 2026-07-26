'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Typography from '@tiptap/extension-typography';
import Image from '@tiptap/extension-image';
import { useEffect, useRef, useState } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Highlighter,
  Heading1, Heading2, Heading3,
  Quote, List, ListOrdered, Code, Minus,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link as LinkIcon, ImageIcon, Pencil, Trash2, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const MultiHighlight = Highlight.extend({
  addAttributes() {
    return {
      color: {
        default: 'yellow',
        parseHTML: (el) => el.getAttribute('data-color') ?? 'yellow',
        renderHTML: ({ color }) => ({ 'data-color': color ?? 'yellow' }),
      },
    };
  },
});

const HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: '#fef08a',
  pink:   '#f9a8d4',
  green:  '#86efac',
  blue:   '#93c5fd',
  orange: '#fdba74',
};

interface TiptapEditorProps {
  initialContent?: object;
  onChange?: (json: object, text: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
}

function ToolbarButton({ onClick, isActive, title, children }: {
  onClick: () => void; isActive?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={cn(
        'p-1.5 rounded transition-colors',
        isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-border mx-0.5 shrink-0" />;
}

export function TiptapEditor({
  initialContent,
  onChange,
  placeholder = 'Začněte psát...',
  className,
  editable = true,
}: TiptapEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [activeColor, setActiveColor] = useState('yellow');
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const bubbleMenuRef = useRef<HTMLDivElement>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkPopover, setLinkPopover] = useState<{ href: string; rect: DOMRect; pos: number } | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        link: false,
        underline: false,
      }),
      MultiHighlight.configure({ multicolor: true }),
      Underline,
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Typography,
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: initialContent ?? { type: 'doc', content: [] },
    onUpdate: ({ editor }) => {
      onChangeRef.current?.(editor.getJSON(), editor.getText());
    },
  });

  useEffect(() => {
    if (editor && initialContent && editor.isEmpty) {
      editor.commands.setContent(initialContent);
    }
  }, [editor, initialContent]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!editor || !editable || !bubbleMenuRef.current) return;
    const plugin = BubbleMenuPlugin({
      pluginKey: 'bubbleMenu',
      editor,
      element: bubbleMenuRef.current,
      shouldShow: ({ editor: e }) => !e.state.selection.empty,
    });
    editor.registerPlugin(plugin);
    return () => { editor.unregisterPlugin('bubbleMenu'); };
  // Re-creating BubbleMenuPlugin on every render would flash the menu; only re-attach when editor or editable changes.
  }, [editor, editable]);

  useEffect(() => {
    if (!editor || !editable) return;
    const dom = editor.view.dom;

    const scheduleHide = () => {
      hideTimerRef.current = setTimeout(() => setLinkPopover(null), 200);
    };
    const cancelHide = () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };

    const onMouseover = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      cancelHide();
      const href = anchor.getAttribute('href') ?? '';
      const rect = anchor.getBoundingClientRect();
      const coords = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
      setLinkPopover({ href, rect, pos: coords?.pos ?? 0 });
    };
    const onMouseout = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('a[href]')) scheduleHide();
    };

    dom.addEventListener('mouseover', onMouseover);
    dom.addEventListener('mouseout', onMouseout);
    return () => {
      dom.removeEventListener('mouseover', onMouseover);
      dom.removeEventListener('mouseout', onMouseout);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  // Link hover popover only depends on the editor instance, not on DOM event handler closures.
  }, [editor, editable]);

  if (!editor) return null;

  const applyHighlight = (color: string) => {
    setActiveColor(color);
    setPickerOpen(false);
    editor.chain().focus().setHighlight({ color }).run();
  };

  const toggleHighlight = () => {
    if (editor.isActive('highlight')) {
      editor.chain().focus().unsetHighlight().run();
    } else {
      editor.chain().focus().setHighlight({ color: activeColor }).run();
    }
  };

  const openLinkDialog = () => {
    setLinkUrl(editor.getAttributes('link').href ?? '');
    setLinkDialogOpen(true);
  };

  const applyLink = () => {
    setLinkDialogOpen(false);
    if (linkUrl.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl.trim() }).run();
    }
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/essays/upload-image', { method: 'POST', body: form });
      const { src, error } = await res.json();
      if (error) throw new Error(error);
      editor.chain().focus().setImage({ src }).run();
    } catch (e) {
      console.error('Image upload failed:', e);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn('flex flex-col', className)}>
      {editable && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
              e.target.value = '';
            }}
          />
          <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30 sticky top-0 z-10">
            {/* Headings */}
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="Nadpis 1"><Heading1 className="size-4" /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="Nadpis 2"><Heading2 className="size-4" /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} title="Nadpis 3"><Heading3 className="size-4" /></ToolbarButton>

            <Divider />

            {/* Inline formatting */}
            <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Tučné (Ctrl+B)"><Bold className="size-4" /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Kurzíva (Ctrl+I)"><Italic className="size-4" /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Podtržení (Ctrl+U)"><UnderlineIcon className="size-4" /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Přeškrtnutí"><Strikethrough className="size-4" /></ToolbarButton>

            {/* Highlight + color picker */}
            <div className="relative flex items-center" ref={pickerRef}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); toggleHighlight(); }} title="Zvýraznit"
                className={cn('p-1.5 rounded-l transition-colors', editor.isActive('highlight') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                <div className="relative">
                  <Highlighter className="size-4" />
                  <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-1 ring-background" style={{ backgroundColor: HIGHLIGHT_COLORS[activeColor] }} />
                </div>
              </button>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); setPickerOpen((o) => !o); }} title="Barva zvýraznění"
                className="p-1 rounded-r text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-[10px] leading-none">▾</button>
              {pickerOpen && (
                <div className="absolute top-full left-0 mt-1.5 flex items-center gap-1.5 bg-popover border rounded-xl px-2.5 py-2 shadow-lg z-20">
                  {Object.entries(HIGHLIGHT_COLORS).map(([name, hex]) => (
                    <button key={name} type="button" onMouseDown={(e) => { e.preventDefault(); applyHighlight(name); }} title={name}
                      className={cn('size-5 rounded-full transition-transform hover:scale-125 ring-offset-background', activeColor === name ? 'ring-2 ring-foreground ring-offset-1' : '')}
                      style={{ backgroundColor: hex }} />
                  ))}
                </div>
              )}
            </div>

            <Divider />

            {/* Text alignment */}
            <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title="Zarovnat vlevo"><AlignLeft className="size-4" /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title="Zarovnat na střed"><AlignCenter className="size-4" /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title="Zarovnat vpravo"><AlignRight className="size-4" /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} isActive={editor.isActive({ textAlign: 'justify' })} title="Zarovnat do bloku"><AlignJustify className="size-4" /></ToolbarButton>

            <Divider />

            {/* Lists / blocks */}
            <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Odrážkový seznam"><List className="size-4" /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Číslovaný seznam"><ListOrdered className="size-4" /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="Citát"><Quote className="size-4" /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive('code')} title="Kód"><Code className="size-4" /></ToolbarButton>

            <Divider />

            {/* Link & image */}
            <ToolbarButton onClick={openLinkDialog} isActive={editor.isActive('link')} title="Odkaz"><LinkIcon className="size-4" /></ToolbarButton>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}
              disabled={uploading}
              title="Vložit obrázek"
              className="p-1.5 rounded transition-colors text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              <ImageIcon className="size-4" />
            </button>

            <Divider />

            <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Oddělovač"><Minus className="size-4" /></ToolbarButton>
          </div>
        </>
      )}

      <div
        ref={bubbleMenuRef}
        style={{ visibility: 'hidden', position: 'absolute', zIndex: 50 }}
        className="flex items-center gap-0.5 bg-popover border rounded-lg shadow-lg px-1.5 py-1"
      >
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
          className={cn('p-1.5 rounded text-sm transition-colors', editor.isActive('bold') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
          <Bold className="size-3.5" />
        </button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
          className={cn('p-1.5 rounded transition-colors', editor.isActive('italic') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
          <Italic className="size-3.5" />
        </button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}
          className={cn('p-1.5 rounded transition-colors', editor.isActive('underline') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
          <UnderlineIcon className="size-3.5" />
        </button>
        <div className="w-px h-4 bg-border mx-0.5" />
        {Object.entries(HIGHLIGHT_COLORS).map(([name, hex]) => (
          <button key={name} type="button"
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setHighlight({ color: name }).run(); }}
            className={cn('size-4 rounded-full transition-transform hover:scale-125 ring-offset-background', editor.isActive('highlight', { color: name }) ? 'ring-2 ring-foreground ring-offset-1' : '')}
            style={{ backgroundColor: hex }} />
        ))}
        <div className="w-px h-4 bg-border mx-0.5" />
        <button type="button" onMouseDown={(e) => { e.preventDefault(); openLinkDialog(); }}
          className={cn('p-1.5 rounded transition-colors', editor.isActive('link') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
          <LinkIcon className="size-3.5" />
        </button>
      </div>

      <div className="px-5 py-4">
        <EditorContent
          editor={editor}
          className="[&_.tiptap]:outline-none [&_.tiptap]:min-h-64 [&_.tiptap_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child]:before:text-muted-foreground [&_.tiptap_p.is-editor-empty:first-child]:before:float-left [&_.tiptap_p.is-editor-empty:first-child]:before:h-0 [&_.tiptap_p.is-editor-empty:first-child]:before:pointer-events-none [&_.tiptap_img]:max-w-full [&_.tiptap_img]:rounded-lg [&_.tiptap_img]:my-3 [&_.tiptap_a]:text-primary [&_.tiptap_a]:underline"
        />
      </div>

      {linkPopover && (
        <div
          onMouseEnter={() => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); }}
          onMouseLeave={() => setLinkPopover(null)}
          style={{ position: 'fixed', top: linkPopover.rect.bottom + 6, left: linkPopover.rect.left, zIndex: 100 }}
          className="flex items-center gap-1 bg-popover border rounded-lg shadow-lg px-2 py-1.5 text-sm"
        >
          <a
            href={linkPopover.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline max-w-[220px] truncate"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="size-3 shrink-0" />
            <span className="truncate">{linkPopover.href}</span>
          </a>
          <div className="w-px h-4 bg-border mx-0.5" />
          <button
            type="button"
            title="Upravit odkaz"
            onMouseDown={(e) => {
              e.preventDefault();
              setLinkPopover(null);
              editor.chain().focus().setTextSelection(linkPopover.pos).extendMarkRange('link').run();
              setLinkUrl(editor.getAttributes('link').href ?? linkPopover.href);
              setLinkDialogOpen(true);
            }}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            title="Odebrat odkaz"
            onMouseDown={(e) => {
              e.preventDefault();
              setLinkPopover(null);
              editor.chain().focus().setTextSelection(linkPopover.pos).extendMarkRange('link').unsetLink().run();
            }}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Vložit odkaz</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="link-url">URL</Label>
            <Input
              id="link-url"
              type="url"
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } }}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            {editor.isActive('link') && (
              <Button variant="ghost" onClick={() => { setLinkDialogOpen(false); editor.chain().focus().extendMarkRange('link').unsetLink().run(); }}>
                Odebrat
              </Button>
            )}
            <Button onClick={applyLink}>Uložit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
