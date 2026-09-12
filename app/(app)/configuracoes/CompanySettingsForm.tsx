"use client";

import { useState, useTransition } from "react";
import { updateCompanySettings, setCompanyLogo } from "@/actions/configuracoes";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { useToast } from "@/components/ui/toast";
import type { Company } from "@/lib/types";

export function CompanySettingsForm({ company }: { company: Company }) {
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateCompanySettings(company.id, formData);
      if (!result.ok) {
        setError(result.error);
        show(result.error, "danger");
        return;
      }
      show("Dados da barbearia salvos.", "success");
    });
  }

  return (
    <div className="material-solid rounded-md p-6 space-y-5">
      <div>
        <p className="text-label uppercase text-muted mb-3">Logo</p>
        <AvatarUpload
          companyId={company.id}
          currentUrl={company.logo_url}
          label={company.name}
          onUploaded={async (url) => {
            const result = await setCompanyLogo(company.id, url);
            if (!result.ok) return show(result.error, "danger");
            show("Logo atualizada.", "success");
          }}
        />
      </div>

      <form action={handleSubmit} className="space-y-4">
        <Field name="name" label="Nome da barbearia" required>
          <Input id="name" name="name" defaultValue={company.name} required />
        </Field>
        <Field name="trade_name" label="Nome comercial">
          <Input id="trade_name" name="trade_name" defaultValue={company.trade_name ?? ""} />
        </Field>
        <Field name="document" label="CNPJ/CPF">
          <Input id="document" name="document" defaultValue={company.document ?? ""} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field name="phone" label="Telefone">
            <Input id="phone" name="phone" defaultValue={company.phone ?? ""} />
          </Field>
          <Field name="whatsapp" label="WhatsApp">
            <Input id="whatsapp" name="whatsapp" defaultValue={company.whatsapp ?? ""} />
          </Field>
        </div>
        <Field name="email" label="E-mail">
          <Input id="email" name="email" type="email" defaultValue={company.email ?? ""} />
        </Field>
        <Field name="address" label="Endereço">
          <Input id="address" name="address" defaultValue={company.address ?? ""} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field name="postal_code" label="CEP">
            <Input id="postal_code" name="postal_code" defaultValue={company.postal_code ?? ""} />
          </Field>
          <Field name="city" label="Cidade">
            <Input id="city" name="city" defaultValue={company.city ?? ""} />
          </Field>
          <Field name="state" label="Estado">
            <Input id="state" name="state" maxLength={2} defaultValue={company.state ?? ""} />
          </Field>
        </div>
        {error && <p className="text-body-sm text-danger-ink">{error}</p>}
        <Button type="submit" pending={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
      </form>
    </div>
  );
}
