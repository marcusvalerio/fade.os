import { redirect } from "next/navigation";

/** Os erros vivem em Saúde, lidos do Sentry. */
export default function AdminErrorsPage() {
  redirect("/admin/sistema#erros");
}
