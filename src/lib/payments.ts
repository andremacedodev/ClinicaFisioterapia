/*
  Formas de pagamento e parcelas de cartão ("maquininha").

  Quando o paciente paga no cartão de crédito parcelado e o dinheiro cai na
  conta mês a mês, o paciente já está quitado: quem deve as parcelas é a
  operadora. Essas parcelas são gravadas com CARD_MACHINE_METHOD para não
  serem tratadas como dívida do paciente (cobrança, inadimplência, WhatsApp).
*/

export const PAYMENT_METHODS = [
  "Pix",
  "Dinheiro",
  "Cartão de débito",
  "Cartão de crédito",
  "Transferência",
  "Boleto",
] as const;

export const CREDIT_CARD_METHOD = "Cartão de crédito";

/** Marca das parcelas que a maquininha deposita (não são dívida do paciente). */
export const CARD_MACHINE_METHOD = "Cartão de crédito (maquininha)";

/** Parcela de pacote (payment_method) ou recebível avulso (descrição). */
export function isCardMachineReceivable(value: string | null | undefined): boolean {
  return Boolean(value?.includes(CARD_MACHINE_METHOD));
}

/** "Cartão de crédito 3x" / "Pix". */
export function describePaymentMethod(method: string, cardInstallments?: number): string {
  if (method === CREDIT_CARD_METHOD && cardInstallments && cardInstallments > 1) {
    return `${method} ${cardInstallments}x`;
  }
  return method;
}
