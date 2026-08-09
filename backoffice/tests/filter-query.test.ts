import { describe, expect, it } from "vitest";

import { parseFilterQuery, textRowFilter } from "../client/filter-query.js";

describe("parseFilterQuery", () => {
  it("parses each modifier at the edges", () => {
    expect(parseFilterQuery("abc")).toEqual({ mode: "contains", term: "abc" });
    expect(parseFilterQuery("!abc")).toEqual({
      mode: "not-contains",
      term: "abc",
    });
    expect(parseFilterQuery("^abc")).toEqual({
      mode: "starts-with",
      term: "abc",
    });
    expect(parseFilterQuery("abc$")).toEqual({
      mode: "ends-with",
      term: "abc",
    });
    expect(parseFilterQuery("^abc$")).toEqual({ mode: "equals", term: "abc" });
  });

  it("trims surrounding whitespace before parsing", () => {
    expect(parseFilterQuery("  ^abc  ")).toEqual({
      mode: "starts-with",
      term: "abc",
    });
  });

  it("keeps everything after ! literal — no anchors inside a negation", () => {
    expect(parseFilterQuery("!^abc")).toEqual({
      mode: "not-contains",
      term: "^abc",
    });
    expect(parseFilterQuery("!abc$")).toEqual({
      mode: "not-contains",
      term: "abc$",
    });
  });

  it("escapes leading ! and ^ and a trailing $ with a backslash", () => {
    expect(parseFilterQuery("\\!abc")).toEqual({
      mode: "contains",
      term: "!abc",
    });
    expect(parseFilterQuery("\\^abc")).toEqual({
      mode: "contains",
      term: "^abc",
    });
    expect(parseFilterQuery("abc\\$")).toEqual({
      mode: "contains",
      term: "abc$",
    });
    // Escapes compose with the opposite edge's modifier.
    expect(parseFilterQuery("^abc\\$")).toEqual({
      mode: "starts-with",
      term: "abc$",
    });
    expect(parseFilterQuery("\\^abc$")).toEqual({
      mode: "ends-with",
      term: "^abc",
    });
  });

  it("treats modifiers away from the edges as literal text", () => {
    expect(parseFilterQuery("a!b")).toEqual({ mode: "contains", term: "a!b" });
    expect(parseFilterQuery("a$b")).toEqual({ mode: "contains", term: "a$b" });
    expect(parseFilterQuery("a^b")).toEqual({ mode: "contains", term: "a^b" });
    expect(parseFilterQuery("\\")).toEqual({ mode: "contains", term: "\\" });
  });

  it("returns null when the query reduces to an empty term", () => {
    expect(parseFilterQuery("")).toBeNull();
    expect(parseFilterQuery("   ")).toBeNull();
    expect(parseFilterQuery("!")).toBeNull();
    expect(parseFilterQuery("^")).toBeNull();
    expect(parseFilterQuery("$")).toBeNull();
    expect(parseFilterQuery("^$")).toBeNull();
  });
});

describe("textRowFilter", () => {
  it("maps each mode onto its server operator", () => {
    expect(textRowFilter("name", "abc")).toEqual({
      column: "name",
      op: "contains",
      value: "abc",
    });
    expect(textRowFilter("name", "!abc")).toEqual({
      column: "name",
      op: "not-contains",
      value: "abc",
    });
    expect(textRowFilter("name", "^abc")).toEqual({
      column: "name",
      op: "starts-with",
      value: "abc",
    });
    expect(textRowFilter("name", "abc$")).toEqual({
      column: "name",
      op: "ends-with",
      value: "abc",
    });
    expect(textRowFilter("name", "^abc$")).toEqual({
      column: "name",
      op: "ieq",
      value: "abc",
    });
  });

  it("returns null for queries that filter nothing", () => {
    expect(textRowFilter("name", "")).toBeNull();
    expect(textRowFilter("name", "!")).toBeNull();
  });
});
