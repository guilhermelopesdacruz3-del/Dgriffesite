import { describe, expect, it } from "vitest";
import { sanitizeMpPayment, type MpPaymentData } from "@/lib/checkout";
import { formatBRL } from "@/lib/utils";

/**
 * LGPD/segurança — o payload do Mercado Pago salvo em Payment.raw é recortado
 * em lista branca: só sobrevivem dados operacionais. Nada de e-mail do
 * pagador, nome/CPF ou dígitos de cartão (mesmo que o gateway envie).
 */
describe("sanitizeMpPayment", () => {
  const entradaCrua = {
    id: 123456,
    status: "approved",
    status_detail: "accredited",
    external_reference: "PZ-TESTE123",
    transaction_amount: 266.8,
    date_approved: "2026-11-03T10:00:00.000Z",
    payment_type_id: "credit_card",
    // campos que DEVEM sumir:
    payer_email: "cliente@sigiloso.com",
    payer: { email: "cliente@sigiloso.com", first_name: "Ana", identification: { number: "123.456.789-00" } },
    card: { last_four_digits: "4321", holder: { name: "Ana Silva" } },
    place_of_business: { street: "n/a" },
  } as unknown as MpPaymentData & Record<string, unknown>;

  it("mantém apenas os campos da lista branca", () => {
    const saida = sanitizeMpPayment(entradaCrua) as Record<string, unknown>;
    expect(saida.id).toBe(123456);
    expect(saida.status).toBe("approved");
    expect(saida.external_reference).toBe("PZ-TESTE123");
    expect(saida.transaction_amount).toBe(266.8);
  });

  it("descarta e-mail do pagador, nome, CPF e dígitos de cartão", () => {
    const texto = JSON.stringify(sanitizeMpPayment(entradaCrua));
    expect(texto).not.toContain("sigiloso.com");
    expect(texto).not.toContain("4321");
    expect(texto).not.toContain("123.456.789-00");
    expect(texto).not.toContain("Ana");
  });

  it("preserva os códigos de Pix quando o gateway os manda", () => {
    const comPix = {
      ...entradaCrua,
      point_of_interaction: {
        transaction_data: {
          qr_code: "00020126580014BR...",
          qr_code_base64: "iVBORw0KGgo=",
          external_resource_url: "https://api.mercadolibre.com/boleto",
        },
      },
    } as unknown as MpPaymentData;
    const texto = JSON.stringify(sanitizeMpPayment(comPix));
    expect(texto).toContain("00020126580014BR");
    expect(texto).toContain("iVBORw0KGgo=");
    // tudo fora de point_of_interaction.transaction_data continua fora
    expect(texto).not.toContain("sigiloso.com");
  });
});

/** Formatação monetária em pt-BR (o preço em todo o site). */
describe("formatBRL", () => {
  it("formata centavos e milhares no padrão brasileiro", () => {
    expect(formatBRL(266.8)).toContain("266,80");
    expect(formatBRL(1234.56)).toContain("1.234,56");
    expect(formatBRL(0)).toContain("0,00");
  });
});
