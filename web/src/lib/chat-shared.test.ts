import assert from "node:assert/strict";
import { test } from "node:test";
import { messageRisk } from "./chat-shared.ts";

test("scam warnings catch Turkish wording and suffixes", () => {
  for (const text of ["ön ödeme yapın", "önödeme lazım", "ÖN ÖDEME", "ödeme linki atıyorum", "kaporayı gönder", "kaporası lazım", "kapora gönder", "peşinatı yolla", "paparaya at", "whatsapptan yaz", "whatsapp yaz", "t.me/satici", "TR12 3456 7890 1234 5678 9012 34"]) {
    assert.ok(messageRisk(text), text);
  }
});

test("ordinary messages stay clean", () => {
  for (const text of ["Merhaba, hâlâ satılık mı?", "Yarın görüşebiliriz", "Papatya mahallesindeyim", "Kapıda ödeme olur mu"]) {
    assert.equal(messageRisk(text), null, text);
  }
});
