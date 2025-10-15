export type HandoffProductItem = {
  productId?: string
  sku?: string
  finish?: string
  quantity?: number
  note?: string
  imageUrl?: string
}

export type HandoffQuotePayload =
  | { kind: 'file'; fileUrl: string; fileName: string; expiresAt?: string }
  | {
      kind: 'structured'
      totalCents?: number
      currency?: string
      leadTimeDays?: number
      termsShort?: string
      expiresAt?: string
      jsonPayload?: any
    }

export type CreateHandoffRequest = {
  designerEmail: string
  products: HandoffProductItem[]
  quote?: HandoffQuotePayload
  note?: string
  expiresAt?: string
  sendEmail?: boolean
}




