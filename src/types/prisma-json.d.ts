// prisma-json-types-generator: schema.prisma-র "/// [নাম]" চিহ্নিত Json-ঘরের ধরন।
// MariaDB-তে তালিকা (array) কলাম নেই, তাই এগুলো JSON-এ রাখা; কোডে আগের মতোই string[]।
declare global {
  namespace PrismaJson {
    type StringList = string[];
    /** প্রশ্ন-id → উপস্থাপনের অপশন-বিন্যাস */
    type OptionPerms = Record<string, number[]>;
  }
}
export {};
