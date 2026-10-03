import assert from "node:assert/strict";
import test from "node:test";
import { pickLanguage, translate } from "./translate.ts";

const tr = { hello: "Merhaba {name}", items: { one: "{count} öğe", other: "{count} öğe" }, onlyTr: "Sadece TR" };
const en = { hello: "Hello {name}", items: { one: "{count} item", other: "{count} items" } };

test("değişken yerleştirme", () => {
  assert.equal(translate(en, tr, "en", "hello", { name: "Ada" }), "Hello Ada");
});

test("İngilizcede tekil/çoğul", () => {
  assert.equal(translate(en, tr, "en", "items", { count: 1 }), "1 item");
  assert.equal(translate(en, tr, "en", "items", { count: 3 }), "3 items");
});

test("eksik çeviri varsayılan dile düşer, o da yoksa anahtar görünür", () => {
  assert.equal(translate(en, tr, "en", "onlyTr"), "Sadece TR");
  assert.equal(translate(en, tr, "en", "yok.boyle.bir.anahtar"), "yok.boyle.bir.anahtar");
});

test("bilinmeyen değişken olduğu gibi kalır", () => {
  assert.equal(translate(en, tr, "en", "hello"), "Hello {name}");
});

test("cihaz dilinden desteklenen dil seçimi", () => {
  assert.equal(pickLanguage(["de-DE", "en-GB"], ["tr", "en"], "tr"), "en");
  assert.equal(pickLanguage(["tr_TR"], ["tr", "en"], "en"), "tr");
  assert.equal(pickLanguage(["fr-FR"], ["tr", "en"], "tr"), "tr");
});
