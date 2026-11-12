import type { AnyExtension } from "@tiptap/core"
import Highlight from "@tiptap/extension-highlight"
import Image from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import { TableKit } from "@tiptap/extension-table"
import TextAlign from "@tiptap/extension-text-align"
import Typography from "@tiptap/extension-typography"
import Underline from "@tiptap/extension-underline"
import StarterKit from "@tiptap/starter-kit"

/** Highlight with the palette name carried as `data-color`. */
export const MultiHighlight = Highlight.extend({
  addAttributes() {
    return {
      color: {
        default: "yellow",
        parseHTML: (el) => el.getAttribute("data-color") ?? "yellow",
        renderHTML: ({ color }) => ({ "data-color": color ?? "yellow" }),
      },
    }
  },
})

interface TiptapExtensionOptions {
  /** Editor-only image node; the renderer takes plain `Image`. */
  image?: AnyExtension
  /** Editor-only prompt shown while the document is empty. */
  placeholder?: string
}

/**
 * One extension list for both the editor and the renderer. They used to be
 * declared separately, which is how a node the editor could produce ended up
 * unrenderable (and vice versa) — tables especially.
 */
export function createTiptapExtensions({ image = Image, placeholder }: TiptapExtensionOptions = {}): AnyExtension[] {
  const extensions: AnyExtension[] = [
    StarterKit.configure({
      link: false,
      underline: false,
    }),
    MultiHighlight.configure({ multicolor: true }),
    Underline,
    Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer" } }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Typography,
    image,
    TableKit.configure({ table: { resizable: false } }),
  ]

  // showOnlyCurrent defaults to true, which hides the placeholder until the
  // editor has focus — a blank essay would open as an empty box. Our CSS only
  // styles `p.is-editor-empty:first-child`, so turning it off shows the prompt
  // on an untouched document without littering empty paragraphs.
  if (placeholder) {
    extensions.push(Placeholder.configure({ placeholder, showOnlyCurrent: false }))
  }

  return extensions
}
