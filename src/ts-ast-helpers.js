import ts from "typescript";

/**
 * @param {string[]} specifier
 * @param {string} from
 * @returns {ts.ImportDeclaration}
 */
export function createNamedImport(specifier, from) {
  return ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(
      false,
      undefined,
      ts.factory.createNamedImports(
        specifier.map((s) => {
          return ts.factory.createImportSpecifier(
            false,
            undefined,
            ts.factory.createIdentifier(s),
          );
        }),
      ),
    ),
    ts.factory.createStringLiteral(from),
  );
}

/**
 * @param {string} name
 * @param {ts.NodeArray<ts.TypeElement>} members
 * @returns {ts.InterfaceDeclaration}
 */
export function createCRDProps(name, members) {
  return ts.factory.createInterfaceDeclaration(
    undefined,
    name,
    undefined,
    undefined,
    [
      ts.factory.createPropertySignature(
        undefined,
        "metadata",
        ts.factory.createToken(ts.SyntaxKind.QuestionToken),
        ts.factory.createTypeReferenceNode("Record", [
          ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
          ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
        ]),
      ),
      ...members,
    ],
  );
}

/**
 * @param {string} name
 * @param {string} kind
 * @param {string} propsName
 * @param {string} apiVersion
 * @returns {ts.ClassDeclaration}
 */
export function createCRDClass(name, kind, propsName, apiVersion) {
  return ts.factory.createClassDeclaration(
    ts.factory.createModifiersFromModifierFlags(ts.ModifierFlags.Export),
    name,
    undefined,
    [
      ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
        ts.factory.createExpressionWithTypeArguments(
          ts.factory.createIdentifier("Manifest"),
          undefined,
        ),
      ]),
    ],
    [
      ts.factory.createConstructorDeclaration(
        undefined,
        [
          ts.factory.createParameterDeclaration(
            undefined,
            undefined,
            "scope",
            undefined,
            ts.factory.createTypeReferenceNode("Construct"),
          ),
          ts.factory.createParameterDeclaration(
            undefined,
            undefined,
            "id",
            undefined,
            ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
          ),
          ts.factory.createParameterDeclaration(
            undefined,
            undefined,
            "props",
            undefined,
            ts.factory.createTypeReferenceNode(propsName),
            undefined,
          ),
        ],
        ts.factory.createBlock(
          [
            ts.factory.createExpressionStatement(
              ts.factory.createCallExpression(
                ts.factory.createSuper(),
                undefined,
                [
                  ts.factory.createIdentifier("scope"),
                  ts.factory.createIdentifier("id"),
                  ts.factory.createObjectLiteralExpression(
                    [
                      ts.factory.createPropertyAssignment(
                        "manifest",
                        ts.factory.createObjectLiteralExpression(
                          [
                            ts.factory.createPropertyAssignment(
                              "apiVersion",
                              ts.factory.createStringLiteral(apiVersion),
                            ),
                            ts.factory.createPropertyAssignment(
                              "kind",
                              ts.factory.createStringLiteral(kind),
                            ),
                            ts.factory.createSpreadAssignment(
                              ts.factory.createIdentifier("props"),
                            ),
                          ],
                          true,
                        ),
                      ),
                    ],
                    true,
                  ),
                ],
              ),
            ),
          ],
          true,
        ),
      ),
    ],
  );
}

/**
 * @param {ts.Node[]} ast
 * @returns {ts.NodeArray<ts.TypeElement>}
 */
export function getSpecMembers(ast) {
  const componentsInterface = ast.find((node) => {
    return ts.isInterfaceDeclaration(node) && node.name.text === "components";
  });

  if (!componentsInterface || !ts.isInterfaceDeclaration(componentsInterface)) {
    throw new Error("'components' interface not found in OpenAPI schema");
  }

  const propertySignatures = componentsInterface.members.filter((node) => {
    return ts.isPropertySignature(node);
  });
  if (!propertySignatures) {
    throw new Error("'components' interface has no properties");
  }

  const schemas = propertySignatures.find((node) => {
    return (
      node.name && ts.isIdentifier(node.name) && node.name.text === "schemas"
    );
  });
  if (!schemas || !ts.isPropertySignature(schemas)) {
    throw new Error("'components' interface has no 'schemas' property");
  }

  if (!schemas.type || !ts.isTypeLiteralNode(schemas.type)) {
    throw new Error("'schemas' property has no type");
  }

  return schemas.type.members;
}
