import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  chats: defineTable({
    title: v.string(),
  }),

  messages: defineTable({
    chatId: v.id("chats"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    isStreaming: v.optional(v.boolean()),
    documentGenerated: v.optional(v.boolean()),
  }).index("by_chat", ["chatId"]),

  documents: defineTable({
    chatId: v.id("chats"),
    html: v.string(),
    version: v.number(),
    shareToken: v.optional(v.string()),
  })
    .index("by_chat", ["chatId"])
    .index("by_share_token", ["shareToken"]),
});
