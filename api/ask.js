import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-5-20250929";

let REGISTRY = null;
function getRegistry() {
  if (REGISTRY) return REGISTRY;
  const registryPath = path.join(process.cwd(), "registry.json");
  REGISTRY = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
  return REGISTRY;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { query } = req.body || {};
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "Missing query" });
  }

  try {
    const registry = getRegistry();
    const agentSummaries = registry.agents.map((a) => ({
      id: a.id,
      name: a.name,
      tagline: a.tagline,
      covers: a.covers,
      keywords: a.routing_keywords,
      access: a.access,
    }));

    const systemPrompt = `You are WASEET, an agent conductor for a fleet of 30 UAE-built AI agents. You receive a user question and you must:

1. Decide which 1-3 agents from the registry are most relevant.
2. Synthesize an answer based on what those agents cover, with full attribution and clickable links.

Available agents:
${JSON.stringify(agentSummaries, null, 2)}

Output format (markdown, concise):

**Answer**
[2-4 sentences synthesizing what the selected agents would say about this topic. If no agent covers it, say so directly. Never invent facts.]

**Sources**
- **[Agent Name]** - what it covers in 4-6 words
  Link: [public URL or "private access"]
- **[Agent Name 2]** - what it covers in 4-6 words
  Link: [public URL or "private access"]

**Want deeper coverage?**
[One line: subscribe to a channel, visit a web app, etc.]

Rules:
- Always credit the source agents with links.
- Never invent facts about agent outputs you have not seen.
- Be specific. "MedTech Safety Alert covers FDA recalls" beats "there are medical agents."
- If a topic spans territory no agent covers, say so directly.
- Use the agents' public links from their access fields.
- For "/agents" queries, list all 30 agents with taglines.
- For "/about" queries, explain that WASEET is the meta-layer over the fleet.
- Keep responses under 1500 characters.`;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: query }],
    });

    const answer = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return res.status(200).json({ answer });
  } catch (err) {
    console.error("Pipeline error:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
