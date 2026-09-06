"use client";

import { setProfessionalAvatar } from "@/actions/profissionais";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { useToast } from "@/components/ui/toast";

export function ProfessionalAvatar({
  professionalId,
  companyId,
  currentUrl,
  name,
}: {
  professionalId: string;
  companyId: string;
  currentUrl: string | null;
  name: string;
}) {
  const { show } = useToast();

  return (
    <AvatarUpload
      companyId={companyId}
      currentUrl={currentUrl}
      label={name}
      onUploaded={async (url) => {
        const result = await setProfessionalAvatar(professionalId, url);
        if (!result.ok) return show(result.error, "danger");
        show("Foto atualizada.", "success");
      }}
    />
  );
}
