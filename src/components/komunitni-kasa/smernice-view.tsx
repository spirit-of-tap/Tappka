import {
  SMERNICE_ARTICLES,
  SMERNICE_BASIS,
  SMERNICE_DRAFT_NOTE,
  SMERNICE_IS_DRAFT,
} from "@/lib/komunitni-kasa/smernice-data";
import { DraftBadge } from "./decision-explainer";

/** Plné znění směrnice o výdajích, všechny články rozbalené. */
export function SmerniceView() {
  return (
    <article className="space-y-8">
      <div className="space-y-2">
        {SMERNICE_IS_DRAFT ? <DraftBadge /> : null}
        <p className="text-sm text-muted-foreground">
          Vydává se {SMERNICE_BASIS}.{SMERNICE_IS_DRAFT ? ` ${SMERNICE_DRAFT_NOTE}` : ""}
        </p>
      </div>
      {SMERNICE_ARTICLES.map((article) => (
        <section key={article.number} aria-labelledby={`smernice-cl-${article.number}`} className="space-y-3">
          <h2 id={`smernice-cl-${article.number}`} className="font-heading text-lg font-semibold">
            Čl. {article.number} · {article.title}
          </h2>
          <ol className="list-decimal space-y-2 pl-5 leading-relaxed marker:text-muted-foreground">
            {article.paragraphs.map((paragraph, index) => (
              <li key={index} className="whitespace-pre-line pl-1">
                {paragraph}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </article>
  );
}
