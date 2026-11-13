export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let started = false;
  let quote: string | undefined;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quote !== undefined) {
      if (char === quote) {
        quote = undefined;
      } else if (char === "\\" && quote === '"' && (text[index + 1] === '"' || text[index + 1] === "\\")) {
        current += text[++index];
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (char === "\\" && index + 1 < text.length) {
      current += text[++index];
      started = true;
    } else if (/\s/.test(char)) {
      if (started) {
        tokens.push(current);
      }
      current = "";
      started = false;
    } else {
      current += char;
      started = true;
    }
  }
  if (quote !== undefined) {
    throw new Error(`Unclosed ${quote} quote in the arguments.`);
  }
  if (started) {
    tokens.push(current);
  }
  return tokens;
}

export function joinArguments(args: readonly string[]): string {
  return args.map((arg) => (arg === "" || /[\s"'\\]/.test(arg) ? `'${arg.replace(/'/g, "'\"'\"'")}'` : arg)).join(" ");
}
