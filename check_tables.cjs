const https = require("https");

const SUPABASE_URL = "https://evlccmkqzbjmoptfiurx.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2bGNjbWtxemJqbW9wdGZpdXJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3MDc0MzcsImV4cCI6MjEwMTI4MzQzN30.JYePw9zg8w4-yYRB4dqbyxHkLith7JIm4VKVvDvOlyg";

function fetchJSON(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SUPABASE_URL);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "GET",
      headers: {
        "apikey": ANON_KEY,
        "Authorization": `Bearer ${ANON_KEY}`,
        ...headers,
      },
    };
    https.get(opts, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    }).on("error", reject);
  });
}

async function main() {
  // Try to get OpenAPI spec which lists all tables and columns
  console.log("=== Fetching OpenAPI spec ===\n");
  const spec = await fetchJSON("/rest/v1/", { Accept: "application/openapi+json" });

  if (spec.data && spec.data.definitions) {
    const defs = spec.data.definitions;
    for (const [tableName, schema] of Object.entries(defs)) {
      console.log(`\nTABLE: ${tableName}`);
      if (schema.properties) {
        for (const [col, info] of Object.entries(schema.properties)) {
          console.log(`  - ${col}: ${info.type || "unknown"} ${info.format || ""} ${info.description || ""}`);
        }
      }
    }
  } else {
    console.log("No definitions found. Raw response:");
    console.log(JSON.stringify(spec.data, null, 2).substring(0, 3000));
  }
}

main().catch(console.error);
