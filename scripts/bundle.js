#!/usr/bin/env node

import * as esbuild from "esbuild";
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
// @ts-ignore
import { inject } from "postject";

const entry = "src/bin.js";
const binary = "dist/crd-to-cdktf";
const seaConfig = "dist/node-sea-config.json";
const config = {
  main: "dist/bundle.js",
  output: "dist/preparation.blob",
  disableExperimentalSEAWarning: true,
};

function run(/** @type {string} */ cmd, /** @type {string[]} */ args) {
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  if (result.error || result.status !== 0) throw result.error;
}

async function bundle(
  /** @type {string} */ entryfile,
  /** @type {string} */ outfile,
) {
  let result = await esbuild.build({
    entryPoints: [entryfile],
    bundle: true,
    minify: true,
    target: "esnext",
    platform: "node",
    outfile: outfile,
  });

  console.log(`Bundling ${entryfile} to ${outfile} completed`);

  if (result.warnings.length > 0) {
    console.warn(result.warnings);
  }

  if (result.errors.length > 0) {
    console.error(result.errors);
    process.exit(1);
  }
}

async function createSingleExecutableApplication(
  /** @type {string} */ config,
  /** @type {string} */ blob,
  /** @type {string} */ binary,
) {
  run(process.execPath, ["--experimental-sea-config", config]);

  binary = `${binary}${process.platform === "win32" ? ".exe" : ""}`;

  copyFileSync(process.execPath, binary);

  if (process.platform === "darwin") {
    run("codesign", ["--remove-signature", binary]);
  } else if (process.platform === "win32") {
    try {
      run("signtool", ["remove", "/s", binary]);
    } catch (error) {
      console.warn("signtool not found, skipping removal of signature.");
      console.warn(
        "Install signtool from Windows SDK, if you want to sign the binary.",
      );
    }
  }

  await inject(binary, "NODE_SEA_BLOB", readFileSync(blob), {
    sentinelFuse: "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
    machoSegmentName: "NODE_SEA",
  });

  if (process.platform === "darwin") {
    run("codesign", ["--sign", "-", binary]);
  } else if (process.platform === "win32") {
    try {
      run("signtool", ["sign", "/fd", "SHA256", binary]);
    } catch (error) {
      console.warn("signtool not found, skipping signing of binary.");
    }
  }

  console.log(`Single executable application created at ${binary}`);
}

assert(
  parseInt(process.versions.node.split(".")[0] ?? "0", 10) >= 20,
  "Building a single executable application requires Node.js v20 or higher.",
);
mkdirSync(dirname(seaConfig), { recursive: true });
writeFileSync(seaConfig, JSON.stringify(config));
await bundle(entry, config.main);
await createSingleExecutableApplication(seaConfig, config.output, binary);
