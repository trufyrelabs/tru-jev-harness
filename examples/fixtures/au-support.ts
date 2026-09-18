import type { RagPassage } from "../../src/index.js";

/** Fictional AU retailer used by the demos. */
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

export const RAG_QUERY = [
  SUPPORT_TICKET.subject,
  SUPPORT_TICKET.body,
].join("\n\n");

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
