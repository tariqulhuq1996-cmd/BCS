import type { PrismaClient } from "@prisma/client";
import { DEFAULT_RULES, type RuleValue } from "./defaults";

export type Rules = { get<T extends RuleValue = number>(key: string, scopes?: string[]): T };

/**
 * ডেটাবেসের RuleSetting + প্রাথমিক মান একত্র করে।
 * scopes নির্দিষ্টতম থেকে সাধারণ ক্রমে দিন, যেমন ["task:L1:EXAM:39", "level:1"]; শেষে "global" ধরা হয়।
 */
export async function loadRules(db: PrismaClient): Promise<Rules> {
  const rows = await db.ruleSetting.findMany();
  const map = new Map(rows.map((r) => [`${r.scope}|${r.key}`, r.value as RuleValue]));
  return {
    get<T extends RuleValue = number>(key: string, scopes: string[] = []): T {
      for (const s of [...scopes, "global"]) {
        const v = map.get(`${s}|${key}`);
        if (v !== undefined) return v as T;
      }
      if (key in DEFAULT_RULES) return DEFAULT_RULES[key].value as T;
      throw new Error(`অজানা নিয়ম: ${key}`);
    },
  };
}
