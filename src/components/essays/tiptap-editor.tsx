'use client';

import { useEditor, EditorContent, useEditorState, type Editor } from '@tiptap/react';
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu';
import Image from '@tiptap/extension-image';
import { useEffect, useRef, useState } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Highlighter,
  Heading1, Heading2, Heading3,
  Quote, List, ListOrdered, Code, Minus,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link as LinkIcon, ImageIcon, Pencil, Trash2, ExternalLink, Camera,
  Table2, Rows3, Columns3, TableCellsMerge,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { PENDING_IMAGE_ATTR, stripPendingImages } from '@/lib/essays/pending-images';
import { EMPTY_DOC, normalizeContentJson } from '@/lib/essays/content-text';
import { prepareEssayImage, uploadEssayImage, validateEssayImage } from '@/lib/essays/image-upload';
import { extractImageFiles } from '@/lib/essays/pasted-images';
import { parseMarkdownTable } from '@/lib/essays/markdown-table';
import { createTiptapExtensions } from '@/lib/essays/tiptap-extensions';

/**
 * Carries the in-flight marker into the DOM as `data-uploading`, which the
 * stylesheet uses to dim the picture while it uploads. Autosave never sees it:
 * `stripPendingImages` removes these nodes on the way out.
 */
const UploadableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      [PENDING_IMAGE_ATTR]: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-uploading'),
        renderHTML: (attrs) =>
          attrs[PENDING_IMAGE_ATTR] == null ? {} : { 'data-uploading': attrs[PENDING_IMAGE_ATTR] },
      },
    };
  },
});

/** Position of the image node currently showing `src`, or null if it is gone. */
function findImagePos(editor: Editor, src: string): number | null {
  let match: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (match != null) return false;
    if (node.type.name === 'image' && node.attrs.src === src) {
      match = pos;
      return false;
    }
    return true;
  });
  return match;
}

/**
 * Swaps a finished upload's placeholder for the stored URL, or drops the node
 * when the upload failed. A no-op if the author deleted the image meanwhile.
 */
function settlePendingImage(editor: Editor, placeholderSrc: string, uploadedSrc: string | null) {
  const pos = findImagePos(editor, placeholderSrc);
  if (pos == null) return;

  const node = editor.state.doc.nodeAt(pos);
  if (!node) return;

  const tr = editor.state.tr;
  if (uploadedSrc == null) {
    tr.delete(pos, pos + node.nodeSize);
  } else {
    tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      src: uploadedSrc,
      [PENDING_IMAGE_ATTR]: null,
    });
  }
  editor.view.dispatch(tr);
}

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
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  // useEditor is created once, but handleImageUpload is redefined every
  // render — the paste/drop handlers below go through this ref so they always
  // call the current version.
  const handleImageUploadRef = useRef<(file: File) => void>(() => {});
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [hasCoarsePointer, setHasCoarsePointer] = useState(false);
  const bubbleMenuRef = useRef<HTMLDivElement>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkPopover, setLinkPopover] = useState<{ href: string; rect: DOMRect; pos: number } | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: createTiptapExtensions({
      image: UploadableImage.configure({ inline: false, allowBase64: false }),
      placeholder,
    }),
    // A pasted or dropped image (screenshot via Ctrl+V, a file from the
    // desktop) carries image files in the payload — send each through the
    // same upload pipeline as the toolbar picker. Anything else (text, HTML)
    // falls through to the default handling by returning false.
    editorProps: {
      handlePaste: (view, event) => {
        const images = extractImageFiles(event.clipboardData?.files);
        if (images.length > 0) {
          images.forEach((file) => handleImageUploadRef.current(file));
          return true;
        }

        // Pipe tables pasted as plain text (from a chat, a doc, a code block)
        // become real tables; anything else keeps the browser's paste paths.
        const table = parseMarkdownTable(event.clipboardData?.getData('text/plain') ?? '');
        if (!table) return false;
        try {
          view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.nodeFromJSON(table)));
        } catch {
          return false;
        }
        return true;
      },
      handleDrop: (_view, event) => {
        const images = extractImageFiles(event.dataTransfer?.files);
        if (images.length === 0) return false;
        event.preventDefault();
        images.forEach((file) => handleImageUploadRef.current(file));
        return true;
      },
    },
    content: normalizeContentJson(initialContent ?? EMPTY_DOC),
    onUpdate: ({ editor }) => {
      // Stripped, not raw: a blob: URL saved to the database is a dead image.
      onChangeRef.current?.(stripPendingImages(editor.getJSON()), editor.getText());
    },
  });

  // Selection changes don't re-render the editor on their own, so the toolbar
  // state has to be subscribed to explicitly. The dropdown inserts a table
  // outside one and edits the current table inside it.
  const inTable =
    useEditorState({
      editor,
      selector: ({ editor: current }) =>
        Boolean(current?.isActive('tableCell') || current?.isActive('tableHeader')),
    }) ?? false;

  useEffect(() => {
    if (editor && initialContent && editor.isEmpty) {
      editor.commands.setContent(normalizeContentJson(initialContent));
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

  // Offering "Vyfotit" only where there is realistically a camera. Read after
  // mount so the server and the client render the same markup.
  useEffect(() => {
    setHasCoarsePointer(window.matchMedia('(pointer: coarse)').matches);
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

  /**
   * Shows the picture in the document straight away from a local blob URL, then
   * swaps in the stored URL once it lands. The author sees where the image will
   * sit while it uploads, and a failure removes it again with a real message
   * instead of vanishing into the console.
   */
  const handleImageUpload = async (file: File) => {
    const problem = validateEssayImage(file);
    if (problem) {
      toast.error(problem);
      return;
    }

    const placeholderSrc = URL.createObjectURL(file);
    editor
      .chain()
      .focus()
      .insertContent({ type: 'image', attrs: { src: placeholderSrc, [PENDING_IMAGE_ATTR]: 'true' } })
      .run();
    setUploadPercent(0);

    try {
      const prepared = await prepareEssayImage(file);
      const uploadedSrc = await uploadEssayImage(prepared, setUploadPercent);
      settlePendingImage(editor, placeholderSrc, uploadedSrc);
    } catch (error) {
      settlePendingImage(editor, placeholderSrc, null);
      toast.error(error instanceof Error ? error.message : 'Nahrání obrázku selhalo.');
    } finally {
      URL.revokeObjectURL(placeholderSrc);
      setUploadPercent(null);
    }
  };
  handleImageUploadRef.current = handleImageUpload;

  return (
    <div className={cn('flex flex-col', className)}>
      {editable && (
        <>
          {/* `image/*` rather than a MIME list: an explicit list makes iOS and
              Android narrow the share sheet to file browsing and drop the
              camera entry. The type is validated in JS instead. */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
              e.target.value = '';
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
              e.target.value = '';
            }}
          />
          {/* Sticky so the toolbar stays reachable in a long essay. Needs an
              ancestor chain without `overflow: hidden`, which would pin it. */}
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-t-xl border-b bg-card/95 px-2 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-card/80">
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

            <DropdownMenu>
              <DropdownMenuTrigger
                title="Tabulka"
                className={cn(
                  'rounded p-1.5 transition-colors',
                  inTable ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Table2 className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {inTable ? (
                  <>
                    <DropdownMenuItem
                      disabled={!editor.can().addRowAfter()}
                      onSelect={() => editor.chain().focus().addRowAfter().run()}
                    >
                      <Rows3 className="size-4" /> Přidat řádek
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!editor.can().addColumnAfter()}
                      onSelect={() => editor.chain().focus().addColumnAfter().run()}
                    >
                      <Columns3 className="size-4" /> Přidat sloupec
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!editor.can().deleteRow()}
                      onSelect={() => editor.chain().focus().deleteRow().run()}
                    >
                      <Trash2 className="size-4" /> Smazat řádek
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!editor.can().deleteColumn()}
                      onSelect={() => editor.chain().focus().deleteColumn().run()}
                    >
                      <Trash2 className="size-4" /> Smazat sloupec
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!editor.can().toggleHeaderRow()}
                      onSelect={() => editor.chain().focus().toggleHeaderRow().run()}
                    >
                      <TableCellsMerge className="size-4" /> Přepnout hlavičku
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => editor.chain().focus().deleteTable().run()}
                    >
                      <Trash2 className="size-4" /> Smazat tabulku
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem
                    onSelect={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                  >
                    <Table2 className="size-4" /> Vložit tabulku
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Divider />

            {/* Link & image */}
            <ToolbarButton onClick={openLinkDialog} isActive={editor.isActive('link')} title="Odkaz"><LinkIcon className="size-4" /></ToolbarButton>
            {hasCoarsePointer ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={uploadPercent != null}
                  title="Vložit obrázek"
                  className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                  <ImageIcon className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onSelect={() => cameraInputRef.current?.click()}>
                    <Camera className="size-4" />
                    Vyfotit
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => galleryInputRef.current?.click()}>
                    <ImageIcon className="size-4" />
                    Vybrat obrázek
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); galleryInputRef.current?.click(); }}
                disabled={uploadPercent != null}
                title="Vložit obrázek"
                className="p-1.5 rounded transition-colors text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
              >
                <ImageIcon className="size-4" />
              </button>
            )}

            <Divider />

            <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Oddělovač"><Minus className="size-4" /></ToolbarButton>

            {/* Lives in the sticky toolbar, not under the editor: a tall photo
                pushes the bottom of the card off-screen exactly when the author
                most wants to know the upload is moving. */}
            {uploadPercent != null && (
              <span
                role="status"
                className="ml-auto flex items-center gap-1.5 pr-1 text-xs text-muted-foreground"
              >
                <Spinner className="size-3" />
                Nahrávám obrázek…
                {/* Only once there is a real figure: on a fast connection the
                    body is gone before the first progress event, and a frozen
                    "0 %" reads as a stall. */}
                {uploadPercent > 0 && (
                  <span className="tabular-nums">{uploadPercent} %</span>
                )}
              </span>
            )}
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

      {/* flex-1 + h-full on the ProseMirror node: clicking the empty space
          under the last paragraph should place the caret, not do nothing. */}
      <div className="flex flex-1 flex-col px-5 py-4 sm:px-8 sm:py-6">
        <EditorContent
          editor={editor}
          className="flex-1 [&_.tiptap]:h-full [&_.tiptap]:outline-none [&_.tiptap]:min-h-64 [&_.tiptap_img[data-uploading]]:opacity-40 [&_.tiptap_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child]:before:text-muted-foreground [&_.tiptap_p.is-editor-empty:first-child]:before:float-left [&_.tiptap_p.is-editor-empty:first-child]:before:h-0 [&_.tiptap_p.is-editor-empty:first-child]:before:pointer-events-none [&_.tiptap_img]:max-w-full [&_.tiptap_img]:rounded-lg [&_.tiptap_img]:my-3 [&_.tiptap_a]:text-primary [&_.tiptap_a]:underline"
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
