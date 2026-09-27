"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { lerPlanilha, type Planilha } from "@/lib/importacao/planilha";
import {
  CAMPOS,
  LIMITE_DE_LINHAS,
  avaliarLote,
  sugerirMapeamento,
  valoresDaLinha,
  type Campo,
  type LinhaAvaliada,
  type Mapeamento,
} from "@/lib/importacao/clientes";
import { contatosCadastrados, importarClientes, type RelatorioDeImportacao } from "@/actions/importacao";
import { Field, Select } from "@/components/ui/field";
import { Button, buttonClasses } from "@/components/ui/button";
import { Aviso } from "@/components/ui/estado";
import { cn } from "@/lib/cn";

type Etapa =
  | { tipo: "arquivo" }
  | { tipo: "colunas"; nome: string; planilha: Planilha }
  | { tipo: "previa"; nome: string; planilha: Planilha; avaliadas: LinhaAvaliada[] }
  | { tipo: "pronto"; relatorio: RelatorioDeImportacao };

const SITUACAO: Record<LinhaAvaliada["situacao"], { rotulo: string; quadrado: string }> = {
  nova: { rotulo: "Entra", quadrado: "bg-success" },
  ja_cadastrada: { rotulo: "Já cadastrado", quadrado: "border border-border-strong" },
  duplicada_no_arquivo: { rotulo: "Repetido no arquivo", quadrado: "border border-border-strong" },
  invalida: { rotulo: "Não entra", quadrado: "bg-danger" },
};

const PASSOS = ["Arquivo", "Colunas", "Conferir", "Pronto"];

/**
 * Importação de clientes em quatro passos. A leitura do arquivo acontece
 * aqui no navegador (o arquivo não sobe para lugar nenhum); só as linhas
 * escolhidas vão para o servidor, que valida de novo antes de gravar.
 */
export function ImportarClientes({ companyId }: { companyId: string }) {
  const [etapa, setEtapa] = useState<Etapa>({ tipo: "arquivo" });
  const [mapa, setMapa] = useState<Mapeamento>({});
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [filtro, setFiltro] = useState<"todas" | "problemas">("todas");
  const entrada = useRef<HTMLInputElement>(null);

  const passoAtual = { arquivo: 0, colunas: 1, previa: 2, pronto: 3 }[etapa.tipo];

  async function escolherArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(null);
    if (arquivo.size > 5 * 1024 * 1024) return setErro("Arquivo maior que 5 MB. Divida em partes menores.");
    setOcupado(true);
    try {
      const planilha = await lerPlanilha(arquivo.name, new Uint8Array(await arquivo.arrayBuffer()));
      if (planilha.length < 2) {
        setErro("Não encontramos linhas de clientes. A primeira linha precisa ser o cabeçalho (Nome, Telefone…).");
      } else if (planilha.length - 1 > LIMITE_DE_LINHAS) {
        setErro(`O arquivo tem ${planilha.length - 1} linhas. O limite é ${LIMITE_DE_LINHAS} por importação — divida em partes.`);
      } else {
        setMapa(sugerirMapeamento(planilha[0]));
        setEtapa({ tipo: "colunas", nome: arquivo.name, planilha });
      }
    } catch (e) {
      setErro(
        e instanceof Error && e.message === "FORMATO_NAO_SUPORTADO"
          ? "Use um arquivo .csv ou .xlsx. Arquivos .xls antigos: abra no Excel e salve como .xlsx."
          : "Não conseguimos ler este arquivo. Confira se ele abre no Excel ou no Google Planilhas."
      );
    } finally {
      setOcupado(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  async function conferir() {
    if (etapa.tipo !== "colunas") return;
    setErro(null);
    setOcupado(true);
    const r = await contatosCadastrados(companyId);
    setOcupado(false);
    if (!r.ok) return setErro(r.error);
    const itens = etapa.planilha.slice(1).map((l, i) => ({ linha: i + 2, valores: valoresDaLinha(l, mapa) }));
    const avaliadas = avaliarLote(itens, { telefones: new Set(r.data.telefones), emails: new Set(r.data.emails), nomes: new Set(r.data.nomes) });
    setFiltro("todas");
    setEtapa({ tipo: "previa", nome: etapa.nome, planilha: etapa.planilha, avaliadas });
  }

  async function importar() {
    if (etapa.tipo !== "previa") return;
    setErro(null);
    setOcupado(true);
    const itens = etapa.planilha.slice(1).map((l, i) => ({ linha: i + 2, valores: valoresDaLinha(l, mapa) }));
    const r = await importarClientes(companyId, itens);
    setOcupado(false);
    if (!r.ok) return setErro(r.error);
    setEtapa({ tipo: "pronto", relatorio: r.data });
  }

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Passos da importação">
        {PASSOS.map((p, i) => (
          <li
            key={p}
            aria-current={i === passoAtual ? "step" : undefined}
            className={cn("inline-flex items-center gap-2 font-subtitle text-caption", i === passoAtual ? "text-foreground" : "text-muted")}
          >
            <span aria-hidden="true" className={cn("size-1.5", i <= passoAtual ? "bg-brand-blue" : "border border-border-strong")} />
            {p}
          </li>
        ))}
      </ol>

      {erro && <Aviso tom="erro">{erro}</Aviso>}

      {etapa.tipo === "arquivo" && (
        <div className="painel p-5 sm:p-6 space-y-5">
          <label
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border-strong px-4 py-10 text-center cursor-pointer",
              "hover:border-foreground focus-within:outline-2 focus-within:outline-focus",
              ocupado && "opacity-60 pointer-events-none"
            )}
          >
            <span aria-hidden="true" className="size-2 bg-brand-blue" />
            <span className="font-heading text-section-title text-foreground">{ocupado ? "Lendo o arquivo…" : "Escolher planilha"}</span>
            <span className="text-body-sm text-muted">.xlsx ou .csv · até {LIMITE_DE_LINHAS} clientes · o arquivo não sai do seu computador</span>
            <input
              ref={entrada}
              type="file"
              accept=".csv,.xlsx,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => escolherArquivo(e.target.files?.[0])}
            />
          </label>
          <div className="text-body-sm text-muted space-y-1.5">
            <p className="text-foreground font-medium">Como deixar a planilha</p>
            <p>A primeira linha com os nomes das colunas. Só “Nome” é obrigatório; telefone, e-mail, nascimento, observações e “aceita contato” são opcionais.</p>
            <p>Quem já está cadastrado (mesmo telefone ou e-mail) não é duplicado. Ninguém recebe mensagem se a planilha não disser que aceita contato.</p>
          </div>
        </div>
      )}

      {etapa.tipo === "colunas" && (
        <div className="painel p-5 sm:p-6 space-y-5">
          <div>
            <p className="font-heading text-section-title text-foreground">Qual coluna é o quê?</p>
            <p className="text-body-sm text-muted mt-1">
              {etapa.nome} · {etapa.planilha.length - 1} {etapa.planilha.length - 1 === 1 ? "linha" : "linhas"}. Já sugerimos pelo nome das colunas — confira.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {CAMPOS.map(({ campo, rotulo, obrigatorio }) => (
              <Field key={campo} name={`coluna-${campo}`} label={rotulo} required={obrigatorio}>
                <Select
                  value={mapa[campo] ?? -1}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setMapa((m) => {
                      const novo = { ...m };
                      if (v < 0) delete novo[campo as Campo];
                      else novo[campo as Campo] = v;
                      return novo;
                    });
                  }}
                >
                  <option value={-1}>— não importar —</option>
                  {etapa.planilha[0].map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Coluna ${i + 1}`}
                      {etapa.planilha[1]?.[i] ? ` (ex.: ${etapa.planilha[1][i].slice(0, 24)})` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={conferir} disabled={mapa.name === undefined} pending={ocupado}>
              {ocupado ? "Conferindo…" : "Conferir linhas"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEtapa({ tipo: "arquivo" })}>
              Trocar arquivo
            </Button>
            {mapa.name === undefined && <p className="text-caption text-muted">Escolha a coluna do nome para continuar.</p>}
          </div>
        </div>
      )}

      {etapa.tipo === "previa" && <Previa etapa={etapa} filtro={filtro} setFiltro={setFiltro} ocupado={ocupado} importar={importar} voltar={() => setEtapa({ tipo: "colunas", nome: etapa.nome, planilha: etapa.planilha })} />}

      {etapa.tipo === "pronto" && (
        <div className="painel p-5 sm:p-6 space-y-5" role="status">
          <div>
            <p className="eyebrow mb-2">Importação concluída</p>
            <p className="font-heading text-page-title text-foreground numero">
              {etapa.relatorio.criados} {etapa.relatorio.criados === 1 ? "cliente novo" : "clientes novos"}
            </p>
          </div>
          <ul className="text-body-sm text-muted space-y-1">
            {etapa.relatorio.jaCadastrados > 0 && (
              <li>
                {etapa.relatorio.jaCadastrados === 1 ? "1 já estava cadastrado e ficou como estava." : `${etapa.relatorio.jaCadastrados} já estavam cadastrados e ficaram como estavam.`}
              </li>
            )}
            {etapa.relatorio.repetidos > 0 && (
              <li>
                {etapa.relatorio.repetidos === 1 ? "1 linha repetida no arquivo foi ignorada." : `${etapa.relatorio.repetidos} linhas repetidas no arquivo foram ignoradas.`}
              </li>
            )}
            {etapa.relatorio.comAviso > 0 && (
              <li>
                {etapa.relatorio.comAviso === 1 ? "1 entrou" : `${etapa.relatorio.comAviso} entraram`} sem algum dado inválido (telefone, e-mail ou nascimento).
              </li>
            )}
            {etapa.relatorio.invalidos.length > 0 && (
              <li>
                {etapa.relatorio.invalidos.length === 1 ? "1 não entrou" : `${etapa.relatorio.invalidos.length} não entraram`}:{" "}
                {etapa.relatorio.invalidos
                  .slice(0, 10)
                  .map((i) => `linha ${i.linha} (${i.motivo.toLowerCase()})`)
                  .join(", ")}
                {etapa.relatorio.invalidos.length > 10 && "…"}
              </li>
            )}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Link href="/clientes" className={buttonClasses()}>
              Ver clientes
            </Link>
            <Button type="button" variant="secondary" onClick={() => setEtapa({ tipo: "arquivo" })}>
              Importar outro arquivo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Previa({
  etapa,
  filtro,
  setFiltro,
  ocupado,
  importar,
  voltar,
}: {
  etapa: { nome: string; avaliadas: LinhaAvaliada[] };
  filtro: "todas" | "problemas";
  setFiltro: (f: "todas" | "problemas") => void;
  ocupado: boolean;
  importar: () => void;
  voltar: () => void;
}) {
  const contagem = useMemo(() => {
    const c = { nova: 0, ja_cadastrada: 0, duplicada_no_arquivo: 0, invalida: 0, avisos: 0 };
    for (const a of etapa.avaliadas) {
      c[a.situacao]++;
      if (a.situacao === "nova" && a.avisos.length) c.avisos++;
    }
    return c;
  }, [etapa.avaliadas]);
  const visiveis = etapa.avaliadas.filter((a) => filtro === "todas" || a.situacao !== "nova" || a.avisos.length > 0);
  const LIMITE_NA_TELA = 200;

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border border border-border rounded-lg overflow-hidden">
        {[
          { r: "Entram", v: contagem.nova },
          { r: "Já cadastrados", v: contagem.ja_cadastrada },
          { r: "Repetidos no arquivo", v: contagem.duplicada_no_arquivo },
          { r: "Não entram", v: contagem.invalida },
        ].map((f) => (
          <div key={f.r} className="bg-surface p-4">
            <dt className="font-subtitle text-caption text-muted">{f.r}</dt>
            <dd className="numero text-section-title text-foreground mt-1">{f.v}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-sm border border-border-strong p-0.5" role="group" aria-label="Filtrar linhas">
          {(["todas", "problemas"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filtro === f}
              onClick={() => setFiltro(f)}
              className={cn("px-3 py-1.5 text-caption rounded-xs", filtro === f ? "bg-foreground text-background" : "text-muted hover:text-foreground")}
            >
              {f === "todas" ? "Todas" : `Com observação (${etapa.avaliadas.length - contagem.nova + contagem.avisos})`}
            </button>
          ))}
        </div>
        <p className="text-caption text-muted">{etapa.nome}</p>
      </div>

      <div className="painel overflow-x-auto">
        <table className="w-full text-body-sm">
          <thead>
            <tr className="text-left font-subtitle text-caption text-muted border-b border-border">
              <th className="pl-3 pr-1 py-2 font-normal w-10">Linha</th>
              <th className="px-3 py-2 font-normal">Nome</th>
              <th className="px-3 py-2 font-normal hidden sm:table-cell">Telefone</th>
              <th className="px-3 py-2 font-normal hidden md:table-cell">E-mail</th>
              <th className="px-3 py-2 font-normal">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visiveis.slice(0, LIMITE_NA_TELA).map((a) => {
              const s = SITUACAO[a.situacao];
              return (
                <tr key={a.linha} className={cn(a.situacao !== "nova" && "text-muted")}>
                  <td className="pl-3 pr-1 py-2 numero text-muted">{a.linha}</td>
                  <td className="px-3 py-2 max-w-[14rem]">
                    <span className="block truncate">{a.cliente?.name ?? "—"}</span>
                    {a.cliente?.phone && <span className="block sm:hidden text-caption text-muted tabular-nums">{a.cliente.phone}</span>}
                  </td>
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap hidden sm:table-cell">{a.cliente?.phone ?? "—"}</td>
                  <td className="px-3 py-2 hidden md:table-cell max-w-[16rem] truncate">{a.cliente?.email ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden="true" className={cn("size-1.5", s.quadrado)} />
                      {s.rotulo}
                    </span>
                    {(a.motivo || a.avisos.length > 0) && (
                      <span className="block text-caption text-muted">{[a.situacao !== "nova" && a.motivo !== s.rotulo ? a.motivo : null, ...a.avisos].filter(Boolean).join(" · ")}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visiveis.length > LIMITE_NA_TELA && (
          <p className="px-3 py-2 text-caption text-muted border-t border-border">
            Mostrando {LIMITE_NA_TELA} de {visiveis.length}. Todas entram na contagem acima.
          </p>
        )}
        {visiveis.length === 0 && <p className="px-3 py-6 text-center text-body-sm text-muted">Nenhuma linha com observação.</p>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={importar} disabled={contagem.nova === 0} pending={ocupado}>
          {ocupado ? "Importando…" : contagem.nova === 0 ? "Nada novo para importar" : `Importar ${contagem.nova} ${contagem.nova === 1 ? "cliente" : "clientes"}`}
        </Button>
        <Button type="button" variant="ghost" onClick={voltar}>
          Ajustar colunas
        </Button>
      </div>
    </div>
  );
}
