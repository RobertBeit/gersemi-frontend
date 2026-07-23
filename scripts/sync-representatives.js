const fs = require("fs");
const path = require("path");
const https = require("https");

const SOURCE_URL = "https://clerk.house.gov/xml/lists/MemberData.xml";
const OUTPUT_FILE = path.resolve(__dirname, "../src/data/representatives.json");

const fetchXml = (url) => new Promise((resolve, reject) => {
  https
    .get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to fetch XML: ${response.statusCode}`));
        return;
      }

      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    })
    .on("error", reject);
});

const decode = (value = "") => value
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .trim();

const extractTag = (source, tag) => {
  const match = source.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decode(match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")) : "";
};

const extractStateCode = (source) => {
  const match = source.match(/<state[^>]*postal-code=\"([^\"]+)\"/i);
  return match ? match[1].trim() : "";
};

const parseMembers = (xml) => {
  const members = [];
  const seen = new Set();
  const memberRegex = /<member>([\s\S]*?)<\/member>/gi;
  let match = memberRegex.exec(xml);

  while (match) {
    const block = match[1];
    const memberInfo = extractTag(block, "member-info");

    const bioguideID = extractTag(block, "bioguideID");
    if (!bioguideID || seen.has(bioguideID)) {
      match = memberRegex.exec(xml);
      continue;
    }

    seen.add(bioguideID);
    members.push({
      bioguideID,
      officialName: extractTag(block, "official-name"),
      formalName: extractTag(block, "formal-name"),
      firstName: extractTag(block, "firstname"),
      lastName: extractTag(block, "lastname"),
      stateCode: extractStateCode(block),
      stateName: extractTag(block, "state-fullname"),
      district: extractTag(block, "district"),
      statedistrict: extractTag(block, "statedistrict"),
      party: extractTag(block, "party"),
      status: extractTag(block, "member-status"),
      source: SOURCE_URL,
    });

    match = memberRegex.exec(xml);
  }

  return members
    .filter((member) => member.officialName && member.stateCode)
    .sort((a, b) => `${a.lastName}|${a.firstName}`.localeCompare(`${b.lastName}|${b.firstName}`));
};

const main = async () => {
  const xml = await fetchXml(SOURCE_URL);
  const members = parseMembers(xml);

  const output = {
    updatedAt: new Date().toISOString(),
    source: SOURCE_URL,
    count: members.length,
    members,
  };

  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Wrote ${members.length} representatives to ${OUTPUT_FILE}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
