/**
 * Commerce Module - Phase 1B
 *
 * Exports all commerce-related functionality for the Folio platform.
 */

// Credit management
export {
  getOrCreateCreditAccount,
  earnCredit,
  redeemCredit,
  processPendingCredits,
  getCreditBalance,
  getCreditTransactions,
} from './credit';

// Order management
export {
  createOrder,
  completeOrder,
  cancelOrder,
  getOrder,
  getUserOrders,
  getDesignerAttributedOrders,
  updateOrderStatus,
} from './orders';

// Vendor trade account management
export {
  createTradeAccount,
  updateTradeAccount,
  getVendorTradeAccount,
  updateTradeAccountStatus,
  verifyTradeAccount,
  listActiveTradeAccounts,
  listAllTradeAccounts,
  deleteTradeAccount,
  getTradeAccountStats,
} from './vendor-accounts';
