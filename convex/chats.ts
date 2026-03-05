import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: { title: v.string() },
  handler: async (ctx, { title }) => {
    return await ctx.db.insert("chats", { title });
  },
});

export const get = query({
  args: { id: v.id("chats") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("chats").order("desc").collect();
  },
});

export const updateTitle = mutation({
  args: { id: v.id("chats"), title: v.string() },
  handler: async (ctx, { id, title }) => {
    await ctx.db.patch(id, { title });
  },
});

export const remove = mutation({
  args: { id: v.id("chats") },
  handler: async (ctx, { id }) => {
    // Delete all messages
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", id))
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
    // Delete all documents
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_chat", (q) => q.eq("chatId", id))
      .collect();
    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }
    // Delete chat
    await ctx.db.delete(id);
  },
});
