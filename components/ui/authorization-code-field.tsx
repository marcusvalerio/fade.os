"use client";

import { Field, Input } from "@/components/ui/field";

/**
 * Campo do código de autorização da empresa.
 *
 * Aparece só quando a operação em curso é sensível (desconto ou cortesia) E
 * quem está operando não é owner/admin — o gerente autoriza pelo próprio
 * papel e não deve ser obrigado a digitar código para o que já pode fazer.
 *
 * Isto é conveniência de tela, não segurança: quem decide é o banco. Esconder
 * o campo não impede ninguém de mandar a operação sem código; só evita pedir
 * um código que não seria exigido.
 */
export function AuthorizationCodeField({
  value,
  onChange,
  visible,
  operation,
}: {
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  operation: "discount" | "courtesy";
}) {
  if (!visible) return null;

  return (
    <Field
      name="authorization_code"
      label="Código de autorização"
      helper={
        operation === "courtesy"
          ? "Cortesia precisa da autorização do responsável."
          : "Desconto precisa da autorização do responsável."
      }
      required
    >
      <Input
        id="authorization_code"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={8}
        placeholder="8 caracteres"
        className="tracking-[0.2em] uppercase"
      />
    </Field>
  );
}
