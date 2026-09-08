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
      // O texto de ajuda repetia quase palavra por palavra a mensagem de erro
      // ("Cortesia precisa do código de autorização do responsável."), então a
      // tela dizia a mesma coisa duas vezes. Aqui fica o que o campo espera;
      // o porquê já está no erro e no rótulo.
      helper={`Peça ao responsável o código da ${
        operation === "courtesy" ? "cortesia" : "liberação de desconto"
      }.`}
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
