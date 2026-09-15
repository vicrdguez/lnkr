/** A SQL boolean fragment over the `bookmarks` alias `b`, with its positional parameters in order. */
export type SearchFilter = { where: string; params: string[] };

export const MATCH_ALL: SearchFilter = { where: "1 = 1", params: [] };

/** Durable Object SQLite binds at most one hundred parameters; the list query needs a few of its own. */
const PARAM_BUDGET = 90;

const TEXT_COLUMNS = ["title", "description", "notes", "url"];

type Leaf = { kind: "term" | "tag" | "keyword"; text: string };
type Token = Leaf | { kind: "and" | "or" | "not" | "(" | ")" };
type Node = Leaf | { kind: "not"; operand: Node } | { kind: "and" | "or"; left: Node; right: Node };

class ParseError extends Error {}

/**
 * linkding's query grammar compiled to SQL: terms and quoted phrases match substrings of title, description,
 * notes and url regardless of ASCII case; `#name` matches a tag; `!unread` and `!untagged` filter flags and any
 * other `!keyword` matches everything; `and`, `or`, `not` and parentheses combine them and adjacency means `and`.
 * Null when `q` does not parse or needs too many parameters; an empty `q` matches everything.
 */
export function compileSearch(q: string): SearchFilter | null {
  try {
    const tokens = tokenize(q);
    if (tokens.length === 0) return MATCH_ALL;
    const params: string[] = [];
    const where = compile(parse(tokens), params);
    // ponytail: 90-parameter budget; split the query or index with FTS5 if real queries hit it
    return params.length > PARAM_BUDGET ? null : { where, params };
  } catch (error) {
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
  const startsOperand = () => ["not", "(", "term", "tag", "keyword"].includes(peek() ?? "");
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

function compile(node: Node, params: string[]): string {
  switch (node.kind) {
    case "term":
      // SQLite's lower() folds ASCII only, so the bound text is folded the same way.
      params.push(...TEXT_COLUMNS.map(() => node.text.replace(/[A-Z]+/g, (upper) => upper.toLowerCase())));
      return `(${TEXT_COLUMNS.map((column) => `instr(lower(b.${column}), ?) > 0`).join(" OR ")})`;
    case "tag":
      params.push(node.text);
      return "EXISTS (SELECT 1 FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id WHERE bt.bookmark_id = b.id AND t.name = ? COLLATE NOCASE)";
    case "keyword":
      if (node.text === "unread") return "b.unread = 1";
      if (node.text === "untagged") return "NOT EXISTS (SELECT 1 FROM bookmark_tags bt WHERE bt.bookmark_id = b.id)";
      return "1 = 1";
    case "not":
      return `NOT (${compile(node.operand, params)})`;
    default:
      return `(${compile(node.left, params)} ${node.kind.toUpperCase()} ${compile(node.right, params)})`;
  }
}
