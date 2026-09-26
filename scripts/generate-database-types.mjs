import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

try {
  const generated = execFileSync(
    "supabase",
    ["gen", "types", "typescript", "--local"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  if (!generated.includes("export type Database"))
    throw new Error("Unexpected type-generation output");
  writeFileSync(
    fileURLToPath(
      new URL("../src/lib/supabase/database.types.ts", import.meta.url),
    ),
    `${generated}\nexport type Row<Name extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][Name]["Row"];\n`,
  );
  console.log(
    "Types generated from local Supabase. Run typecheck before committing them.",
  );
} catch {
  console.error(
    "Type generation failed. Install the Supabase CLI, start the local DB and apply migrations. Existing types were kept.",
  );
  process.exit(1);
}
