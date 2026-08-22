import { describe, expect, it } from "vitest";

import { escapeCsvField, formatCsvField, serializeCsv } from "@/lib/admin/csv";

describe("escapeCsvField", () => {
  it("flags fields containing a comma", () => {
    expect(escapeCsvField("a,b")).toBe(true);
  });

  it("flags fields containing a quote", () => {
    expect(escapeCsvField('say "hi"')).toBe(true);
  });

  it("flags fields containing a newline", () => {
    expect(escapeCsvField("line1\nline2")).toBe(true);
  });

  it("flags fields containing a carriage return", () => {
    expect(escapeCsvField("line1\rline2")).toBe(true);
  });

  it("does not flag a plain field", () => {
    expect(escapeCsvField("Jane Doe")).toBe(false);
  });

  it("does not flag an empty field", () => {
    expect(escapeCsvField("")).toBe(false);
  });
});

describe("formatCsvField", () => {
  it("leaves a plain field unquoted", () => {
    expect(formatCsvField("Jane Doe")).toBe("Jane Doe");
  });

  it("quotes a field containing a comma", () => {
    expect(formatCsvField("Doe, Jane")).toBe('"Doe, Jane"');
  });

  it("quotes and doubles embedded quotes", () => {
    expect(formatCsvField('She said "hi"')).toBe('"She said ""hi"""');
  });

  it("quotes a field containing a newline", () => {
    expect(formatCsvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("leaves an empty field as an empty string", () => {
    expect(formatCsvField("")).toBe("");
  });
});

describe("serializeCsv", () => {
  it("produces a header row followed by data rows, CRLF-joined", () => {
    const csv = serializeCsv(
      ["Name", "Email"],
      [
        ["Jane Doe", "jane@example.com"],
        ["Bo Smith", "bo@example.com"],
      ],
    );
    expect(csv).toBe("Name,Email\r\nJane Doe,jane@example.com\r\nBo Smith,bo@example.com");
  });

  it("escapes commas, quotes, and newlines across the whole row", () => {
    const csv = serializeCsv(["Name", "Note"], [["Doe, Jane", 'Said "hi"\nTwice']]);
    expect(csv).toBe('Name,Note\r\n"Doe, Jane","Said ""hi""\nTwice"');
  });

  it("handles an empty rows array (header only)", () => {
    expect(serializeCsv(["Name", "Email"], [])).toBe("Name,Email");
  });

  it("handles empty field values", () => {
    expect(serializeCsv(["Name", "Note"], [["Jane", ""]])).toBe("Name,Note\r\nJane,");
  });
});
