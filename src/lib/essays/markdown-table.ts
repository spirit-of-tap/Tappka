/**
 * Turns a GFM pipe table pasted as plain text back into TipTap JSON, so a
 * table copied out of a chat or a document arrives as a real, editable table
 * instead of a wall of pipes.
 *
 * Deliberately narrow: it only accepts text that is exactly one table (header
 * row, delimiter row, optional body rows) and gives up otherwise, leaving the
 * paste to the browser's default handling. Cell content stays plain text —
 * inline marks inside cells are not worth guessing at.
 */

const DELIMITER_CELL = /^:?-+:?$/
const PIPE = "|"

interface CellAlign {
  align: "left" | "center" | "right" | null
}

function splitRow(line: string): string[] | null {
  const trimmed = line.trim()
  if (!trimmed.includes(PIPE)) return null

  // A leading pipe only marks the table edge; a trailing one is dropped by the
  // empty segment it leaves behind. Escaped pipes are cell content.
  const body = trimmed.startsWith(PIPE) ? trimmed.slice(1) : trimmed
  const cells: string[] = []
  let current = ""

  for (let i = 0; i < body.length; i += 1) {
    const char = body[i]
    if (char === "\\" && body[i + 1] === PIPE) {
      current += PIPE
      i += 1
      continue
    }
    if (char === PIPE) {
      cells.push(current.trim())
      current = ""
      continue
    }
    current += char
  }
  cells.push(current.trim())

  // "| a | b |" leaves an empty segment after the closing pipe.
  if (cells.length > 1 && cells[cells.length - 1] === "") cells.pop()

  return cells.length > 0 ? cells : null
}

function alignment(separator: string): CellAlign["align"] {
  const trimmed = separator.trim()
  const left = trimmed.startsWith(":")
  const right = trimmed.endsWith(":")
  if (left && right) return "center"
  if (left) return "left"
  if (right) return "right"
  return null
}

function cellNode(text: string, type: "tableHeader" | "tableCell", align: CellAlign["align"]): object {
  const paragraph = text === "" ? { type: "paragraph" } : { type: "paragraph", content: [{ type: "text", text }] }
  return {
    type,
    attrs: { colspan: 1, rowspan: 1, colwidth: null, align },
    content: [paragraph],
  }
}

export function parseMarkdownTable(text: string): object | null {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())

  // Cliplets and spreadsheets love a trailing blank line; interior ones mean
  // the paste is more than one block, which we don't handle.
  while (lines.length > 0 && lines[0] === "") lines.shift()
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop()

  if (lines.length < 2 || lines.some((line) => line === "")) return null

  const header = splitRow(lines[0])
  const delimiter = splitRow(lines[1])
  if (!header || !delimiter || header.length !== delimiter.length) return null
  if (!delimiter.every((cell) => DELIMITER_CELL.test(cell))) return null

  const columnCount = header.length
  const aligns = delimiter.map(alignment)

  const rows: object[] = [
    { type: "tableRow", content: header.map((cell, index) => cellNode(cell, "tableHeader", aligns[index])) },
  ]

  for (const line of lines.slice(2)) {
    const cells = splitRow(line)
    if (!cells) return null
    const normalized = Array.from({ length: columnCount }, (_, index) => cells[index] ?? "")
    rows.push({ type: "tableRow", content: normalized.map((cell, index) => cellNode(cell, "tableCell", aligns[index])) })
  }

  return { type: "table", content: rows }
}
