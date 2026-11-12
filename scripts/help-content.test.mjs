/* global process */
// Confere a Central de Ajuda: ids únicos, links válidos e mapa de telas.
// Uso: npx esbuild src/help/content.ts --format=esm --outfile=/tmp/help-content.mjs && node scripts/help-content.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

const modulePath = process.env.HELP_CONTENT_MODULE ?? "/tmp/help-content.mjs";
const { HELP_ARTICLES, HELP_FAQS, HELP_CATEGORIES, helpContextForPath, contextRuleArticleIds } = await import(modulePath);

const ids = new Set(HELP_ARTICLES.map((article) => article.id));

test("ids de tutoriais e perguntas são únicos", () => {
  assert.equal(ids.size, HELP_ARTICLES.length);
  assert.equal(new Set(HELP_FAQS.map((faq) => faq.id)).size, HELP_FAQS.length);
});

test("todo tutorial está numa categoria existente e tem passos", () => {
  const categories = new Set(HELP_CATEGORIES.map((category) => category.id));
  for (const article of HELP_ARTICLES) {
    assert.ok(categories.has(article.category), article.id);
    assert.ok(article.steps.length > 0, article.id);
  }
});

test("links de 'Veja também' e do botão ? apontam para tutoriais existentes", () => {
  for (const article of HELP_ARTICLES) {
    for (const related of article.related ?? []) assert.ok(ids.has(related), `${article.id} -> ${related}`);
  }
  for (const id of contextRuleArticleIds()) assert.ok(ids.has(id), id);
});

test("negrito sempre fechado (** em pares)", () => {
  const texts = HELP_ARTICLES.flatMap((a) => [a.title, a.summary, ...a.steps.flatMap((s) => [s.text, s.tip ?? ""])])
    .concat(HELP_FAQS.map((f) => f.answer));
  for (const text of texts) assert.equal((text.match(/\*\*/g) ?? []).length % 2, 0, text);
});

test("botão ? escolhe a tela mais específica", () => {
  assert.equal(helpContextForPath("/pacientes/abc/prontuario").title, "Prontuário");
  assert.equal(helpContextForPath("/pacientes").title, "Pacientes");
  assert.equal(helpContextForPath("/financeiro/comissoes").title, "Comissões");
  assert.equal(helpContextForPath("/financeiro").title, "Financeiro");
  assert.equal(helpContextForPath("/").title, "Início");
  assert.equal(helpContextForPath("/notas-fiscais"), null);
});

test("a fisioterapeuta tem tutoriais nas telas que ela usa", () => {
  const forPhysio = (path) =>
    helpContextForPath(path).articleIds.filter((id) => HELP_ARTICLES.find((a) => a.id === id).audience === "all");
  for (const path of ["/", "/agenda", "/pacientes", "/pacientes/x/prontuario", "/atestados", "/financeiro/comissoes"]) {
    assert.ok(forPhysio(path).length > 0, path);
  }
});
