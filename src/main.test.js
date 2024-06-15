import assert from "assert/strict";
import { describe, it } from "node:test";
import ts from "typescript";
import { isCRD, isCRDList, transformCRD } from "./main.js";

/**
 * @param {ts.Node} node
 * @returns {string}
 */
function printNode(node) {
  const printer = ts.createPrinter();
  const sourceFile = ts.createSourceFile("test.ts", "", ts.ScriptTarget.ESNext);
  return printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
}

describe("isCRD", () => {
  it("should return true for a valid CRD object", () => {
    const validCRD = {
      apiVersion: "apiextensions.k8s.io/v1",
      kind: "CustomResourceDefinition",
      metadata: { name: "myresource.example.com" },
      spec: {
        names: { kind: "TestKind" },
        versions: [
          {
            name: "v1",
            schema: { openAPIV3Schema: { properties: { spec: {} } } },
          },
        ],
      },
    };

    assert.strictEqual(isCRD(validCRD), true);
  });

  it("should return false for an invalid CRD object", () => {
    const invalidCRD = {
      apiVersion: "v1",
      kind: "CustomResourceDefinition",
    };

    assert.strictEqual(isCRD(invalidCRD), false);
  });
});

describe("isCRDList", () => {
  it("should return true for a valid CRDList object", () => {
    const validCRDList = {
      apiVersion: "v1",
      kind: "List",
      items: [
        {
          apiVersion: "apiextensions.k8s.io/v1",
          kind: "CustomResourceDefinition",
          metadata: { name: "myresource.example.com" },
          spec: {
            names: { kind: "TestKind" },
            versions: [
              {
                name: "v1",
                schema: { openAPIV3Schema: { properties: { spec: {} } } },
              },
            ],
          },
        },
      ],
    };

    assert.strictEqual(isCRDList(validCRDList), true);
  });

  it("should return false for an invalid CRDList object", () => {
    const invalidCRDList = {
      apiVersion: "v1",
      kind: "List",
      items: [
        {
          apiVersion: "v1",
          kind: "CustomResourceDefinition",
        },
      ],
    };

    assert.strictEqual(isCRDList(invalidCRDList), false);
  });
});

describe("transformCRD", () => {
  it("should transform a valid CRD into TypeScript AST nodes", async () => {
    const validCRD = {
      apiVersion: "apiextensions.k8s.io/v1",
      kind: /** @type {const} */ ("CustomResourceDefinition"),
      metadata: { name: "myresource.example.com" },
      spec: {
        names: { kind: "TestKind" },
        versions: [
          {
            name: "v1",
            schema: {
              openAPIV3Schema: {
                properties: {
                  spec: {
                    type: /** @type {const} */ ("object"),
                    properties: {
                      field1: { type: /** @type {const} */ ("string") },
                      field2: { type: /** @type {const} */ ("number") },
                    },
                  },
                },
              },
            },
          },
        ],
      },
    };

    const nodes = await transformCRD(validCRD);
    const printedNodes = nodes.map(printNode).join("\n");

    const expected = `
import { Manifest } from "@cdktf/provider-kubernetes/lib/manifest";
import { Construct } from "constructs";
interface TestKindProps {
    metadata?: Record<string, unknown>;
    spec: {
        field1?: string;
        field2?: number;
    };
}
export class TestKind extends Manifest {
    constructor(scope: Construct, id: string, props: TestKindProps) {
        super(scope, id, {
            manifest: {
                apiVersion: "myresource.example.com/v1",
                kind: "TestKind",
                ...props
            }
        });
    }
}
`.trim();

    assert.strictEqual(printedNodes, expected);
  });

  it("should handle a CRD with multiple versions", async () => {
    const validCRD = {
      apiVersion: "apiextensions.k8s.io/v1",
      kind: /** @type {const} */ ("CustomResourceDefinition"),
      metadata: { name: "myresource.example.com" },
      spec: {
        names: { kind: "TestKind" },
        versions: [
          {
            name: "v1",
            schema: {
              openAPIV3Schema: {
                properties: {
                  spec: {
                    type: /** @type {const} */ ("object"),
                    properties: {
                      field1: { type: /** @type {const} */ ("string") },
                      field2: { type: /** @type {const} */ ("number") },
                    },
                  },
                },
                required: ["spec"],
              },
            },
          },
          {
            name: "v2",
            schema: {
              openAPIV3Schema: {
                properties: {
                  spec: {
                    type: /** @type {const} */ ("object"),
                    properties: {
                      field3: { type: /** @type {const} */ ("boolean") },
                    },
                  },
                },
                required: ["spec"],
              },
            },
          },
        ],
      },
    };

    const nodes = await transformCRD(
      /** @type {import("./main.js").CRD} */ (
        /** @type {unknown} */ (validCRD)
      ),
    );
    const printedNodes = nodes.map(printNode).join("\n");

    const expected = `
import { Manifest } from "@cdktf/provider-kubernetes/lib/manifest";
import { Construct } from "constructs";
interface TestKindV1Props {
    metadata?: Record<string, unknown>;
    spec: {
        field1?: string;
        field2?: number;
    };
}
export class TestKindV1 extends Manifest {
    constructor(scope: Construct, id: string, props: TestKindV1Props) {
        super(scope, id, {
            manifest: {
                apiVersion: "myresource.example.com/v1",
                kind: "TestKind",
                ...props
            }
        });
    }
}
interface TestKindV2Props {
    metadata?: Record<string, unknown>;
    spec: {
        field3?: boolean;
    };
}
export class TestKindV2 extends Manifest {
    constructor(scope: Construct, id: string, props: TestKindV2Props) {
        super(scope, id, {
            manifest: {
                apiVersion: "myresource.example.com/v2",
                kind: "TestKind",
                ...props
            }
        });
    }
}
`.trim();

    assert.strictEqual(printedNodes, expected);
  });
});
