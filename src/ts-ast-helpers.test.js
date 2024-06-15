import assert from "assert/strict";
import { describe, it } from "node:test";
import ts from "typescript";
import {
  createCRDClass,
  createCRDProps,
  createNamedImport,
} from "./ts-ast-helpers.js";

/**
 * @param {ts.Node} node
 * @returns {string}
 */
function printNode(node) {
  const printer = ts.createPrinter();
  const sourceFile = ts.createSourceFile("test.ts", "", ts.ScriptTarget.ESNext);
  return printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
}

describe("createNamedImport", () => {
  it("should create a valid ImportDeclaration with one specifier", () => {
    const specifier = ["MyModule"];
    const from = "my-module";
    const result = createNamedImport(specifier, from);

    const expected = `import { MyModule } from "my-module";`;
    const printedResult = printNode(result);

    assert.strictEqual(printedResult, expected);
  });

  it("should create a valid ImportDeclaration with multiple specifiers", () => {
    const specifiers = ["ModuleA", "ModuleB"];
    const from = "my-modules";
    const result = createNamedImport(specifiers, from);

    const expected = `import { ModuleA, ModuleB } from "my-modules";`;
    const printedResult = printNode(result);

    assert.strictEqual(printedResult, expected);
  });
});

describe("createCRDProps", () => {
  it("should create a valid InterfaceDeclaration with no additional members", () => {
    const name = "TestInterface";
    const members = ts.factory.createNodeArray([]);
    const result = createCRDProps(name, members);

    const expected = `interface TestInterface {\n    metadata?: Record<string, unknown>;\n}`;
    const printedResult = printNode(result);

    assert.strictEqual(printedResult, expected);
  });

  it("should create a valid InterfaceDeclaration with one additional member", () => {
    const name = "TestInterface";
    const additionalMember = ts.factory.createPropertySignature(
      undefined,
      "additionalProp",
      undefined,
      ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
    );
    const members = ts.factory.createNodeArray([additionalMember]);
    const result = createCRDProps(name, members);

    const expected = `interface TestInterface {\n    metadata?: Record<string, unknown>;\n    additionalProp: string;\n}`;
    const printedResult = printNode(result);

    assert.strictEqual(printedResult, expected);
  });

  it("should create a valid InterfaceDeclaration with multiple additional members", () => {
    const name = "TestInterface";
    const additionalMembers = [
      ts.factory.createPropertySignature(
        undefined,
        "prop1",
        undefined,
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
      ),
      ts.factory.createPropertySignature(
        undefined,
        "prop2",
        ts.factory.createToken(ts.SyntaxKind.QuestionToken),
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
      ),
    ];
    const members = ts.factory.createNodeArray(additionalMembers);
    const result = createCRDProps(name, members);

    const expected = `interface TestInterface {\n    metadata?: Record<string, unknown>;\n    prop1: string;\n    prop2?: number;\n}`;
    const printedResult = printNode(result);

    assert.strictEqual(printedResult, expected);
  });
});

describe("createCRDClass", () => {
  it("should create a valid ClassDeclaration", () => {
    const name = "TestClass";
    const kind = "TestClass";
    const propsName = "TestProps";
    const apiVersion = "myresource.example.com/v1";
    const result = createCRDClass(name, kind, propsName, apiVersion);

    const expected = `
export class TestClass extends Manifest {
    constructor(scope: Construct, id: string, props: TestProps) {
        super(scope, id, {
            manifest: {
                apiVersion: "myresource.example.com/v1",
                kind: "TestClass",
                ...props
            }
        });
    }
}
`.trim();

    const printedResult = printNode(result);

    assert.strictEqual(printedResult, expected);
  });
});
