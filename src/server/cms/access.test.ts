import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSiteLogin,
  acceptsSitePassword,
  siteRoleAllows,
} from "./access";

test("site account login is canonical and excludes ambiguous or unsafe characters", () => {
  assert.equal(normalizeSiteLogin("  ADMIN.Site-1  "), "admin.site-1");
  assert.equal(normalizeSiteLogin("admin@example.org"), null);
  assert.equal(normalizeSiteLogin("аdmin"), null);
  assert.equal(normalizeSiteLogin("a".repeat(65)), null);
});

test("site account passwords fit bcrypt safely", () => {
  assert.equal(acceptsSitePassword("a".repeat(14)), true);
  assert.equal(acceptsSitePassword("a".repeat(13)), false);
  assert.equal(acceptsSitePassword("а".repeat(37)), false);
  assert.equal(acceptsSitePassword("a".repeat(72)), true);
  assert.equal(acceptsSitePassword("a".repeat(15) + "\r"), false);
});

test("site editors can edit but only admins can publish and manage staff", () => {
  assert.equal(siteRoleAllows("editor", false), true);
  assert.equal(siteRoleAllows("editor", true), false);
  assert.equal(siteRoleAllows("admin", true), true);
  assert.equal(siteRoleAllows("manager", false), false);
});
