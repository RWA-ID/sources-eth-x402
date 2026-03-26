#!/usr/bin/env node
/**
 * Pin the Next.js static export to IPFS via Pinata.
 * Usage: PINATA_JWT=your_jwt node scripts/pin-to-ipfs.mjs
 *
 * After successful pin, update sources.eth ENS contenthash to ipfs://CID
 */

import { readdir, readFile } from "fs/promises";
import { join, relative } from "path";

const JWT = process.env.PINATA_JWT;
if (!JWT) {
  console.error("❌  PINATA_JWT env var is required");
  process.exit(1);
}

const OUT_DIR = new URL("../out", import.meta.url).pathname;

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  console.log("📦  Reading out/ directory...");
  const allFiles = await listFiles(OUT_DIR);
  console.log(`   Found ${allFiles.length} files`);

  const form = new FormData();

  for (const file of allFiles) {
    const rel = relative(OUT_DIR, file);
    const content = await readFile(file);
    const blob = new Blob([content]);
    form.append("file", blob, `sources-eth/${rel}`);
  }

  form.append("pinataMetadata", JSON.stringify({ name: "sources.eth frontend" }));
  form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  console.log("📤  Uploading to Pinata...");
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${JWT}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("❌  Pinata error:", err);
    process.exit(1);
  }

  const data = await res.json();
  const cid = data.IpfsHash;

  console.log("");
  console.log("✅  Pinned to IPFS!");
  console.log(`   CID:      ${cid}`);
  console.log(`   Gateway:  https://ipfs.io/ipfs/${cid}/`);
  console.log(`   eth.limo: https://sources.eth.limo  (after ENS update)`);
  console.log("");
  console.log("🔗  Next step: update sources.eth ENS contenthash to:");
  console.log(`   ipfs://${cid}`);
  console.log("");
  console.log("   Using ENS App (app.ens.domains):");
  console.log(`   1. Go to sources.eth → Edit → Content Hash`);
  console.log(`   2. Paste: ipfs://${cid}`);
  console.log(`   3. Submit transaction`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
