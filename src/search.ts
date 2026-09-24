/** A SQL boolean fragment over the `bookmarks` alias `b`, with its positional parameters in order. */
export type SearchFilter = { where: string; params: string[] };

export const MATCH_ALL: SearchFilter = { where: "1 = 1", params: [] };
/** What a `q` that does not parse selects: nothing, as in linkding. */
export const MATCH_NONE: SearchFilter = { where: "0 = 1", params: [] };

/** Durable Object SQLite binds at most one hundred parameters; the list query needs a few of its own. */
const PARAM_BUDGET = 90;

const TEXT_COLUMNS = ["title", "description", "notes", "url"];

type Leaf = { kind: "term" | "tag" | "keyword"; text: string };
type Token = Leaf | { kind: "and" | "or" | "not" | "(" | ")" };
type Node = Leaf | { kind: "not"; operand: Node } | { kind: "and" | "or"; left: Node; right: Node };

/** Token kinds that begin an operand; a following one without an operator between is implicit `and`. */
const OPERAND_START: string[] = ["not", "(", "term", "tag", "keyword"] satisfies Token["kind"][];

class ParseError extends Error {}

/**
 * linkding's query grammar compiled to SQL: terms and quoted phrases match substrings of title, description,
 * notes and url regardless of ASCII case; `#name` matches a tag; `!unread` and `!untagged` filter flags and any
 * other `!keyword` matches everything; `and`, `or`, `not` and parentheses combine them and adjacency means `and`.
 * With `laxTags` a term also matches a tag named exactly the term regardless of case.
 * Null when `q` does not parse or needs too many parameters; an empty `q` matches everything.
 */
export function compileSearch(q: string, { laxTags = false }: { laxTags?: boolean } = {}): SearchFilter | null {
  try {
    const tokens = tokenize(q);
    if (tokens.length === 0) return MATCH_ALL;
    const params: string[] = [];
    const where = compile(parse(tokens), params, laxTags);
    // ponytail: 90-parameter budget; split the query or index with FTS5 if real queries hit it
    return params.length > PARAM_BUDGET ? null : { where, params };
  } catch (error) {
    // DEBT(#25/W1): thousands of nested parentheses or `not`s overflow the recursive parser; the RangeError escapes as a 500.
    if (error instanceof ParseError) return null;
    throw error;
  }
}

function tokenize(q: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const readUntil = (stop: RegExp): string => {
    const start = i;
    while (i < q.length && !stop.test(q[i])) i++;
    return q.slice(start, i);
  };
  /** The text between `quote` and its next unescaped twin, with `\` taking the next character literally. */
  const readPhrase = (quote: string): string => {
    let text = "";
    for (i++; q[i] !== quote; i++) {
      if (i >= q.length) throw new ParseError("unterminated phrase");
      if (q[i] === "\\") i++;
      text += q[i] ?? "";
    }
    i++;
    return text;
  };
  while (i < q.length) {
    const c = q[i];
    if (/\s/.test(c)) i++;
    else if (c === "(" || c === ")") {
      tokens.push({ kind: c });
      i++;
    } else if (c === '"' || c === "'") tokens.push({ kind: "term", text: readPhrase(c) });
    else if (c === "#" || c === "!") {
      i++;
      const text = readUntil(/[\s()]/);
      if (!text) throw new ParseError(`empty ${c}`);
      tokens.push({ kind: c === "#" ? "tag" : "keyword", text });
    } else {
      const text = readUntil(/[\s()"'#!]/);
      const operator = text.toLowerCase();
      tokens.push(operator === "and" || operator === "or" || operator === "not" ? { kind: operator } : { kind: "term", text });
    }
  }
  return tokens;
}

/** expr := and (OR and)*; and := not (AND? not)*; not := NOT not | primary; primary := ( expr ) | leaf */
function parse(tokens: Token[]): Node {
  let i = 0;
  const peek = () => tokens[i]?.kind;
  const startsOperand = () => OPERAND_START.includes(peek() ?? "");
  const expr = (): Node => {
    let left = andExpr();
    while (peek() === "or") {
      i++;
      left = { kind: "or", left, right: andExpr() };
    }
    return left;
  };
  const andExpr = (): Node => {
    let left = notExpr();
    for (;;) {
      if (peek() === "and") i++;
      else if (!startsOperand()) return left;
      left = { kind: "and", left, right: notExpr() };
    }
  };
  const notExpr = (): Node => {
    if (peek() !== "not") return primary();
    i++;
    return { kind: "not", operand: notExpr() };
  };
  const primary = (): Node => {
    const token = tokens[i++];
    if (token !== undefined && "text" in token) return token;
    if (token?.kind !== "(") throw new ParseError(`unexpected ${token?.kind ?? "end of query"}`);
    const inner = expr();
    if (tokens[i++]?.kind !== ")") throw new ParseError("expected )");
    return inner;
  };
  const root = expr();
  if (i < tokens.length) throw new ParseError(`unexpected ${tokens[i].kind}`);
  return root;
}

const HAS_TAG =
  "EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id WHERE bt.bookmark_id = b.id AND t.name = ? COLLATE NOCASE)";

function compile(node: Node, params: string[], laxTags: boolean): string {
  switch (node.kind) {
    case "term": {
      // SQLite's lower() folds ASCII only, so the bound text is folded the same way.
      const folded = node.text.replace(/[A-Z]+/g, (upper) => upper.toLowerCase());
      params.push(...TEXT_COLUMNS.map(() => folded));
      const clauses = TEXT_COLUMNS.map((column) => `instr(lower(b.${column}), ?) > 0`);
      if (laxTags) {
        params.push(node.text);
        clauses.push(HAS_TAG);
      }
      return `(${clauses.join(" OR ")})`;
    }
    case "tag":
      params.push(node.text);
      return HAS_TAG;
    case "keyword":
      if (node.text === "unread") return "b.unread = 1";
      if (node.text === "untagged") return "NOT EXISTS (SELECT 1 FROM bookmark_tags bt WHERE bt.bookmark_id = b.id)";
      return "1 = 1";
    case "not":
      return `NOT (${compile(node.operand, params, laxTags)})`;
    default:
      return `(${compile(node.left, params, laxTags)} ${node.kind.toUpperCase()} ${compile(node.right, params, laxTags)})`;
  }
}
