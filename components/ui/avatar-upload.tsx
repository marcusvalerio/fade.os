"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

type Status = "idle" | "uploading" | "error";

/**
 * Upload real para o bucket "avatars" do Supabase Storage — nunca um
 * placeholder de UI. O caminho do objeto sempre começa com companyId
 * (avatars/{companyId}/{arquivo}), exatamente o que a policy de escrita do
 * bucket espera (ver migration 20260908090000). onUploaded recebe a URL
 * pública já persistida pelo chamador (a chamada de update fica a cargo de
 * quem usa este componente, ele só resolve a URL do arquivo).
 */
export function AvatarUpload({
  companyId,
  currentUrl,
  label,
  onUploaded,
}: {
  companyId: string;
  currentUrl: string | null;
  label: string;
  onUploaded: (url: string) => Promise<void> | void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("uploading");
    setError(null);

    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${companyId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: false,
      cacheControl: "3600",
    });

    if (uploadError) {
      setStatus("error");
      setError("Não foi possível enviar a imagem. Tente novamente.");
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setPreviewUrl(data.publicUrl);
    setStatus("idle");
    await onUploaded(data.publicUrl);
  }

  return (
    <div className="flex items-center gap-4">
      <div
        className={cn(
          "size-16 rounded-full bg-surface-muted border border-border overflow-hidden shrink-0",
          "flex items-center justify-center"
        )}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className="text-label uppercase text-muted">{label.slice(0, 2)}</span>
        )}
      </div>
      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={status === "uploading"}
          className="text-body-sm text-primary hover:underline disabled:opacity-50"
        >
          {status === "uploading" ? "Enviando…" : previewUrl ? "Trocar foto" : "Adicionar foto"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        {error && <p className="text-helper text-danger mt-1">{error}</p>}
      </div>
    </div>
  );
}
