import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface Persona {
  name: string;
  description: string;
  model?: string;
  content: string;
}

export function loadPersona(name: string): Persona | null {
  const personasDir = join(homedir(), ".agents", "personas");
  const filePath = join(personasDir, `${name}.md`);

  if (!existsSync(filePath)) {
    return null;
  }

  const raw = readFileSync(filePath, "utf-8");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;

  const frontmatter = match[1];
  const content = match[2].trim();

  const parsedName = frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  const model = frontmatter.match(/^model:\s*(.+)$/m)?.[1]?.trim();

  if (!parsedName || !description) return null;

  return { name: parsedName, description, model, content };
}
