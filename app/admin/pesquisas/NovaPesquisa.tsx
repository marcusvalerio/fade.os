"use client";

import { useState } from "react";
import { FormularioDePesquisa } from "./FormularioDePesquisa";
import { Button } from "@/components/ui/button";

/** Formulário fechado por padrão — a lista é o que importa ao abrir a tela. */
export function NovaPesquisa({ abertaDeInicio = false }: { abertaDeInicio?: boolean }) {
  const [aberta, setAberta] = useState(abertaDeInicio);
  if (!aberta) {
    return <Button onClick={() => setAberta(true)}>Nova pesquisa</Button>;
  }
  return (
    <section className="painel p-5 sm:p-6 w-full" aria-labelledby="nova-pesquisa">
      <div className="flex items-center justify-between gap-4 mb-5">
        <h2 id="nova-pesquisa" className="text-section-title text-foreground">Nova pesquisa</h2>
        <Button variant="ghost" size="sm" onClick={() => setAberta(false)}>
          Cancelar
        </Button>
      </div>
      <FormularioDePesquisa />
    </section>
  );
}
