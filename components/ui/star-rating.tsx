"use client";

/**
 * P1.9 — 0 a 5 estrelas, incrementos de 0,5. Cada estrela tem duas metades
 * clicáveis (esquerda = X,5 abaixo do inteiro; direita = X inteiro),
 * acessíveis via teclado (setas) através de um <input type="range"> real
 * por baixo — a UI visual é só a camada de cima.
 */
export function StarRating({
  value,
  onChange,
  readOnly,
}: {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
}) {
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="inline-flex flex-col gap-1">
      <div className="relative inline-flex" role={readOnly ? undefined : "radiogroup"} aria-label="Avaliação em estrelas">
        {stars.map((n) => {
          const fill = Math.max(0, Math.min(1, value - (n - 1))); // 0, 0.5 ou 1 para esta estrela
          return (
            <span key={n} className="relative inline-block" style={{ width: 28, height: 28 }}>
              <StarIcon fillPercent={0} />
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
                aria-hidden
              >
                <StarIcon fillPercent={100} />
              </span>
              {!readOnly && (
                <>
                  <button
                    type="button"
                    aria-label={`${n - 0.5} de 5 estrelas`}
                    className="absolute inset-y-0 left-0 w-1/2"
                    onClick={() => onChange?.(n - 0.5)}
                  />
                  <button
                    type="button"
                    aria-label={`${n} de 5 estrelas`}
                    className="absolute inset-y-0 right-0 w-1/2"
                    onClick={() => onChange?.(n)}
                  />
                </>
              )}
            </span>
          );
        })}
      </div>
      {!readOnly && (
        <input
          type="range"
          min={0}
          max={5}
          step={0.5}
          value={value}
          onChange={(e) => onChange?.(Number(e.target.value))}
          className="sr-only"
          aria-label="Avaliação, de 0 a 5 estrelas, em passos de meia estrela"
        />
      )}
    </div>
  );
}

function StarIcon({ fillPercent }: { fillPercent: number }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 2.5l2.9 6.06 6.6.77-4.86 4.6 1.28 6.57L12 17.4l-5.92 3.1 1.28-6.57-4.86-4.6 6.6-.77L12 2.5z"
        fill={fillPercent > 0 ? "var(--brand-blue)" : "none"}
        stroke={fillPercent > 0 ? "var(--brand-blue)" : "var(--border-strong)"}
        strokeWidth="1.5"
      />
    </svg>
  );
}
