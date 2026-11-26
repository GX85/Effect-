/**
 * A small syntax highlighter for the studio's code view: HTML with embedded CSS and JS.
 * Returns escaped HTML with <span class="hl-*"> tokens. Linear time, no dependencies.
 */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const span = (cls: string, s: string) => (s ? `<span class="hl-${cls}">${esc(s)}</span>` : '');

const JS_KW =
  /^(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|import|export|from|async|await|try|catch|finally|throw|typeof|instanceof|in|of|this|null|undefined|true|false|default|yield|delete|void|static|get|set)$/;

function js(code: string): string {
  let out = '';
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:\\[\s\S]|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|([\s\S])/g;
  let m: RegExpExecArray | null;
  let plain = '';
  const flush = () => {
    out += esc(plain);
    plain = '';
  };
  while ((m = re.exec(code))) {
    const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'n' : m[4] ? (JS_KW.test(m[4]) ? 'k' : code[re.lastIndex] === '(' ? 'f' : '') : '';
    if (cls) {
      flush();
      out += span(cls, m[0]);
    } else plain += m[0];
  }
  flush();
  return out;
}

function css(code: string): string {
  let out = '';
  const re = /(\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")|(#[0-9a-fA-F]{3,8}\b|-?\d*\.?\d+(?:px|rem|em|vh|vw|%|s|ms|deg|fr)?\b)|(--[\w-]+|[a-z-]+(?=\s*:))|([{};:,()])|([^{};:,()'"/#\d-]+|[\s\S])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    if (m[1]) out += span('c', m[1]);
    else if (m[2]) out += span('s', m[2]);
    else if (m[3]) out += span('n', m[3]);
    else if (m[4]) out += span('p', m[4]);
    else if (m[5]) out += esc(m[5]);
    else out += esc(m[6]);
  }
  return out;
}

function tag(t: string): string {
  // <name attr="v">
  const m = t.match(/^(<\/?)([\w:-]+)([\s\S]*?)(\/?>)$/);
  if (!m) return esc(t);
  const attrs = m[3].replace(/([\w:@.-]+)(\s*=\s*)?("[^"]*"|'[^']*'|[^\s"'>]+)?|([\s\S])/g, (all, name, eq, val, other) =>
    other !== undefined ? esc(other) : span('a', name) + (eq ? esc(eq) : '') + (val ? span('s', val) : ''),
  );
  return span('t', m[1] + m[2]) + attrs + span('t', m[4]);
}

/** Highlights an HTML document. `max` caps the highlighted part; the rest is escaped as is. */
export function highlightHtml(src: string, max = 400_000): string {
  const head = src.length > max ? src.slice(0, max) : src;
  let out = '';
  const re = /(<!--[\s\S]*?-->)|(<!doctype[^>]*>)|(<script\b[^>]*>)([\s\S]*?)(<\/script>)|(<style\b[^>]*>)([\s\S]*?)(<\/style>)|(<\/?[\w:-]+(?:\s(?:[^>"']|"[^"]*"|'[^']*')*)?\/?>)|([^<]+|<)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(head))) {
    if (m[1]) out += span('c', m[1]);
    else if (m[2]) out += span('t', m[2]);
    else if (m[3]) out += tag(m[3]) + js(m[4]) + tag(m[5]);
    else if (m[6]) out += tag(m[6]) + css(m[7]) + tag(m[8]);
    else if (m[9]) out += tag(m[9]);
    else out += esc(m[10]);
  }
  return out + (src.length > max ? esc(src.slice(max)) : '');
}
