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
