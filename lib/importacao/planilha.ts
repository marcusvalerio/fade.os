/**
 * Leitura de planilha sem dependência externa: CSV (qualquer separador
 * comum, aspas, BOM, UTF-8 ou Windows-1252) e XLSX (o arquivo é um zip de
 * XMLs — lemos o diretório do zip, descompactamos com DecompressionStream
 * e extraímos a primeira aba). Funciona no navegador e no Node 22.
 *
 * Devolve sempre uma matriz de textos: a primeira linha é o cabeçalho.
 */
export type Planilha = string[][];

export function decodificarTexto(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    // Excel no Brasil salva "CSV" em Windows-1252 com frequência.
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export function detectarSeparador(texto: string): string {
  const primeira = texto.split(/\r?\n/, 1)[0] ?? "";
  let melhor = ",";
  let maior = -1;
  for (const sep of [";", ",", "\t", "|"]) {
    let n = 0;
    let aspas = false;
    for (const ch of primeira) {
      if (ch === '"') aspas = !aspas;
      else if (!aspas && ch === sep) n++;
    }
    if (n > maior) {
      maior = n;
      melhor = sep;
    }
  }
  return melhor;
}

export function lerCsv(texto: string, separador = detectarSeparador(texto)): Planilha {
  const linhas: Planilha = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (aspas) {
      if (ch === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else aspas = false;
      } else campo += ch;
      continue;
    }
    if (ch === '"' && campo === "") aspas = true;
    else if (ch === separador) {
      linha.push(campo);
      campo = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += ch;
  }
  if (campo !== "" || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return limpar(linhas);
}

/** Remove linhas totalmente vazias e espaços nas pontas. */
function limpar(linhas: Planilha): Planilha {
  return linhas.map((l) => l.map((c) => c.trim())).filter((l) => l.some((c) => c !== ""));
}

// ---------- XLSX ----------

type EntradaZip = { nome: string; metodo: number; tamanho: number; offset: number };

function lerDiretorioZip(buf: Uint8Array): Map<string, EntradaZip> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let fim = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      fim = i;
      break;
    }
  }
  if (fim < 0) throw new Error("ARQUIVO_INVALIDO");
  const total = dv.getUint16(fim + 10, true);
  let p = dv.getUint32(fim + 16, true);
  const entradas = new Map<string, EntradaZip>();
  const dec = new TextDecoder();
  for (let n = 0; n < total; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("ARQUIVO_INVALIDO");
    const metodo = dv.getUint16(p + 10, true);
    const tamanho = dv.getUint32(p + 20, true);
    const lenNome = dv.getUint16(p + 28, true);
    const lenExtra = dv.getUint16(p + 30, true);
    const lenComent = dv.getUint16(p + 32, true);
    const offset = dv.getUint32(p + 42, true);
    const nome = dec.decode(buf.subarray(p + 46, p + 46 + lenNome));
    entradas.set(nome, { nome, metodo, tamanho, offset });
    p += 46 + lenNome + lenExtra + lenComent;
  }
  return entradas;
}

async function extrair(buf: Uint8Array, e: EntradaZip): Promise<string> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const inicio = e.offset + 30 + dv.getUint16(e.offset + 26, true) + dv.getUint16(e.offset + 28, true);
  const dados = buf.subarray(inicio, inicio + e.tamanho);
  if (e.metodo === 0) return new TextDecoder().decode(dados);
  if (e.metodo !== 8) throw new Error("ARQUIVO_INVALIDO");
  const fluxo = new Blob([dados as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(fluxo).text();
}

function desescapar(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

function textosDe(xml: string): string {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => desescapar(m[1])).join("");
}

function colunaDaRef(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, "")) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export async function lerXlsx(bytes: Uint8Array): Promise<Planilha> {
  const zip = lerDiretorioZip(bytes);
  const ler = async (nome: string) => {
    const e = zip.get(nome);
    return e ? extrair(bytes, e) : null;
  };

  // A primeira aba, pelo caminho que o próprio arquivo declara.
  let caminho = "xl/worksheets/sheet1.xml";
  const workbook = await ler("xl/workbook.xml");
  const rels = await ler("xl/_rels/workbook.xml.rels");
  const rid = workbook?.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
  if (rid && rels) {
    const alvo = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((r) => r.includes(`Id="${rid}"`));
    const target = alvo?.match(/Target="([^"]+)"/)?.[1];
    if (target) caminho = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
  }
  const folha = await ler(caminho);
  if (!folha) throw new Error("ARQUIVO_INVALIDO");

  const compartilhadas: string[] = [];
  const sst = await ler("xl/sharedStrings.xml");
  if (sst) for (const m of sst.matchAll(/<si>([\s\S]*?)<\/si>/g)) compartilhadas.push(textosDe(m[1]));

  const linhas: Planilha = [];
  for (const r of folha.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const linha: string[] = [];
    for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const corpo = c[2] ?? "";
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const tipo = attrs.match(/\bt="([^"]+)"/)?.[1];
      const v = corpo.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let valor = "";
      if (tipo === "s" && v != null) valor = compartilhadas[Number(v)] ?? "";
      else if (tipo === "inlineStr") valor = textosDe(corpo);
      else if (tipo === "b") valor = v === "1" ? "VERDADEIRO" : "FALSO";
      else if (v != null) valor = desescapar(v);
      const col = ref ? colunaDaRef(ref) : linha.length;
      while (linha.length < col) linha.push("");
      linha[col] = valor;
    }
    linhas.push(linha);
  }
  return limpar(linhas);
}

export async function lerPlanilha(nomeDoArquivo: string, bytes: Uint8Array): Promise<Planilha> {
  const ext = nomeDoArquivo.toLowerCase().split(".").pop();
  if (ext === "xlsx") return lerXlsx(bytes);
  if (ext === "csv" || ext === "txt" || ext === "tsv") return lerCsv(decodificarTexto(bytes));
  throw new Error("FORMATO_NAO_SUPORTADO");
}
