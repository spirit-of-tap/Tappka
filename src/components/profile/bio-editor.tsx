'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Quote, Link as LinkIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EMPTY_DOC, normalizeContentJson } from '@/lib/essays/content-text';
import { isAllowedLinkHref } from '@/lib/profile/bio-validation';

const BIO_PLACEHOLDER = 'Napište něco o sobě…';

interface BioEditorProps {
  initialContent: object | null;
  onChange?: (json: object, text: string) => void;
}

interface BioToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  title: string;
  children: ReactNode;
}

function BioToolbarButton({ onClick, isActive, title, children }: BioToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      aria-label={title}
      className={cn(isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground')}
    >
      {children}
    </Button>
  );
}

export function BioEditor({ initialContent, onChange }: BioEditorProps) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      // Restricted subset: no headings, code, images, alignment or highlight.
      // Kept: Bold, Italic, Strike, BulletList, OrderedList, ListItem,
      // Blockquote, HardBreak, Paragraph, Text, Document (+ history).
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        dropcursor: false,
        link: false,
        underline: false,
      }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      // showOnlyCurrent defaults to true, which hides the prompt until the
      // editor has focus — an untouched bio would open as an empty box.
      Placeholder.configure({ placeholder: BIO_PLACEHOLDER, showOnlyCurrent: false }),
    ],
    content: normalizeContentJson(initialContent ?? EMPTY_DOC),
    onUpdate: ({ editor }) => {
      onChangeRef.current?.(editor.getJSON(), editor.getText());
    },
  });

  if (!editor) return null;

  const openLinkDialog = () => {
    setLinkUrl(editor.getAttributes('link').href ?? '');
    setLinkDialogOpen(true);
  };

  const applyLink = () => {
    const href = linkUrl.trim();
    if (href === '') {
      setLinkDialogOpen(false);
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    if (!isAllowedLinkHref(href)) {
      toast.error('Odkaz v biu má nepovolený formát.');
      return;
    }
    setLinkDialogOpen(false);
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <div
        role="toolbar"
        aria-label="Formátování textu"
        className="flex flex-wrap items-center gap-0.5 border-b bg-card px-2 py-1.5"
      >
        <BioToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Tučné"><Bold className="size-4" /></BioToolbarButton>
        <BioToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Kurzíva"><Italic className="size-4" /></BioToolbarButton>
        <BioToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Podtržení"><UnderlineIcon className="size-4" /></BioToolbarButton>
        <BioToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Přeškrtnutí"><Strikethrough className="size-4" /></BioToolbarButton>
        <BioToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Odrážkový seznam"><List className="size-4" /></BioToolbarButton>
        <BioToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Číslovaný seznam"><ListOrdered className="size-4" /></BioToolbarButton>
        <BioToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="Citát"><Quote className="size-4" /></BioToolbarButton>
        <BioToolbarButton onClick={openLinkDialog} isActive={editor.isActive('link')} title="Odkaz"><LinkIcon className="size-4" /></BioToolbarButton>
      </div>

      <div className="flex flex-1 flex-col px-4 py-3">
        <EditorContent
          editor={editor}
          className="flex-1 [&_.tiptap]:min-h-32 [&_.tiptap]:outline-none [&_.tiptap_a]:text-primary [&_.tiptap_a]:underline [&_.tiptap_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child]:before:text-muted-foreground [&_.tiptap_p.is-editor-empty:first-child]:before:float-left [&_.tiptap_p.is-editor-empty:first-child]:before:h-0 [&_.tiptap_p.is-editor-empty:first-child]:before:pointer-events-none"
        />
      </div>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Vložit odkaz</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="bio-link-url">URL</Label>
            <Input
              id="bio-link-url"
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
