import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  _resetVentureCache,
  canAccessVenture,
  isAdmin,
  loadVentures,
  venturesForUser,
} from "@/lib/ventures";

const JOHN = "john.gallagher@wealthcx.com"; // arca founder AND Bruntsfield admin
const ROSS = "ross@thereset.com"; // the-reset founder only
const STRANGER = "nobody@example.org"; // not in any manifest

describe("venture scoping (FB-005)", () => {
  beforeEach(() => {
    process.env.BRUNTSFIELD_ADMIN_EMAILS = JOHN;
    _resetVentureCache();
  });
  afterEach(() => {
    _resetVentureCache();
  });

  it("loads the real manifests and excludes the example template", () => {
    const ids = loadVentures().map((v) => v.id);
    expect(ids).toContain("the-reset");
    expect(ids).toContain("arca");
    expect(ids).not.toContain("example-venture");
  });

  it("John (admin) sees every venture", () => {
    expect(isAdmin(JOHN)).toBe(true);
    const ids = venturesForUser(JOHN).map((v) => v.id).sort();
    expect(ids).toEqual(["arca", "the-reset"]);
  });

  it("a founder sees only their own venture", () => {
    expect(isAdmin(ROSS)).toBe(false);
    const ids = venturesForUser(ROSS).map((v) => v.id);
    expect(ids).toEqual(["the-reset"]);
    expect(canAccessVenture(ROSS, "the-reset")).toBe(true);
    expect(canAccessVenture(ROSS, "arca")).toBe(false);
  });

  it("an unlisted account sees nothing", () => {
    expect(venturesForUser(STRANGER)).toEqual([]);
    expect(canAccessVenture(STRANGER, "arca")).toBe(false);
    expect(venturesForUser(null)).toEqual([]);
  });

  it("email matching is case-insensitive", () => {
    expect(venturesForUser("ROSS@TheReset.com").map((v) => v.id)).toEqual(["the-reset"]);
  });
});
