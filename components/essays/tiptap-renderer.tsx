import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import { cn } from '@/lib/utils';

interface TiptapRendererProps {
  content: object;
  className?: string;
}

export function TiptapRenderer({ content, className }: TiptapRendererProps) {
  const html = generateHTML(content, [StarterKit, Highlight, Underline]);

  return (
    <div
      className={cn('prose prose-sm dark:prose-invert max-w-none [&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-800/60 [&_mark]:rounded-sm [&_mark]:px-0.5', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
