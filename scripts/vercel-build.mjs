import { cp, mkdir } from "node:fs/promises";

await mkdir("public", { recursive: true });

for (const file of ["index.html", "axis.html", "styles.css"]) {
  await cp(file, `public/${file}`);
}

