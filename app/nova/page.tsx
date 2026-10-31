import type { Metadata } from "next";
import { NovaLanding } from "./NovaLanding";

/** Rascunho da nova landing para avaliação. Fora da busca até ser aprovada. */
export const metadata: Metadata = {
  title: "CORTEX.OS — Um corte. Tudo resolvido.",
  robots: { index: false, follow: false },
};

export default function NovaPage() {
  return <NovaLanding />;
}
