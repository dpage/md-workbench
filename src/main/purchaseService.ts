//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import Store from 'electron-store';
import { app } from 'electron';

// Product identifier for the "Remove Ads" in-app purchase.
// This must match the product ID configured in App Store Connect.
const REMOVE_ADS_PRODUCT_ID = 'page.conx.mdworkbench.removeads';

interface PurchaseStore {
  adFree: boolean;
}

const purchaseStore = new Store<PurchaseStore>({
  name: 'purchases',
  defaults: {
    adFree: false,
  },
});

/**
 * Returns whether the user has purchased ad removal.
 */
export function isAdFree(): boolean {
  return purchaseStore.get('adFree', false);
}

/**
 * Purchase the "Remove Ads" product.
 *
 * TODO: Replace this placeholder with a native StoreKit 2 integration.
 * For MAS builds, this should call the native module to initiate a real
 * StoreKit purchase transaction. The native module would need to:
 *   1. Fetch the product from App Store Connect using REMOVE_ADS_PRODUCT_ID
 *   2. Present the payment sheet
 *   3. Verify the transaction
 *   4. Persist the entitlement
 *
 * For now, in development/testing mode this simply sets the flag directly.
 */
export async function purchaseRemoveAds(): Promise<{ success: boolean; error?: string }> {
  if (!app.isPackaged) {
    // Dev mode: toggle the flag directly for testing
    purchaseStore.set('adFree', true);
    return { success: true };
  }

  // TODO: Integrate native StoreKit 2 module here
  // const result = await nativeStoreKit.purchase(REMOVE_ADS_PRODUCT_ID);
  // if (result.success) {
  //   purchaseStore.set('adFree', true);
  // }
  // return result;

  // Placeholder for production — will need native module
  purchaseStore.set('adFree', true);
  return { success: true };
}

/**
 * Restore previous purchases.
 *
 * TODO: Replace with native StoreKit 2 restore. Should call
 * StoreKit's `Transaction.currentEntitlements` to check for
 * the REMOVE_ADS_PRODUCT_ID entitlement.
 */
export async function restorePurchases(): Promise<{ success: boolean; adFree: boolean; error?: string }> {
  if (!app.isPackaged) {
    // Dev mode: just return current state
    const adFree = purchaseStore.get('adFree', false);
    return { success: true, adFree };
  }

  // TODO: Integrate native StoreKit 2 restore here
  // const entitlements = await nativeStoreKit.currentEntitlements();
  // const adFree = entitlements.includes(REMOVE_ADS_PRODUCT_ID);
  // purchaseStore.set('adFree', adFree);
  // return { success: true, adFree };

  // Placeholder for production
  const adFree = purchaseStore.get('adFree', false);
  return { success: true, adFree };
}

/**
 * Reset the ad-free status (for testing only).
 */
export function resetAdFree(): void {
  purchaseStore.set('adFree', false);
}
