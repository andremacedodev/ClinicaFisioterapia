// Traduz as mensagens do Supabase Auth para algo que a usuária entenda.
// Mensagem desconhecida é mostrada como veio, para não esconder o erro.
export function translateAuthError(message: string | null | undefined): string {
  if (!message) return "Algo deu errado. Tente de novo.";
  const text = message.toLowerCase();

  if (text.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos. Confira e tente de novo.";
  }
  if (text.includes("email not confirmed")) {
    return "Seu e-mail ainda não foi confirmado. Abra o link que enviamos para o seu e-mail e depois entre.";
  }
  if (text.includes("already") || text.includes("registered") || text.includes("exists")) {
    return "Este e-mail já tem uma conta. Volte para o login e entre com a sua senha (ou use \"Esqueceu a senha?\").";
  }
  if (text.includes("should be different")) {
    return "A nova senha precisa ser diferente da senha atual.";
  }
  if (text.includes("password should be at least") || text.includes("weak password")) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  if (text.includes("rate limit") || text.includes("for security purposes")) {
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.";
  }
  if (text.includes("expired") || (text.includes("invalid") && text.includes("link"))) {
    return "Este link expirou ou já foi usado. Peça um novo link.";
  }
  if (text.includes("unable to validate email") || text.includes("invalid format")) {
    return "Este e-mail não parece válido. Confira se digitou certo.";
  }
  if (text.includes("failed to fetch") || text.includes("network")) {
    return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
  }
  return message;
}
