import type { PlaybookBlock, PlaybookSection } from "@/lib/playbook/types"

const SECTION_CLASS = "playbook-section scroll-mt-24 space-y-4"
const SECTION_TITLE_CLASS = "font-heading text-xl font-bold tracking-tight sm:text-2xl"
const HEADING_2_CLASS = "font-heading text-xl font-bold tracking-tight"
const HEADING_3_CLASS = "font-heading text-lg font-semibold"

function Block({ block }: { block: PlaybookBlock }) {
  switch (block.kind) {
    case "heading":
      return block.level === 2 ? (
        <h2 className={HEADING_2_CLASS}>{block.text}</h2>
      ) : (
        <h3 className={HEADING_3_CLASS}>{block.text}</h3>
      )
    case "paragraph":
      return <p className="leading-relaxed">{block.text}</p>
    case "list":
      return block.ordered ? (
        <ol className="list-decimal space-y-1 pl-5">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      ) : (
        <ul className="list-disc space-y-1 pl-5">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )
    case "table":
      return (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                {block.headers.map((header) => (
                  <th key={header} className="px-3 py-2 font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2 align-top">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case "note":
      return (
        <div role="note" className="rounded-lg border bg-accent/40 p-4 text-sm">
          {block.text}
        </div>
      )
  }
}

interface PlaybookRendererProps {
  sections: PlaybookSection[]
}

export function PlaybookRenderer({ sections }: PlaybookRendererProps) {
  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <section key={section.slug} id={section.slug} className={SECTION_CLASS}>
          <h2 className={SECTION_TITLE_CLASS}>{section.title}</h2>
          {section.blocks.map((block, index) => (
            <Block key={index} block={block} />
          ))}
        </section>
      ))}
    </div>
  )
}
