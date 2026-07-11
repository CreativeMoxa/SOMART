// Message-template rendering. Templates are stored in Settings and use
// {placeholder} tokens so wording can be changed without touching code.

export const DEFAULT_TEMPLATES = {
  whatsappProduct:
    "Hi {business_name}! I'd like to order:\n\n*{product_name}* ({brand})\nPrice: {price}\n\nIs it available?",
  whatsappDocument:
    "*{business_name} — {doc_type} {doc_number}*\n\n{items}\n\nSubtotal: {subtotal}\n*Total: {total}*",
} as const;

export const TEMPLATE_PLACEHOLDERS: Record<keyof typeof DEFAULT_TEMPLATES, string[]> = {
  whatsappProduct: ["{business_name}", "{product_name}", "{brand}", "{price}"],
  whatsappDocument: [
    "{business_name}",
    "{doc_type}",
    "{doc_number}",
    "{customer_name}",
    "{items}",
    "{subtotal}",
    "{discount}",
    "{tax}",
    "{total}",
  ],
};

export function renderTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match);
}
