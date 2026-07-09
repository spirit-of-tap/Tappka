import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Typography from '@tiptap/extension-typography';
import { cn } from '@/lib/utils';
import Image from '@tiptap/extension-image';

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

interface TiptapRendererProps {
  content: object;
  className?: string;
}

export function TiptapRenderer({ content, className }: TiptapRendererProps) {
  const html = generateHTML(content, [
    StarterKit.configure({
      link: false,
      underline: false,
    }),
    MultiHighlight.configure({ multicolor: true }),
    Underline,
    Link.configure({ HTMLAttributes: { rel: 'noopener noreferrer' } }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Typography,
    Image,
  ]);

  return (
    <div
      className={cn('tiptap-content max-w-none', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
