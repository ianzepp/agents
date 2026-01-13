import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

interface Persona {
  name: string;
  description: string;
  model?: string;
}

function parsePersona(content: string): Persona | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const frontmatter = match[1];
  const name = frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  const model = frontmatter.match(/^model:\s*(.+)$/m)?.[1]?.trim();

  if (!name || !description) return null;
  return { name, description, model };
}

export function list(): void {
  const personasDir = join(homedir(), ".agents", "personas");

  let files: string[];
  try {
    files = readdirSync(personasDir).filter((f) => f.endsWith(".md"));
  }
  catch {
    console.error("No personas directory found");
    process.exit(1);
  }

  const personas: Persona[] = [];
  for (const file of files) {
    const content = readFileSync(join(personasDir, file), "utf-8");
    const persona = parsePersona(content);
    if (persona) {
      personas.push(persona);
    }
  }

  if (personas.length === 0) {
    console.log("No personas found");
    return;
  }

  console.log("Available personas:\n");
  for (const p of personas.sort((a, b) => a.name.localeCompare(b.name))) {
    const model = p.model ? ` (${p.model})` : "";
    console.log(`  ${p.name.padEnd(12)} ${p.description}${model}`);
  }
}
