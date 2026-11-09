import "server-only";
import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };

/** ডেভেলপমেন্টে hot-reload-এ একাধিক সংযোগ এড়াতে একটিমাত্র PrismaClient। */
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
