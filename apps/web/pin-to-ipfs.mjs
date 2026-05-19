import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "out");
const JWT = process.env.PINATA_JWT;

if (!JWT) {
  console.error("PINATA_JWT not set");
  process.exit(1);
}

// Always rebuild with static export before pinning so the out/ directory
// reflects the current source. Previous flow pinned stale builds.
if (!process.env.SKIP_BUILD) {
  console.log("Building static export (NEXT_EXPORT=1)...");
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  execSync("pnpm build", {
    cwd: __dirname,
    stdio: "inherit",
    env: { ...process.env, NEXT_EXPORT: "1" },
  });
  if (!fs.existsSync(OUT_DIR)) {
    console.error("Build completed but out/ directory is missing");
    process.exit(1);
  }
}

function getAllFiles(dir, base = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, base));
    } else {
      files.push({ fullPath, relativePath: path.relative(base, fullPath) });
    }
  }
  return files;
}

async function pinDirectory() {
  const files = getAllFiles(OUT_DIR);
  console.log(`Uploading ${files.length} files to Pinata...`);

  const formData = new FormData();

  for (const { fullPath, relativePath } of files) {
    const content = fs.readFileSync(fullPath);
    const blob = new Blob([content]);
    // Pinata reconstructs directory structure from the filename path
    formData.append("file", blob, `sources-eth/${relativePath}`);
  }

  formData.append(
    "pinataMetadata",
    JSON.stringify({ name: "sources.eth frontend" })
  );
  formData.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${JWT}`,
    },
    body: formData,
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("Upload failed:", JSON.stringify(result, null, 2));
    process.exit(1);
  }

  console.log("\n✓ Pinned successfully!");
  console.log("CID:", result.IpfsHash);
  console.log("Gateway:", `https://ipfs.io/ipfs/${result.IpfsHash}/`);
  console.log("\nSet sources.eth ENS contenthash to:");
  console.log(`ipfs://${result.IpfsHash}`);
}

pinDirectory().catch(console.error);
