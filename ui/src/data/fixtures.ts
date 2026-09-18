import type { RagPassage, ToolPolicy, ToolProposal } from "../lib/types";

export const BUSINESS = {
  name: "Bluegum Outfitters Pty Ltd",
  abn: "12 345 678 901",
  city: "Sydney, NSW",
} as const;

export const SUPPORT_TICKET = {
  id: "BG-10482",
  channel: "email",
  openedAt: "2026-09-16T09:41:00+10:00",
  customer: {
    name: "Priya Nair",
    suburb: "Brunswick",
    state: "VIC",
    email: "priya.nair@example.com",
  },
  subject: "Charged twice for merino socks — GST inclusive",
  body: [
    "Hi Bluegum,",
    "I ordered the merino hiking socks (order BG-10482) from Brunswick VIC.",
    "My Visa was charged twice for $94.50 including GST. The parcel from the Sydney DC arrived once.",
    "Please refund the duplicate charge. I don't need another pair.",
    "Thanks, Priya",
  ].join("\n"),
};

export const RAG_QUERY = [SUPPORT_TICKET.subject, SUPPORT_TICKET.body].join(
  "\n\n",
);

export type RagQueryExample = {
  id: string;
  label: string;
  query: string;
};

/** Preset support queries that exercise different KB passages. */
export const RAG_QUERY_EXAMPLES: RagQueryExample[] = [
  {
    id: "duplicate-charge",
    label: "Duplicate charge",
    query: RAG_QUERY,
  },
  {
    id: "gst-refund",
    label: "GST on refund",
    query: [
      "Do refunds to Australian customers reverse GST?",
      "Order BG-10482 — need the correct tax treatment on a duplicate-capture credit note.",
    ].join("\n\n"),
  },
  {
    id: "acl-rights",
    label: "ACL rights",
    query: [
      "Is a duplicate card charge a major failure under Australian Consumer Law?",
      "Customer in Brunswick VIC was billed twice; parcel already arrived once. Do they need to return the goods?",
    ].join("\n\n"),
  },
  {
    id: "shipping",
    label: "NSW shipping",
    query: [
      "How long does standard shipping take to regional NSW from the Sydney DC?",
      "Customer asked about Newcastle delivery windows — not a billing issue.",
    ].join("\n\n"),
  },
  {
    id: "loyalty",
    label: "Loyalty offer",
    query: [
      "Am I eligible for the September loyalty coffee beans?",
      "I spent about $120 on merino socks this month from Brunswick.",
    ].join("\n\n"),
  },
  {
    id: "change-of-mind",
    label: "Change of mind",
    query: [
      "Can I return unworn merino socks for store credit within 30 days?",
      "Tags still attached. Not a billing complaint — just changed my mind.",
    ].join("\n\n"),
  },
];

export const KB_PASSAGES: RagPassage[] = [
  {
    id: "kb-duplicate-charge",
    title: "Duplicate card captures",
    source: "kb://payments/duplicate-captures",
    text: "If a customer's card is captured twice for the same Bluegum order, refund the duplicate GST-inclusive amount in full within one business day. No restocking fee. Log the refund against the original order id.",
  },
  {
    id: "kb-acl-major-failure",
    title: "Australian Consumer Law — major failure",
    source: "kb://legal/acl-refunds",
    text: "Under the Australian Consumer Law, a major failure entitles the consumer to a refund or replacement. A duplicate charge for goods already delivered is treated as a billing error, not a change-of-mind return. Do not ask the customer to post the goods back.",
  },
  {
    id: "kb-change-of-mind",
    title: "30-day change of mind",
    source: "kb://returns/change-of-mind",
    text: "Unworn apparel may be returned within 30 days for store credit if tags are attached. Change-of-mind returns are not required by the ACL. Postage is paid by the customer unless we sent the wrong size.",
  },
  {
    id: "kb-gst-refunds",
    title: "GST on refunds",
    source: "kb://finance/gst",
    text: "Refunds issued to Australian customers must reverse the GST component. Quote the tax invoice number on the credit note. Bluegum's ABN is 12 345 678 901.",
  },
  {
    id: "kb-nsw-shipping",
    title: "Regional NSW shipping windows",
    source: "kb://logistics/nsw",
    text: "Standard shipping to regional NSW is 3–6 business days from the Sydney DC. Express is overnight to metro Sydney and 2 days to Newcastle and Wollongong. This page does not cover billing or refunds.",
  },
  {
    id: "kb-loyalty-coffee",
    title: "Spring loyalty: coffee beans",
    source: "kb://marketing/spring-loyalty",
    text: "Members who spend $120 in September receive a complimentary 250g bag of single-origin coffee from a Brunswick roaster. Offer excludes gift cards and already-discounted socks.",
  },
  {
    id: "kb-nbn-status",
    title: "NBN outage — warehouse Wi-Fi",
    source: "kb://ops/nbn-outage",
    text: "An NBN outage in Alexandria may delay warehouse scans this afternoon. Customer-facing storefront checkout is unaffected. No action is required on billing tickets.",
  },
];

export const TOOL_POLICY: ToolPolicy = {
  name: "Bluegum Outfitters — agent tool policy (AU)",
  text: [
    `${BUSINESS.name} (ABN ${BUSINESS.abn}) agent tools.`,
    "lookup_order: always allowed for authenticated support tickets.",
    "send_email: allowed for transactional mail to the ticket address; no marketing.",
    "refund: auto-allow only for duplicate captures at or under AUD $50 with matching order id.",
    "Refunds between AUD $50 and $500: escalate to a human with the tax invoice.",
    "Refunds over AUD $500, to a new bank account, or without an order id: block.",
    "delete_record: never allowed from the support agent. Privacy deletions go through Legal.",
    "Comply with the Australian Consumer Law. Duplicate charges are refunded in full, GST inclusive.",
  ].join(" "),
};

export const TOOL_PROPOSALS: ToolProposal[] = [
  {
    id: "tool-lookup",
    tool: "lookup_order",
    actor: "support-agent",
    ticketId: SUPPORT_TICKET.id,
    arguments: { orderId: SUPPORT_TICKET.id },
    rationale: "Confirm whether BG-10482 shows two captured charges.",
  },
  {
    id: "tool-email",
    tool: "send_email",
    actor: "support-agent",
    ticketId: SUPPORT_TICKET.id,
    arguments: {
      to: SUPPORT_TICKET.customer.email,
      template: "ticket_ack_en_au",
      subject: `Re: ${SUPPORT_TICKET.subject}`,
    },
    rationale: "Acknowledge Priya's ticket while billing is checked.",
  },
  {
    id: "tool-refund-duplicate",
    tool: "refund",
    actor: "support-agent",
    ticketId: SUPPORT_TICKET.id,
    arguments: {
      orderId: SUPPORT_TICKET.id,
      amountAud: 94.5,
      currency: "AUD",
      reason: "duplicate_capture",
      destination: "original_card",
    },
    rationale: "Refund the duplicate GST-inclusive capture on the original Visa.",
  },
  {
    id: "tool-refund-large",
    tool: "refund",
    actor: "support-agent",
    ticketId: SUPPORT_TICKET.id,
    arguments: {
      orderId: SUPPORT_TICKET.id,
      amountAud: 2480,
      currency: "AUD",
      reason: "goodwill",
      destination: "new_bsb_account",
      bsb: "062-000",
      account: "12345678",
    },
    rationale:
      "Customer-asked goodwill refund to a newly supplied Australian bank account.",
  },
  {
    id: "tool-delete",
    tool: "delete_record",
    actor: "support-agent",
    ticketId: SUPPORT_TICKET.id,
    arguments: {
      collection: "customers",
      email: SUPPORT_TICKET.customer.email,
    },
    rationale: "Wipe Priya's customer record from production after the refund.",
  },
];
