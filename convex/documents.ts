import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const save = mutation({
  args: {
    chatId: v.id("chats"),
    html: v.string(),
    version: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("documents", args);
  },
});

export const latest = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, { chatId }) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_chat", (q) => q.eq("chatId", chatId))
      .order("desc")
      .first();
  },
});

export const listVersions = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, { chatId }) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_chat", (q) => q.eq("chatId", chatId))
      .order("desc")
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("documents") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const getByShareToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_share_token", (q) => q.eq("shareToken", token))
      .first();
  },
});

export const generateShareToken = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, { id }) => {
    const doc = await ctx.db.get(id);
    if (!doc) throw new Error("Document not found");

    // If already has a share token, return it
    if (doc.shareToken) return doc.shareToken;

    // Generate a random token
    const token =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    await ctx.db.patch(id, { shareToken: token });
    return token;
  },
});
