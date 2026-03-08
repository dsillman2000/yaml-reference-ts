import { YAMLMap, YAMLSeq } from "yaml";
import type { ToJSContext } from "yaml/dist/util";
import { Tags } from "yaml";

/**
 * Symbol flag used to mark JS values produced from !ignore nodes.
 */
export const IGNORE_NODE_FLAG = Symbol("isIgnore");

export const isResolvedIgnoreNode = (value: unknown): value is object => {
  return (
    typeof value === "object" && value !== null && IGNORE_NODE_FLAG in value
  );
};

/**
 * YAML node class for mapping nodes tagged with !ignore
 */
export class IgnoreMapNode extends YAMLMap {
  tag = "!ignore";
  toJSON(_: unknown, ctx: ToJSContext) {
    const value = super.toJSON(_, { ...ctx }) as Record<string, unknown>;
    Object.assign(value, { [IGNORE_NODE_FLAG]: true });
    return value;
  }
}

/**
 * YAML node class for sequence nodes tagged with !ignore
 */
export class IgnoreSeqNode extends YAMLSeq {
  tag = "!ignore";
  toJSON(_: unknown, ctx: ToJSContext) {
    const value = super.toJSON(_, { ...ctx });
    Object.assign(value, { [IGNORE_NODE_FLAG]: true });
    return value;
  }
}

/**
 * When !ignore is used on a scalar, we return an object wrapper marked with
 * the flag so the JS-layer postprocessing can recognize and erase/nullify it.
 */
function resolveScalarIgnore(value: unknown) {
  return { [IGNORE_NODE_FLAG]: true, __value: value } as Record<
    string,
    unknown
  >;
}

/**
 * Exported Tags for registering with the YAML parser
 */
const ignoreMapTag = {
  identify: (value: unknown) => value instanceof IgnoreMapNode,
  tag: "!ignore",
  collection: "map" as const,
  nodeClass: IgnoreMapNode,
};

const ignoreSeqTag = {
  identify: (value: unknown) => value instanceof IgnoreSeqNode,
  tag: "!ignore",
  collection: "seq" as const,
  nodeClass: IgnoreSeqNode,
};

const ignoreScalarTag = {
  tag: "!ignore",
  resolve: (_: unknown) => resolveScalarIgnore(_),
};

export const IgnoreTags: Tags = [ignoreMapTag, ignoreSeqTag, ignoreScalarTag];
