import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "./src/index.ts",
  format: "esm",
  outDir: "./dist",
  clean: true,
  noExternal: [/@contract-builder\/.*/],
  // The typst compiler ships a native .node binary that must NOT be bundled.
  // Workspace packages are inlined (noExternal above), so without this the
  // bundler follows their `import @myriaddreamin/typst-ts-node-compiler` and
  // chokes trying to load the binary. Keep it external (required at runtime).
  external: [/@myriaddreamin\/typst-ts-node-compiler/],
});
