/* ============================================================================
 * Copyright (c) Palo Alto Networks
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 * ========================================================================== */

import { MediaTypeObject, SchemaObject } from "../openapi/types";
import {
  createClosingArrayBracket,
  createOpeningArrayBracket,
} from "./createArrayBracket";
import { createDescription } from "./createDescription";
import { createDetails } from "./createDetails";
import { createDetailsSummary } from "./createDetailsSummary";
import { getQualifierMessage, getSchemaName } from "./schema";
import { create, guard } from "./utils";

const jsonSchemaMergeAllOf = require("json-schema-merge-allof");

/**
 * Returns a merged representation of allOf array of schemas.
 */
export function mergeAllOf(allOf: SchemaObject[]) {
  const mergedSchemas = jsonSchemaMergeAllOf(allOf, {
    resolvers: {
      readOnly: function () {
        return true;
      },
      example: function () {
        return true;
      },
      "x-examples": function () {
        return true;
      },
    },
    ignoreAdditionalProperties: true,
  });

  const required = allOf.reduce((acc, cur) => {
    if (Array.isArray(cur.required)) {
      const next = [...acc, ...cur.required];
      return next;
    }
    return acc;
  }, [] as any);

  return { mergedSchemas, required };
}

/**
 * For handling nested anyOf/oneOf.
 */
function createAnyOneOf(schema: SchemaObject): any {
  const type = schema.oneOf ? "oneOf" : "anyOf";
  return create("li", {
    children: [
      create("span", {
        className: "badge badge--info",
        children: type,
      }),
      create("SchemaTabs", {
        children: schema[type]!.map((anyOneSchema, index) => {
          const label = anyOneSchema.title
            ? anyOneSchema.title
            : `MOD${index + 1}`;
          const anyOneChildren = [];

          if (anyOneSchema.properties !== undefined) {
            anyOneChildren.push(createProperties(anyOneSchema));
          }

          if (anyOneSchema.allOf !== undefined) {
            anyOneChildren.push(createNodes(anyOneSchema));
          }

          if (anyOneSchema.items !== undefined) {
            anyOneChildren.push(createItems(anyOneSchema));
          }

          if (
            anyOneSchema.type === "string" ||
            anyOneSchema.type === "number" ||
            anyOneSchema.type === "integer" ||
            anyOneSchema.type === "boolean"
          ) {
            anyOneChildren.push(createNodes(anyOneSchema));
          }
          if (anyOneChildren.length) {
            if (schema.type === "array") {
              return create("TabItem", {
                label: label,
                value: `${index}-item-properties`,
                children: [
                  createOpeningArrayBracket(),
                  anyOneChildren,
                  createClosingArrayBracket(),
                ]
                  .filter(Boolean)
                  .flat(),
              });
            }
            return create("TabItem", {
              label: label,
              value: `${index}-item-properties`,
              children: anyOneChildren.filter(Boolean).flat(),
            });
          }

          return undefined;
        }),
      }),
    ],
  });
}

function createProperties(schema: SchemaObject) {
  const discriminator = schema.discriminator;
  return Object.entries(schema.properties!).map(([key, val]) => {
    return createEdges({
      name: key,
      schema: val,
      required: Array.isArray(schema.required)
        ? schema.required.includes(key)
        : false,
      discriminator,
    });
  });
}

function createAdditionalProperties(schema: SchemaObject) {
  // TODO?:
  //   {
  //   description: 'Integration configuration. See \n' +
  //     '[Integration Configurations](https://prisma.pan.dev/api/cloud/api-integration-config/).\n',
  //   example: { webhookUrl: 'https://hooks.slack.com/abcdef' },
  //   externalDocs: { url: 'https://prisma.pan.dev/api/cloud/api-integration-config' },
  //   type: 'object'
  // }

  // TODO?:
  // {
  // items: {
  //     properties: {
  //       aliasField: [Object],
  //       displayName: [Object],
  //       fieldName: [Object],
  //       maxLength: [Object],
  //       options: [Object],
  //       redlockMapping: [Object],
  //       required: [Object],
  //       type: [Object],
  //       typeaheadUri: [Object],
  //       value: [Object]
  //     },
  //     type: 'object'
  //   },
  //   type: 'array'
  // }

  if (
    (schema.additionalProperties?.type as string) === "string" ||
    (schema.additionalProperties?.type as string) === "object" ||
    (schema.additionalProperties?.type as string) === "boolean" ||
    (schema.additionalProperties?.type as string) === "integer" ||
    (schema.additionalProperties?.type as string) === "number"
  ) {
    const type = schema.additionalProperties?.type;
    const additionalProperties =
      schema.additionalProperties?.additionalProperties;
    if (additionalProperties !== undefined) {
      const type = schema.additionalProperties?.additionalProperties?.type;
      const format = schema.additionalProperties?.additionalProperties?.format;
      return create("li", {
        children: create("div", {
          children: [
            create("code", { children: `property name*` }),
            guard(type, (type) =>
              create("span", {
                style: { opacity: "0.6" },
                children: ` ${type}`,
              })
            ),
            guard(format, (format) =>
              create("span", {
                style: { opacity: "0.6" },
                children: ` (${format})`,
              })
            ),
            guard(getQualifierMessage(schema.additionalProperties), (message) =>
              create("div", {
                style: { marginTop: "var(--ifm-table-cell-padding)" },
                children: createDescription(message),
              })
            ),
          ],
        }),
      });
    }
    return create("li", {
      children: create("div", {
        children: [
          create("code", { children: `property name*` }),
          guard(type, (type) =>
            create("span", {
              style: { opacity: "0.6" },
              children: ` ${type}`,
            })
          ),
          guard(getQualifierMessage(schema.additionalProperties), (message) =>
            create("div", {
              style: { marginTop: "var(--ifm-table-cell-padding)" },
              children: createDescription(message),
            })
          ),
        ],
      }),
    });
  }
  return Object.entries(schema.additionalProperties!).map(([key, val]) =>
    createEdges({
      name: key,
      schema: val,
      required: Array.isArray(schema.required)
        ? schema.required.includes(key)
        : false,
    })
  );
}

// TODO: figure out how to handle array of objects
function createItems(schema: SchemaObject) {
  if (schema.items?.properties !== undefined) {
    return [
      createOpeningArrayBracket(),
      createProperties(schema.items),
      createClosingArrayBracket(),
    ].flat();
  }

  if (schema.items?.additionalProperties !== undefined) {
    return [
      createOpeningArrayBracket(),
      createAdditionalProperties(schema.items),
      createClosingArrayBracket(),
    ].flat();
  }

  if (schema.items?.oneOf !== undefined || schema.items?.anyOf !== undefined) {
    return [
      createOpeningArrayBracket(),
      createAnyOneOf(schema.items!),
      createClosingArrayBracket(),
    ].flat();
  }

  if (schema.items?.allOf !== undefined) {
    // TODO: figure out if and how we should pass merged required array
    const {
      mergedSchemas,
    }: { mergedSchemas: SchemaObject; required: string[] } = mergeAllOf(
      schema.items?.allOf
    );

    // Handles combo anyOf/oneOf + properties
    if (
      (mergedSchemas.oneOf !== undefined ||
        mergedSchemas.anyOf !== undefined) &&
      mergedSchemas.properties
    ) {
      return [
        createOpeningArrayBracket(),
        createAnyOneOf(mergedSchemas),
        createProperties(mergedSchemas),
        createClosingArrayBracket(),
      ].flat();
    }

    // Handles only anyOf/oneOf
    if (
      mergedSchemas.oneOf !== undefined ||
      mergedSchemas.anyOf !== undefined
    ) {
      return [
        createOpeningArrayBracket(),
        createAnyOneOf(mergedSchemas),
        createClosingArrayBracket(),
      ].flat();
    }

    // Handles properties
    if (mergedSchemas.properties !== undefined) {
      return [
        createOpeningArrayBracket(),
        createProperties(mergedSchemas),
        createClosingArrayBracket(),
      ].flat();
    }
  }

  if (
    schema.items?.type === "string" ||
    schema.items?.type === "number" ||
    schema.items?.type === "integer" ||
    schema.items?.type === "boolean" ||
    schema.items?.type === "object"
  ) {
    return [
      createOpeningArrayBracket(),
      createNodes(schema.items),
      createClosingArrayBracket(),
    ].flat();
  }

  // TODO: clean this up or eliminate it?
  return [
    createOpeningArrayBracket(),
    Object.entries(schema.items!).map(([key, val]) =>
      createEdges({
        name: key,
        schema: val,
        required: Array.isArray(schema.required)
          ? schema.required.includes(key)
          : false,
      })
    ),
    createClosingArrayBracket(),
  ].flat();
}

/**
 * For handling discriminators that do not map to a same-level property
 */
// function createDiscriminator(schema: SchemaObject) {
//   const discriminator = schema.discriminator;
//   const propertyName = discriminator?.propertyName;
//   const propertyType = "string"; // should always be string
//   const mapping: any = discriminator?.mapping;

//   // Explicit mapping is required since we can't support implicit
//   if (mapping === undefined) {
//     return undefined;
//   }

//   // Attempt to get the property description we want to display
//   // TODO: how to make it predictable when handling allOf
//   let propertyDescription;
//   const firstMappingSchema = mapping[Object.keys(mapping)[0]];
//   if (firstMappingSchema.properties !== undefined) {
//     propertyDescription =
//       firstMappingSchema.properties![propertyName!].description;
//   }
//   if (firstMappingSchema.allOf !== undefined) {
//     const { mergedSchemas }: { mergedSchemas: SchemaObject } = mergeAllOf(
//       firstMappingSchema.allOf
//     );
//     if (mergedSchemas.properties !== undefined) {
//       propertyDescription =
//         mergedSchemas.properties[propertyName!]?.description;
//     }
//   }

//   if (propertyDescription === undefined) {
//     if (
//       schema.properties !== undefined &&
//       schema.properties![propertyName!] !== undefined
//     ) {
//       propertyDescription = schema.properties![propertyName!].description;
//     }
//   }

//   return create("div", {
//     className: "discriminatorItem",
//     children: create("div", {
//       children: [
//         create("strong", {
//           style: { paddingLeft: "1rem" },
//           children: propertyName,
//         }),
//         guard(propertyType, (name) =>
//           create("span", {
//             style: { opacity: "0.6" },
//             children: ` ${propertyType}`,
//           })
//         ),
//         guard(getQualifierMessage(schema.discriminator as any), (message) =>
//           create("div", {
//             style: {
//               paddingLeft: "1rem",
//             },
//             children: createDescription(message),
//           })
//         ),
//         guard(propertyDescription, (description) =>
//           create("div", {
//             style: {
//               paddingLeft: "1rem",
//             },
//             children: createDescription(description),
//           })
//         ),
//         create("DiscriminatorTabs", {
//           children: Object.keys(mapping!).map((key, index) => {
//             if (mapping[key].allOf !== undefined) {
//               const { mergedSchemas }: { mergedSchemas: SchemaObject } =
//                 mergeAllOf(mapping[key].allOf);
//               // Cleanup duplicate property from mapping schema
//               delete mergedSchemas.properties![propertyName!];
//               mapping[key] = mergedSchemas;
//             }

//             if (mapping[key].properties !== undefined) {
//               // Cleanup duplicate property from mapping schema
//               delete mapping[key].properties![propertyName!];
//             }

//             const label = key;
//             return create("TabItem", {
//               label: label,
//               value: `${index}-item-discriminator`,
//               children: [
//                 create("div", {
//                   style: { marginLeft: "-4px" },
//                   children: createNodes(mapping[key]),
//                 }),
//               ],
//             });
//           }),
//         }),
//       ],
//     }),
//   });
// }

function createDetailsNode(
  name: string,
  schemaName: string,
  schema: SchemaObject,
  required: string[] | boolean
): any {
  return create("SchemaItem", {
    collapsible: true,
    className: "schemaItem",
    children: [
      createDetails({
        children: [
          createDetailsSummary({
            children: [
              create("strong", { children: name }),
              create("span", {
                style: { opacity: "0.6" },
                children: ` ${schemaName}`,
              }),
              guard(schema.nullable && schema.nullable === true, () => [
                create("strong", {
                  style: {
                    fontSize: "var(--ifm-code-font-size)",
                    color: "var(--openapi-nullable)",
                  },
                  children: " nullable",
                }),
              ]),
              guard(
                Array.isArray(required)
                  ? required.includes(name)
                  : required === true,
                () => [
                  create("strong", {
                    style: {
                      fontSize: "var(--ifm-code-font-size)",
                      color: "var(--openapi-required)",
                    },
                    children: " required",
                  }),
                ]
              ),
            ],
          }),
          create("div", {
            style: { marginLeft: "1rem" },
            children: [
              guard(getQualifierMessage(schema), (message) =>
                create("div", {
                  style: { marginTop: ".5rem", marginBottom: ".5rem" },
                  children: createDescription(message),
                })
              ),
              guard(schema.description, (description) =>
                create("div", {
                  style: { marginTop: ".5rem", marginBottom: ".5rem" },
                  children: createDescription(description),
                })
              ),
              createNodes(schema),
            ],
          }),
        ],
      }),
    ],
  });
}

/**
 * For handling discriminators that map to a same-level property (like 'petType').
 * Note: These should only be encountered while iterating through properties.
 */
function createPropertyDiscriminator(
  name: string,
  schemaName: string,
  schema: SchemaObject,
  discriminator: any,
  required: string[] | boolean
): any {
  if (schema === undefined) {
    return undefined;
  }

  if (discriminator.mapping === undefined) {
    return undefined;
  }

  return create("div", {
    className: "discriminatorItem",
    children: create("div", {
      children: [
        create("strong", { style: { paddingLeft: "1rem" }, children: name }),
        guard(schemaName, (name) =>
          create("span", {
            style: { opacity: "0.6" },
            children: ` ${schemaName}`,
          })
        ),
        guard(required, () => [
          create("strong", {
            style: {
              fontSize: "var(--ifm-code-font-size)",
              color: "var(--openapi-required)",
            },
            children: " required",
          }),
        ]),
        guard(getQualifierMessage(discriminator), (message) =>
          create("div", {
            style: {
              paddingLeft: "1rem",
            },
            children: createDescription(message),
          })
        ),
        guard(schema.description, (description) =>
          create("div", {
            style: {
              paddingLeft: "1rem",
            },
            children: createDescription(description),
          })
        ),
        create("DiscriminatorTabs", {
          children: Object.keys(discriminator?.mapping!).map((key, index) => {
            const label = key;
            return create("TabItem", {
              label: label,
              value: `${index}-item-discriminator`,
              children: [
                create("div", {
                  style: { marginLeft: "-4px" },
                  children: createNodes(discriminator?.mapping[key]),
                }),
              ],
            });
          }),
        }),
      ],
    }),
  });
}

interface EdgeProps {
  name: string;
  schema: SchemaObject;
  required: string[] | boolean;
  discriminator?: any | unknown;
}

/**
 * Creates the edges or "leaves" of a schema tree. Edges can branch into sub-nodes with createDetails().
 */
function createEdges({
  name,
  schema,
  required,
  discriminator,
}: EdgeProps): any {
  const schemaName = getSchemaName(schema);

  if (discriminator !== undefined && discriminator.propertyName === name) {
    return createPropertyDiscriminator(
      name,
      "string",
      schema,
      discriminator,
      required
    );
  }

  if (schema.oneOf !== undefined || schema.anyOf !== undefined) {
    return createDetailsNode(name, schemaName, schema, required);
  }

  if (schema.allOf !== undefined) {
    const {
      mergedSchemas,
      required,
    }: { mergedSchemas: SchemaObject; required: string[] | boolean } =
      mergeAllOf(schema.allOf);
    const mergedSchemaName = getSchemaName(mergedSchemas);

    if (
      mergedSchemas.oneOf !== undefined ||
      mergedSchemas.anyOf !== undefined
    ) {
      return createDetailsNode(name, mergedSchemaName, mergedSchemas, required);
    }

    if (mergedSchemas.properties !== undefined) {
      return createDetailsNode(name, mergedSchemaName, mergedSchemas, required);
    }

    if (mergedSchemas.additionalProperties !== undefined) {
      return createDetailsNode(name, mergedSchemaName, mergedSchemas, required);
    }

    // array of objects
    if (mergedSchemas.items?.properties !== undefined) {
      return createDetailsNode(name, mergedSchemaName, mergedSchemas, required);
    }

    if (mergedSchemas.readOnly && mergedSchemas.readOnly === true) {
      return undefined;
    }

    return create("SchemaItem", {
      collapsible: false,
      name,
      required: Array.isArray(required) ? required.includes(name) : required,
      schemaName: schemaName,
      qualifierMessage: getQualifierMessage(schema),
      schema: mergedSchemas,
    });
  }

  if (schema.properties !== undefined) {
    return createDetailsNode(name, schemaName, schema, required);
  }

  if (schema.additionalProperties !== undefined) {
    return createDetailsNode(name, schemaName, schema, required);
  }

  // array of objects
  if (schema.items?.properties !== undefined) {
    return createDetailsNode(name, schemaName, schema, required);
  }

  if (schema.items?.anyOf !== undefined || schema.items?.oneOf !== undefined) {
    return createDetailsNode(name, schemaName, schema, required);
  }

  if (schema.readOnly && schema.readOnly === true) {
    return undefined;
  }

  // primitives and array of non-objects
  return create("SchemaItem", {
    collapsible: false,
    name,
    required: Array.isArray(required) ? required.includes(name) : required,
    schemaName: schemaName,
    qualifierMessage: getQualifierMessage(schema),
    schema: schema,
  });
}

/**
 * Creates a hierarchical level of a schema tree. Nodes produce edges that can branch into sub-nodes with edges, recursively.
 */
function createNodes(schema: SchemaObject): any {
  const nodes = [];
  // if (schema.discriminator !== undefined) {
  //   return createDiscriminator(schema);
  // }

  if (schema.oneOf !== undefined || schema.anyOf !== undefined) {
    nodes.push(createAnyOneOf(schema));
  }

  if (schema.allOf !== undefined) {
    const { mergedSchemas } = mergeAllOf(schema.allOf);

    // allOf seems to always result in properties
    if (mergedSchemas.properties !== undefined) {
      nodes.push(createProperties(mergedSchemas));
    }
  }

  if (schema.properties !== undefined) {
    nodes.push(createProperties(schema));
  }

  if (schema.additionalProperties !== undefined) {
    nodes.push(createAdditionalProperties(schema));
  }

  // TODO: figure out how to handle array of objects
  if (schema.items !== undefined) {
    nodes.push(createItems(schema));
  }

  if (nodes.length && nodes.length > 0) {
    return nodes.filter(Boolean).flat();
  }

  // primitive
  if (schema.type !== undefined) {
    return create("li", {
      children: create("div", {
        children: [
          create("strong", { children: schema.type }),
          guard(schema.format, (format) =>
            create("span", {
              style: { opacity: "0.6" },
              children: ` ${format}`,
            })
          ),
          guard(getQualifierMessage(schema), (message) =>
            create("div", {
              style: { marginTop: "var(--ifm-table-cell-padding)" },
              children: createDescription(message),
            })
          ),
          guard(schema.description, (description) =>
            create("div", {
              style: { marginTop: "var(--ifm-table-cell-padding)" },
              children: createDescription(description),
            })
          ),
        ],
      }),
    });
  }

  // Unknown node/schema type should return undefined
  // So far, haven't seen this hit in testing
  return undefined;
}

interface Props {
  style?: any;
  title: string;
  body: {
    content?: {
      [key: string]: MediaTypeObject;
    };
    description?: string;
    required?: string[] | boolean;
  };
}

export function createRequestSchema({ title, body, ...rest }: Props) {
  if (
    body === undefined ||
    body.content === undefined ||
    Object.keys(body).length === 0 ||
    Object.keys(body.content).length === 0
  ) {
    return undefined;
  }

  // Get all MIME types, including vendor-specific
  const mimeTypes = Object.keys(body.content);

  if (mimeTypes && mimeTypes.length > 1) {
    return create("MimeTabs", {
      schemaType: "request",
      children: mimeTypes.map((mimeType) => {
        const firstBody = body.content![mimeType].schema;
        if (firstBody === undefined) {
          return undefined;
        }
        if (firstBody.properties !== undefined) {
          if (Object.keys(firstBody.properties).length === 0) {
            return undefined;
          }
        }
        return create("TabItem", {
          label: mimeType,
          value: `${mimeType}`,
          children: [
            createDetails({
              "data-collapsed": false,
              open: true,
              ...rest,
              children: [
                createDetailsSummary({
                  style: { textAlign: "left" },
                  children: [
                    create("strong", { children: `${title}` }),
                    guard(body.required && body.required === true, () => [
                      create("strong", {
                        style: {
                          fontSize: "var(--ifm-code-font-size)",
                          color: "var(--openapi-required)",
                        },
                        children: " required",
                      }),
                    ]),
                  ],
                }),
                create("div", {
                  style: { textAlign: "left", marginLeft: "1rem" },
                  children: [
                    guard(body.description, () => [
                      create("div", {
                        style: { marginTop: "1rem", marginBottom: "1rem" },
                        children: createDescription(body.description),
                      }),
                    ]),
                  ],
                }),
                create("ul", {
                  style: { marginLeft: "1rem" },
                  children: createNodes(firstBody),
                }),
              ],
            }),
          ],
        });
      }),
    });
  }

  const randomFirstKey = Object.keys(body.content)[0];
  const firstBody = body.content[randomFirstKey].schema;

  if (firstBody === undefined) {
    return undefined;
  }

  // we don't show the table if there is no properties to show
  if (firstBody.properties !== undefined) {
    if (Object.keys(firstBody.properties).length === 0) {
      return undefined;
    }
  }
  return create("MimeTabs", {
    children: [
      create("TabItem", {
        label: randomFirstKey,
        value: `${randomFirstKey}-schema`,
        children: [
          createDetails({
            "data-collapsed": false,
            open: true,
            ...rest,
            children: [
              createDetailsSummary({
                style: { textAlign: "left" },
                children: [
                  create("strong", { children: `${title}` }),
                  guard(firstBody.type === "array", (format) =>
                    create("span", {
                      style: { opacity: "0.6" },
                      children: ` array`,
                    })
                  ),
                  guard(body.required, () => [
                    create("strong", {
                      style: {
                        fontSize: "var(--ifm-code-font-size)",
                        color: "var(--openapi-required)",
                      },
                      children: " required",
                    }),
                  ]),
                ],
              }),
              create("div", {
                style: { textAlign: "left", marginLeft: "1rem" },
                children: [
                  guard(body.description, () => [
                    create("div", {
                      style: { marginTop: "1rem", marginBottom: "1rem" },
                      children: createDescription(body.description),
                    }),
                  ]),
                ],
              }),
              create("ul", {
                style: { marginLeft: "1rem" },
                children: createNodes(firstBody),
              }),
            ],
          }),
        ],
      }),
    ],
  });
}
