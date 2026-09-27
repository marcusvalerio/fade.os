import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync, crc32 } from "node:zlib";
import { lerCsv, lerXlsx, decodificarTexto, detectarSeparador } from "./planilha.ts";
import { sugerirMapeamento, avaliarLote, existentesDe, lerData, digitosDoTelefone, valoresDaLinha } from "./clientes.ts";

/** Um zip mínimo (deflate), o suficiente para montar um .xlsx de teste. */
function zip(arquivos: Record<string, string>): Uint8Array {
  const locais: Buffer[] = [];
  const centrais: Buffer[] = [];
  let offset = 0;
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    const bruto = Buffer.from(conteudo, "utf8");
    const dados = deflateRawSync(bruto);
    const n = Buffer.from(nome, "utf8");
    const crc = crc32(bruto);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(dados.length, 18);
    local.writeUInt32LE(bruto.length, 22);
    local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(dados.length, 20);
    central.writeUInt32LE(bruto.length, 24);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(offset, 42);
    locais.push(local, n, dados);
    centrais.push(central, n);
    offset += 30 + n.length + dados.length;
  }
  const dir = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(Object.keys(arquivos).length, 8);
  fim.writeUInt16LE(Object.keys(arquivos).length, 10);
  fim.writeUInt32LE(dir.length, 12);
  fim.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locais, dir, fim]));
}

test("CSV com ponto e vírgula, aspas e quebra de linha dentro do campo", () => {
  const t = 'Nome;Telefone;Obs\n"Silva; João";21999990000;"linha 1\nlinha 2"\r\n\nMaria;;\n';
  assert.equal(detectarSeparador(t), ";");
  assert.deepEqual(lerCsv(t), [
    ["Nome", "Telefone", "Obs"],
    ["Silva; João", "21999990000", "linha 1\nlinha 2"],
    ["Maria", "", ""],
  ]);
});

test("CSV em Windows-1252 é decodificado", () => {
  const bytes = new Uint8Array([0x4a, 0x6f, 0xe3, 0x6f]); // "João" em latin-1
  assert.equal(decodificarTexto(bytes), "João");
});

test("XLSX: textos compartilhados, texto inline, números e célula pulada", async () => {
  const arquivo = zip({
    "xl/workbook.xml": '<workbook><sheets><sheet name="Clientes" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/sharedStrings.xml": "<sst><si><t>Nome</t></si><si><t>Telefone</t></si><si><r><t>Ana </t></r><r><t>&amp; Cia</t></r></si></sst>",
    "xl/worksheets/sheet1.xml":
      '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>' +
      '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>21988887777</v></c></row>' +
      '<row r="3"><c r="A3" t="inlineStr"><is><t>Bruno</t></is></c></row></sheetData></worksheet>',
  });
  assert.deepEqual(await lerXlsx(arquivo), [
    ["Nome", "", "Telefone"],
    ["Ana & Cia", "", "21988887777"],
    ["Bruno"],
  ]);
});

test("sugestão de colunas pelo cabeçalho", () => {
  const m = sugerirMapeamento(["Nome do cliente", "Celular", "E-mail", "Data de nascimento", "Observações", "Aceita contato WhatsApp"]);
  assert.deepEqual(m, { name: 0, phone: 1, email: 2, birth_date: 3, notes: 4, consent: 5 });
});

test("datas e telefones", () => {
  const hoje = new Date("2026-09-27T12:00:00Z");
  assert.equal(lerData("05/03/1990", hoje), "1990-03-05");
  assert.equal(lerData("1990-03-05", hoje), "1990-03-05");
  assert.equal(lerData("05/03/90", hoje), "1990-03-05");
  assert.equal(lerData("32928", hoje), "1990-02-24"); // série do Excel
  assert.equal(lerData("31/02/1990", hoje), null);
  assert.equal(lerData("01/01/2030", hoje), null); // no futuro
  assert.equal(digitosDoTelefone("+55 (21) 99999-0000"), "21999990000");
  assert.equal(digitosDoTelefone("021 3333-4444"), "2133334444");
  assert.equal(digitosDoTelefone("12345"), null);
});

test("lote: inválida, já cadastrada, repetida no arquivo, avisos e consentimento", () => {
  const cab = ["Nome", "Telefone", "Email", "Aceita"];
  const mapa = sugerirMapeamento(cab);
  const linhas = [
    ["Ana", "21 99999-0001", "ana@x.com", "sim"],
    ["", "21 99999-0002", "", ""],
    ["Bruno", "21999990003", "bruno@", "não"],
    ["Ana Duplicada", "(21) 99999-0001", "", ""],
    ["Carlos", "5521999990004", "", ""],
  ];
  const r = avaliarLote(
    linhas.map((l, i) => ({ linha: i + 2, valores: valoresDaLinha(l, mapa) })),
    existentesDe([{ phone: "(21) 99999-0004", email: null }])
  );
  assert.deepEqual(r.map((x) => x.situacao), ["nova", "invalida", "nova", "duplicada_no_arquivo", "ja_cadastrada"]);
  assert.equal(r[0].cliente!.communication_consent, true);
  assert.equal(r[0].cliente!.phone, "(21) 99999-0001");
  assert.equal(r[2].cliente!.communication_consent, false);
  assert.equal(r[2].cliente!.email, null);
  assert.deepEqual(r[2].avisos, ["E-mail inválido — ficou em branco"]);
  assert.equal(r[1].motivo, "Sem nome");
});

test("sem telefone nem e-mail: o nome decide duplicado", () => {
  const mapa = { name: 0 };
  const r = avaliarLote(
    [
      { linha: 2, valores: valoresDaLinha(["José da Silva"], mapa) },
      { linha: 3, valores: valoresDaLinha(["Maria"], mapa) },
      { linha: 4, valores: valoresDaLinha(["MARIA "], mapa) },
    ],
    existentesDe([{ name: "Jose  da  Silva", phone: null, email: null }])
  );
  assert.deepEqual(r.map((x) => x.situacao), ["ja_cadastrada", "nova", "duplicada_no_arquivo"]);
});
