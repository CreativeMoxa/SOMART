import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

// One row per public-storefront page load. Used only for the dashboard's
// "Web Viewers" counts (last week / month / year / all time), so it stays
// deliberately tiny — just the path and the timestamp.
const pageViewSchema = new Schema(
  {
    path: { type: String, default: "" },
  },
  { timestamps: true }
);

pageViewSchema.index({ createdAt: -1 });

export type PageViewDoc = InferSchemaType<typeof pageViewSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const PageView: Model<PageViewDoc> =
  mongoose.models.PageView || mongoose.model<PageViewDoc>("PageView", pageViewSchema);
