"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { definirExigenciaDeSessao } from "@/actions/platform-auth";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Aviso } from "@/components/ui/estado";

export function ExigenciaDeSessao({ ligada }: { ligada: boolean }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function confirmar() {
    iniciar(async () => {
      const r = await definirExigenciaDeSessao(!ligada);
      if (!r.ok) return setErro(r.erro ?? "Falhou.");
      setAberto(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" size="sm" variant={ligada ? "secondary" : "primary"} onClick={() => { setErro(null); setAberto(true); }}>
        {ligada ? "Desligar exigência" : "Ligar exigência"}
      </Button>
      <Modal open={aberto} onClose={() => setAberto(false)} title={ligada ? "Desligar a exigência no banco?" : "Ligar a exigência no banco?"}>
        <div className="space-y-4">
          {ligada ? (
            <Aviso tom="atencao">
              O banco volta a aceitar o admin sem sessão do Admin (modo compatível). No app a sessão continua exigida.
            </Aviso>
          ) : (
            <Aviso tom="atencao">
              Só ligue com esta versão do CORTEX em produção. A partir daqui, toda leitura e ação do Admin no banco exige a
              sessão aberta em /admin/login, e a consulta direta &quot;fulano é admin?&quot; deixa de funcionar pela API. A versão
              anterior do Admin para de funcionar.
            </Aviso>
          )}
          {erro && <Aviso tom="erro">{erro}</Aviso>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAberto(false)}>
              Voltar
            </Button>
            <Button type="button" size="sm" pending={pendente} onClick={confirmar}>
              {ligada ? "Desligar" : "Ligar"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
