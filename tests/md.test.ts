import { describe, expect, it } from "vitest";
import { renderMarkdown, stripMarkdown } from "../web/md.js";

describe("renderMarkdown", () => {
  it("escapes HTML so model output can never inject markup", () => {
    const html = renderMarkdown('<script>alert(1)</script> <img src=x onerror="alert(2)"> **ok**');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<strong>ok</strong>");
  });
  it("does not turn markdown links into anchors (no javascript: URLs)", () => {
    const html = renderMarkdown("[click](javascript:alert(1))");
    expect(html).not.toContain("<a");
    expect(html).not.toContain("href");
  });
  it("renders headings, lists, and code", () => {
    const html = renderMarkdown("## Title\n\n- one\n- two\n\n1. a\n2. b\n\nUse `code` here.");
    expect(html).toContain("<h4>Title</h4>");
    expect(html).toContain("<ul><li>one</li><li>two</li></ul>");
    expect(html).toContain("<ol><li>a</li><li>b</li></ol>");
    expect(html).toContain("<code>code</code>");
  });
  it("renders tables", () => {
    const html = renderMarkdown("| Airport | Score |\n|---|---|\n| BOS | 72.2 |\n| PWM | 65.1 |");
    expect(html).toContain("<table>");
    expect(html).toContain("<th>Airport</th>");
    expect(html).toContain("<td>72.2</td>");
  });
  it("keeps fenced code literal and survives an unterminated fence", () => {
    expect(renderMarkdown("```\n**not bold** <b>\n```")).toContain("**not bold** &lt;b&gt;");
    expect(() => renderMarkdown("```\nnever closed")).not.toThrow();
  });
  it("handles empty and partial streaming input without hanging", () => {
    expect(renderMarkdown("")).toBe("");
    expect(renderMarkdown("| a | b |")).toContain("<p>");
    expect(renderMarkdown("**unfinished")).toContain("**unfinished");
  });
  it("does not mistake multiplication or list asterisks for emphasis", () => {
    expect(renderMarkdown("3 * 4 * 5")).not.toContain("<em>");
  });
});

describe("stripMarkdown (for speech)", () => {
  it("removes markup so it reads naturally", () => {
    expect(stripMarkdown("## Answer\n\n**BOS** leads.\n\n- point `x`")).toBe("Answer BOS leads. point x");
  });
});
