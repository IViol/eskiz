import { describe, expect, it } from "vitest";
import { computeHash, computeObjectHash } from "../hash.js";

describe("hash utilities", () => {
  describe("computeHash", () => {
    it("computes SHA-256 hash of a string", () => {
      const hash = computeHash("test string");
      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
      expect(hash.length).toBe(64); // SHA-256 hex is 64 characters
    });

    it("produces consistent hashes for same input", () => {
      const hash1 = computeHash("test string");
      const hash2 = computeHash("test string");
      expect(hash1).toBe(hash2);
    });

    it("produces different hashes for different inputs", () => {
      const hash1 = computeHash("test string 1");
      const hash2 = computeHash("test string 2");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("computeObjectHash", () => {
    it("computes hash of a JSON object", () => {
      const obj = { a: 1, b: "test" };
      const hash = computeObjectHash(obj);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
      expect(hash.length).toBe(64);
    });

    it("produces consistent hashes for same object", () => {
      const obj = { a: 1, b: "test" };
      const hash1 = computeObjectHash(obj);
      const hash2 = computeObjectHash(obj);
      expect(hash1).toBe(hash2);
    });

    it("produces same hash regardless of key order", () => {
      const obj1 = { a: 1, b: "test" };
      const obj2 = { b: "test", a: 1 };
      const hash1 = computeObjectHash(obj1);
      const hash2 = computeObjectHash(obj2);
      // Note: JSON.stringify may preserve order, so this test verifies current behavior
      expect(hash1).toBe(hash2);
    });
  });
});
