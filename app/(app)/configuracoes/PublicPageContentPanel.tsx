"use client";

import { useState } from "react";
import { updatePublicPageContent } from "@/actions/configuracoes";
import { Field, Input, Textarea, Checkbox } from "@/components/ui/field";
import { FocalPointPicker } from "@/components/ui/focal-point-picker";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { enviarSemLimpar, useEnvio } from "@/lib/enviar-sem-limpar";
import type { Company } from "@/lib/types";

/**
 * P1.3/P1.4/P1.5/P1.6 — o que o dono decide sobre a vitrine pública:
 * Instagram, imagem de capa (com ponto focal), e a apresentação opcional
 * de 2 páginas antes do agendamento. Nada aqui é obrigatório — sem
 * preencher, a página pública continua como sempre foi.
 */
export function PublicPageContentPanel({ company }: { company: Company }) {
  const { show } = useToast();
  const { pendente: pending, enviar } = useEnvio("configuracoes.pagina-publica");
  const [error, setError] = useState<string | null>(null);

  const [instagram, setInstagram] = useState(company.instagram ?? "");
  const [coverUrl, setCoverUrl] = useState(company.cover_image_url ?? "");
  const [coverX, setCoverX] = useState(company.cover_image_focal_x);
  const [coverY, setCoverY] = useState(company.cover_image_focal_y);
  const [onboardingEnabled, setOnboardingEnabled] = useState(company.public_onboarding_enabled);

  const [introTitle, setIntroTitle] = useState(company.public_intro_title ?? "");
  const [introText, setIntroText] = useState(company.public_intro_text ?? "");
  const [introUrl, setIntroUrl] = useState(company.public_intro_image_url ?? "");
  const [introX, setIntroX] = useState(company.public_intro_image_focal_x);
  const [introY, setIntroY] = useState(company.public_intro_image_focal_y);

  const [highTitle, setHighTitle] = useState(company.public_highlights_title ?? "");
  const [highText, setHighText] = useState(company.public_highlights_text ?? "");
  const [highUrl, setHighUrl] = useState(company.public_highlights_image_url ?? "");
  const [highX, setHighX] = useState(company.public_highlights_image_focal_x);
  const [highY, setHighY] = useState(company.public_highlights_image_focal_y);

  const missingOnboardingContent =
    onboardingEnabled && (!introTitle || !introText || !highTitle || !highText);

  function falhou(mensagem: string) {
    setError(mensagem);
    show(mensagem, "danger");
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("public_onboarding_enabled", onboardingEnabled ? "on" : "off");
    enviar(async () => {
      const result = await updatePublicPageContent(company.id, formData);
      if (!result.ok) return falhou(result.error);
      show("Página pública atualizada.", "success");
    }, falhou);
  }

  return (
    <form onSubmit={enviarSemLimpar(handleSubmit)} className="space-y-8">
      <div className="space-y-4">
        <Field name="instagram" label="Instagram (opcional)">
          <Input
            id="instagram"
            name="instagram"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="@suabarbearia"
          />
        </Field>

        <FocalPointPicker
          label="Imagem de capa (opcional)"
          urlName="cover_image_url"
          focalXName="cover_image_focal_x"
          focalYName="cover_image_focal_y"
          url={coverUrl}
          focalX={coverX}
          focalY={coverY}
          onUrlChange={setCoverUrl}
          onFocalChange={(x, y) => {
            setCoverX(x);
            setCoverY(y);
          }}
        />
      </div>

      <div className="border-t border-border pt-6 space-y-4">
        <label className="flex items-center gap-2.5">
          <Checkbox checked={onboardingEnabled} onChange={(e) => setOnboardingEnabled(e.target.checked)} />
          <span className="text-body-sm text-foreground">
            Mostrar apresentação de 2 páginas antes do agendamento
          </span>
        </label>

        {onboardingEnabled && (
          <div className="space-y-6 pl-1">
            {missingOnboardingContent && (
              <p className="text-body-sm text-warning-ink">
                Preencha título e texto das duas páginas para a apresentação aparecer completa.
              </p>
            )}

            <div className="space-y-3">
              <p className="text-label uppercase text-muted">Página 1 — sobre a barbearia</p>
              <Field name="public_intro_title" label="Título">
                <Input id="public_intro_title" name="public_intro_title" value={introTitle} onChange={(e) => setIntroTitle(e.target.value)} />
              </Field>
              <Field name="public_intro_text" label="Texto">
                <Textarea id="public_intro_text" name="public_intro_text" rows={3} value={introText} onChange={(e) => setIntroText(e.target.value)} />
              </Field>
              <FocalPointPicker
                label="Foto"
                urlName="public_intro_image_url"
                focalXName="public_intro_image_focal_x"
                focalYName="public_intro_image_focal_y"
                url={introUrl}
                focalX={introX}
                focalY={introY}
                onUrlChange={setIntroUrl}
                onFocalChange={(x, y) => {
                  setIntroX(x);
                  setIntroY(y);
                }}
              />
            </div>

            <div className="space-y-3">
              <p className="text-label uppercase text-muted">Página 2 — diferenciais</p>
              <Field name="public_highlights_title" label="Título">
                <Input id="public_highlights_title" name="public_highlights_title" value={highTitle} onChange={(e) => setHighTitle(e.target.value)} />
              </Field>
              <Field name="public_highlights_text" label="Texto">
                <Textarea id="public_highlights_text" name="public_highlights_text" rows={3} value={highText} onChange={(e) => setHighText(e.target.value)} />
              </Field>
              <FocalPointPicker
                label="Foto"
                urlName="public_highlights_image_url"
                focalXName="public_highlights_image_focal_x"
                focalYName="public_highlights_image_focal_y"
                url={highUrl}
                focalX={highX}
                focalY={highY}
                onUrlChange={setHighUrl}
                onFocalChange={(x, y) => {
                  setHighX(x);
                  setHighY(y);
                }}
              />
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-body-sm text-danger-ink">{error}</p>}
      <Button type="submit" pending={pending}>
        Salvar página pública
      </Button>
    </form>
  );
}
