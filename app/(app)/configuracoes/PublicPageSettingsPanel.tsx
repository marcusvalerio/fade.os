"use client";

import { useEffect, useState } from "react";
import { updateCompanySlug } from "@/actions/configuracoes";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { enviarSemLimpar, useEnvio } from "@/lib/enviar-sem-limpar";
import { slugify } from "@/lib/slug";

export function PublicPageSettingsPanel({ companyId, slug }: { companyId: string; slug: string }) {
  const { show } = useToast();
  const [value, setValue] = useState(slug);
  const [savedSlug, setSavedSlug] = useState(slug);
  const { pendente: pending, enviar } = useEnvio("configuracoes.endereco");
  const [error, setError] = useState<string | null>(null);

  // O domínio só existe no navegador, mas lê-lo durante a renderização faz o
  // servidor mandar "/slug" e o cliente montar "https://host/slug" — texto
  // diferente no mesmo nó, que é o React #418 (erro de hidratação) que
  // aparecia nesta tela. Ler depois de montar mantém a primeira renderização
  // igual dos dois lados.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const previewSlug = slugify(value) || slug;
  const publicUrl = `${origin}/${previewSlug}`;

  function falhou(mensagem: string) {
    setError(mensagem);
    show(mensagem, "danger");
  }

  function handleSubmit(formData: FormData) {
    const desired = slugify(String(formData.get("slug") || ""));
    setError(null);
    enviar(async () => {
      const result = await updateCompanySlug(companyId, desired);
      if (!result.ok) return falhou(result.error);
      setValue(result.data.slug);
      setSavedSlug(result.data.slug);
      show("Endereço público atualizado.", "success");
    }, falhou);
  }

  return (
    <div className="material-solid rounded-md p-6 space-y-4">
      <div>
        <p className="text-label uppercase text-muted mb-1">Página pública</p>
        <p className="text-body-sm text-muted">
          O endereço onde seus clientes acessam a barbearia e fazem agendamentos online.
        </p>
      </div>

      <a
        href={`/${savedSlug}`}
        target="_blank"
        rel="noreferrer"
        className="block text-body-sm text-primary hover:underline break-all"
      >
        {publicUrl}
      </a>

      <form onSubmit={enviarSemLimpar(handleSubmit)} className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <Field name="slug" label="Endereço" error={error} helper="Só letras minúsculas, números e hífen">
            <Input
              id="slug"
              name="slug"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={63}
              required
            />
          </Field>
        </div>
        <Button type="submit" variant="secondary" pending={pending} className="shrink-0">
          Salvar endereço
        </Button>
      </form>
    </div>
  );
}
