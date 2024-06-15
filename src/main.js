import { load } from "js-yaml";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import openapiTS, { astToString } from "openapi-typescript";
import ts from "typescript";
import {
  createCRDClass,
  createCRDProps,
  createNamedImport,
  getSpecMembers,
} from "./ts-ast-helpers.js";

/**
 * @typedef {import("openapi-typescript").SchemaObject} SchemaObject
 */

/**
 * @typedef {Object} CRD
 * @property {string} apiVersion
 * @property {"CustomResourceDefinition"} kind
 * @property {Object} metadata
 * @property {string} metadata.name
 * @property {Object} spec
 * @property {Object} spec.names
 * @property {string} spec.names.kind
 * @property {Object[]} spec.versions
 * @property {string} spec.versions[].name
 * @property {Object} spec.versions[].schema
 * @property {Object} spec.versions[].schema.openAPIV3Schema
 * @property {Object} spec.versions[].schema.openAPIV3Schema.properties
 * @property {SchemaObject} spec.versions[].schema.openAPIV3Schema.properties.spec
 */

/**
 * @typedef {Object} CRDList
 * @property {string} apiVersion
 * @property {"List"} kind
 * @property {Array<CRD>} items
 */

/**
 * @param {any} obj
 * @returns {obj is CRD}
 */
export function isCRD(obj) {
  return (
    obj.apiVersion === "apiextensions.k8s.io/v1" &&
    obj.kind === "CustomResourceDefinition"
  );
}

/**
 * @param {any} obj
 * @returns {obj is CRDList}
 */
export function isCRDList(obj) {
  return obj.kind === "List" && obj.items.every(isCRD);
}

/**
 * @param {CRD} crd
 * @returns {Promise<ts.Node[]>}
 */
export async function transformCRD(crd) {
  const apiVersion = crd.metadata.name;
  const kind = crd.spec.names.kind;
  const singleVersion = crd.spec.versions.length === 1;

  const versions = crd.spec.versions.map(async (version) => {
    let ast;
    try {
      ast = await openapiTS({
        openapi: "3.0.0",
        info: {
          title: apiVersion,
          version: version.name,
        },
        components: {
          schemas: {
            spec: version.schema.openAPIV3Schema.properties.spec,
          },
        },
      });
    } catch (error) {
      throw new Error(
        `Failed to transform OpenAPI schema to TypeScript for ${kind} ${apiVersion}/${version.name}`,
        { cause: error },
      );
    }

    const versionUpper = version.name.replace(/^./, (c) => c.toUpperCase());
    const className = singleVersion ? kind : `${kind}${versionUpper}`;
    const propsName = `${className}Props`;

    return [
      createCRDProps(propsName, getSpecMembers(ast)),
      createCRDClass(
        className,
        kind,
        propsName,
        `${apiVersion}/${version.name}`,
      ),
    ];
  });

  return [
    createNamedImport(["Manifest"], "@cdktf/provider-kubernetes/lib/manifest"),
    createNamedImport(["Construct"], "constructs"),
    ...(await Promise.all(versions)).flat(),
  ];
}

/**
 * @param {string} content
 * @param {string} outputDir
 */
export async function transform(content, outputDir = process.cwd()) {
  let parsed;
  try {
    parsed = load(content);
  } catch (error) {
    throw new Error(`Failed to parse YAML content`, { cause: error });
  }

  const crds = [];

  if (isCRDList(parsed)) {
    crds.push(...parsed.items);
  } else if (isCRD(parsed)) {
    crds.push(parsed);
  } else {
    throw new Error("Input is not a CRD or CRD list");
  }

  for (const crd of crds) {
    let content;
    try {
      content = astToString(await transformCRD(crd));
    } catch (error) {
      throw new Error(`Failed to transform CRD ${crd.metadata.name}`, {
        cause: error,
      });
    }

    try {
      await mkdir(outputDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create output directory ${outputDir}`, {
        cause: error,
      });
    }
    const filepath = resolve(outputDir, `${crd.metadata.name}.ts`);

    try {
      await writeFile(filepath, content);
    } catch (error) {
      throw new Error(`Failed to write to ${filepath}`, { cause: error });
    }
  }
}

/**
 * @param {string[]} args
 * @param {NodeJS.ReadStream} stdin
 */
export async function main(args, stdin) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" },
      output: { type: "string", short: "o" },
    },
    allowPositionals: true,
  });

  if (values.help || (!positionals.length && stdin.isTTY)) {
    console.log(
      `
Usage: crd-to-cdktf [OPTIONS] [FILE]
  When FILE is not provided, read from stdin.
  Options:
    -h, --help    Print this help message
    -o, --output  Output directory
  Examples:
    kubeclt get crds -o yaml | crd-to-cdktf -o crds
    crd-to-cdktf mycrd.yaml -o crds
  `.trim(),
    );

    return;
  }

  if (positionals.length) {
    await Promise.all(
      positionals.map(async (file) => {
        try {
          const content = await readFile(resolve(file), "utf-8");
          await transform(content, values.output);
        } catch (error) {
          throw new Error(`Failed to process CRDs from file ${file}`, {
            cause: error,
          });
        }
      }),
    );
  } else {
    let content = "";
    for await (const chunk of stdin) {
      content += chunk;
    }

    try {
      await transform(content, values.output);
    } catch (error) {
      throw new Error("Failed to process CRDs from stdin", { cause: error });
    }
  }
}
