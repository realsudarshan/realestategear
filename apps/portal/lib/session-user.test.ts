import { describe, expect, it } from "vitest";
import { displayNameFor, type SessionUser } from "./session-user";

function user(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: "u1",
    email: "jane.doe@example.com",
    firstName: null,
    lastName: null,
    role: "USER",
    accountId: "a1",
    portalId: "p1",
    avatarUrl: null,
    ...overrides,
  };
}

describe("displayNameFor", () => {
  it("returns 'there' for null (logged-out / unknown)", () => {
    expect(displayNameFor(null)).toBe("there");
  });

  it("returns 'First Last' when both are set", () => {
    expect(displayNameFor(user({ firstName: "Jane", lastName: "Doe" }))).toBe("Jane Doe");
  });

  it("returns just the first name when last name is missing", () => {
    expect(displayNameFor(user({ firstName: "Jane", lastName: null }))).toBe("Jane");
  });

  it("falls back to the email local-part when neither name is set", () => {
    expect(displayNameFor(user({ email: "jane.doe@example.com" }))).toBe("jane.doe");
  });
});
