"use server";

import { logPassiveEvent } from "@/lib/analytics";

export async function logPostView(postId: string, postSlug: string, projectId: string) {
  try {
    await logPassiveEvent({
      projectId,
      type: "project_create", // Using existing type for now
      payload: {
        postId,
        postSlug,
        verb: "view",
      },
    });
  } catch (error) {
    console.warn("[posting/analytics] Failed to log view:", error);
  }
}

export async function logPostTagInteract(
  postId: string,
  postSlug: string,
  projectId: string,
  productId: string
) {
  try {
    await logPassiveEvent({
      projectId,
      type: "tag_add",
      payload: {
        postId,
        postSlug,
        verb: "tag_interact",
        productId,
      },
    });
  } catch (error) {
    console.warn("[posting/analytics] Failed to log tag interact:", error);
  }
}

export async function logPostSave(postId: string, postSlug: string, projectId: string) {
  try {
    await logPassiveEvent({
      projectId,
      type: "save",
      payload: {
        postId,
        postSlug,
        verb: "save",
      },
    });
  } catch (error) {
    console.warn("[posting/analytics] Failed to log save:", error);
  }
}

export async function logVendorInquiry(
  postId: string,
  postSlug: string,
  projectId: string,
  productId: string
) {
  try {
    await logPassiveEvent({
      projectId,
      type: "sample_request",
      payload: {
        postId,
        postSlug,
        verb: "vendor_inquiry",
        productId,
      },
    });
  } catch (error) {
    console.warn("[posting/analytics] Failed to log vendor inquiry:", error);
  }
}

