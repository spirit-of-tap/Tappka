import { permanentRedirect } from "next/navigation";

/** Stará adresa — stanovy jsou nově v Dokumentech spolku. */
export default function StanovyRedirectPage() {
  permanentRedirect("/komunitni-kasa/dokumenty/stanovy");
}
