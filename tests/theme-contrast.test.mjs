import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("src/style.css", "utf8");
const tokens = (selector) => {
  const start = css.indexOf(selector);
  assert.ok(start >= 0, `Theme selector exists: ${selector}`);
  const block = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[\da-f]{3,6})/gi)]
    .map(([, name, value]) => [name, value]));
};
const light = tokens(":root {"), dark = tokens(':root[data-theme="dark"] {');
const systemDark = tokens(':root:not([data-theme="light"]):not([data-theme="dark"])');
const luminance = (hex) => {
  let digits = hex.slice(1);
  if (digits.length === 3) digits = [...digits].map((d) => d + d).join("");
  const rgb = digits.match(/../g).map((c) => {
    const value = parseInt(c, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
};
const ratio = (a, b) => {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
for (const [name, overrides] of [["light", {}], ["dark", dark], ["system dark", systemDark]]) {
  test(`${name}: normal text and control colors meet WCAG AA contrast`, () => {
    const theme = { ...light, ...overrides };
    for (const [fg, bg] of [["ink", "panel"], ["ink", "bg"], ["muted", "panel"], ["muted", "bg"], ["accent", "soft"], ["on-accent", "accent"], ["danger", "danger-soft"], ["warning", "warning-soft"]]) {
      const contrast = ratio(theme[fg], theme[bg]);
      assert.ok(contrast >= 4.5, `${fg}/${bg}: ${contrast.toFixed(2)} must reach 4.5`);
    }
    for (const surface of ["bg", "panel"]) {
      assert.ok(ratio(theme["control-line"], theme[surface]) >= 3, `Form boundary visible on ${surface}`);
    }
    for (const surface of ["bg", "panel", "soft", "sidebar"]) {
      assert.ok(ratio(theme.gold, theme[surface]) >= 3, `Focus ring visible on ${surface}`);
    }
  });
}
test("system dark uses the same color tokens as explicit dark", () => {
  assert.deepEqual(systemDark, dark);
});
