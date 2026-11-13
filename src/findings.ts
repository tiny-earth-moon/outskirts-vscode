import { FolderAlias, parseLocation, SourcePosition } from "./location";
import { ScanResult } from "./results";

export interface Finding extends SourcePosition {
  message: string;
  kind: string;
  name: string;
  code?: string;
}

export function toFindings(results: ScanResult[], folder: string, aliases: readonly FolderAlias[] = []): Finding[] {
  return results.flatMap((result) => {
    const position = parseLocation(result.location, folder, aliases);
    if (result.hints.length === 0) {
      return [{ ...position, kind: kindName(result.kind), name: result.name, message: `${kindName(result.kind)} '${result.name}'` }];
    }
    return result.hints.map((hint) => ({
      ...position,
      kind: kindName(result.kind),
      name: result.name,
      code: hintName(hint),
      message: describe(result, hint),
    }));
  });
}

function hintName(hint: string): string {
  const parenthesis = hint.indexOf("(");
  return parenthesis === -1 ? hint : hint.slice(0, parenthesis);
}

const kindNames: Record<string, string> = {
  module: "imported module",
  enumelement: "enum case",
  "function.constructor": "initializer",
  "var.parameter": "parameter",
  generic_type_param: "generic type parameter",
  precedencegroup: "precedence group",
  localized_string: "localized string",
  metal_function: "Metal function",
};

export function kindName(kind: string): string {
  const [base] = kind.split(".");
  return kindNames[kind] ?? (base === "var" ? "property" : base);
}

function describe(result: ScanResult, hint: string): string {
  const kind = kindName(result.kind);
  const name = `'${result.name}'`;
  switch (hintName(hint)) {
    case "unused":
      return `Unused ${kind} ${name}`;
    case "assignOnlyProperty":
      return `Assign-only ${kind} ${name} is assigned, but never used`;
    case "unassignedOptionalProperty":
      return `Optional ${kind} ${name} is never assigned (always nil)`;
    case "redundantProtocol":
      return `Redundant protocol ${name} (never used as an existential type)`;
    case "redundantPublicAccessibility":
      return `Redundant public accessibility for ${kind} ${name}`;
    case "redundantOpenAccessibility":
      return `${kind} ${name} is open but never subclassed or overridden outside its module`;
    case "missingFinal":
      return `${kind} ${name} could be final`;
    case "redundantAccessLevel":
      return `Redundant access level for ${kind} ${name}`;
    case "emptyExtension":
      return `Empty extension of ${name}`;
    case "superfluousIgnoreCommand":
      return `Superfluous ignore comment for ${kind} ${name}`;
    default:
      return `${hint}: ${kind} ${name}`;
  }
}
