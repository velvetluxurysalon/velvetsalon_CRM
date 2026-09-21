import { Schema, model, Document } from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type BannerType   = "hero" | "offer" | "combo";
export type BannerStatus = "active" | "inactive" | "scheduled";

export interface IBanner extends Document {
  type:       BannerType;
  title:      string;
  subtitle:   string;
  badge:      string;
  cta:        string;
  discount?:  string;
  targetPage: string;
  imageUrl:   string;
  status:     BannerStatus;
  startDate:  string;
  endDate:    string;
  order:      number;
  createdAt:  Date;
  updatedAt:  Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const bannerSchema = new Schema<IBanner>(
  {
    type: {
      type:     String,
      enum:     ["hero", "offer", "combo"],
      required: true,
    },
    title: {
      type:     String,
      required: true,
      trim:     true,
    },
    subtitle: {
      type:     String,
      required: true,
      trim:     true,
    },
    badge: {
      type:     String,
      required: true,
      trim:     true,
    },
    cta: {
      type:    String,
      default: "Book Now",
      trim:    true,
    },
    discount: {
      type:    String,
      default: "",
      trim:    true,
    },
    targetPage: {
      type:     String,
      required: true,
      trim:     true,
    },
    imageUrl: {
      type:    String,
      default: "",
      trim:    true,
    },
    status: {
      type:    String,
      enum:    ["active", "inactive", "scheduled"],
      default: "active",
    },
    startDate: {
      type:     String,
      required: true,
    },
    endDate: {
      type:     String,
      required: true,
    },
    order: {
      type:    Number,
      default: 1,
      min:     1,
    },
  },
  {
    timestamps:  true,
    collection:  "banners",   // dedicated collection, no collision
    versionKey:  false,
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// INDEX — fast queries by status and type for the public website
// ─────────────────────────────────────────────────────────────────────────────
bannerSchema.index({ status: 1, type: 1, order: 1 });

export const Banner = model<IBanner>("Banner", bannerSchema);