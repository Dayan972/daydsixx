import { describe, expect, it } from "vitest";
import { checkBrandUse, scanText } from "@/lib/guardrails/brands";

describe("garde-fou marques", () => {
  it("détecte les marques de la démo Nealens (Cartier, Le Labo, Aventus…)", () => {
    expect(scanText("Une boutique façon Cartier avec la Santos").brands).toContain("cartier");
    expect(scanText("Inspiré du Labo : Santal 33").brands).toContain("santal 33");
    expect(scanText("Parfum AVENTUS 100ml").brands).toContain("aventus");
    expect(scanText("Hermès").brands).toContain("hermes"); // accents ignorés
  });

  it("n'accuse pas les mots courants (faux positifs)", () => {
    expect(scanText("Huile riche en oméga 3").brands).toEqual([]);
    expect(scanText("Sac en faux cuir, type cabas").counterfeitSignals).toEqual([]);
    expect(scanText("Chocolat suprême à la vanille").brands).toEqual([]);
    expect(scanText("Bougie au bois de cèdre").brands).toEqual([]);
  });

  it("repère les signaux de contrefaçon", () => {
    expect(scanText("Dupe de parfum de luxe").counterfeitSignals).toContain("dupe");
    expect(scanText("Montre réplique 1:1").counterfeitSignals).toEqual(expect.arrayContaining(["replique", "1:1"]));
    expect(scanText("Parfum type Aventus").counterfeitSignals).toContain("type");
  });

  it("bloque toujours une identité de boutique qui reprend une marque", () => {
    expect(checkBrandUse({ name: "Cartier Paris Shop" }, "identity", true).allowed).toBe(false);
    expect(checkBrandUse({ name: "Atelier Sillon" }, "identity", false).allowed).toBe(true);
  });

  it("n'autorise un produit de marque que pour un revendeur déclaré, jamais une imitation", () => {
    const authentic = { title: "Creed Aventus 100 ml", description: "Flacon authentique, facture fournie." };
    expect(checkBrandUse(authentic, "product", false).allowed).toBe(false);
    expect(checkBrandUse(authentic, "product", true).allowed).toBe(true);
    const dupe = { title: "Dupe Aventus", description: "Même odeur que l'original" };
    expect(checkBrandUse(dupe, "product", true).allowed).toBe(false);
  });
});
