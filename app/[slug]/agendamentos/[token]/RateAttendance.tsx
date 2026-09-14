"use client";

import { useState } from "react";
import { submitPublicRating } from "@/actions/public";
import { StarRating } from "@/components/ui/star-rating";
import { Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function RateAttendance({
  token,
  existing,
}: {
  token: string;
  existing: { stars: number; comment: string | null } | null;
}) {
  const [stars, setStars] = useState(existing?.stars ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(Boolean(existing));
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setPending(true);
    const result = await submitPublicRating(token, stars, comment);
    setPending(false);
    if (!result.ok) return setError(result.error);
    setSent(true);
  }

  return (
    <div className="material-solid rounded-md p-5 mt-4 space-y-3">
      <p className="text-body-sm font-medium text-foreground">
        {sent ? "Sua avaliação" : "Como foi o seu atendimento?"}
      </p>
      <StarRating value={stars} onChange={sent ? undefined : setStars} readOnly={sent} />
      {sent ? (
        comment && <p className="text-body-sm text-muted">{comment}</p>
      ) : (
        <>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Quer contar mais alguma coisa? (opcional)"
            rows={3}
          />
          {error && <p className="text-body-sm text-danger-ink">{error}</p>}
          <Button type="button" onClick={handleSubmit} pending={pending} disabled={stars === 0}>
            {pending ? "Enviando…" : "Enviar avaliação"}
          </Button>
        </>
      )}
      {sent && (
        <button type="button" className="text-caption text-muted hover:text-foreground" onClick={() => setSent(false)}>
          Alterar avaliação
        </button>
      )}
    </div>
  );
}
