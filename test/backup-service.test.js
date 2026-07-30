import assert from "node:assert/strict";
import test from "node:test";
import { createBackup, parseBackup } from "../src/backup-service.js";
import { resumeData } from "../src/resume-data.js";

const options = {
  defaultResume: resumeData,
  layouts: ["modern", "classic"],
  themes: ["blue", "slate"],
  defaultLayout: "modern",
  defaultTheme: "blue",
  defaultTextScale: 1.25,
};

const legacyResume = {
  basics: { name: "Alex Rivera", title: "Designer", email: "alex@example.com" },
  summary: "Design leader.",
  skills: [{ category: "Design", items: "Research, Systems" }],
  experience: [{ company: "Northstar", role: "Lead", dates: "2022—Now", bullets: ["Led product design."] }],
  education: { school: "State University", degree: "BFA" },
};

test("round-trips the current backup format", () => {
  const backup = createBackup({
    resume: resumeData,
    document: { name: "Current", layout: "classic", theme: "slate", textScale: 1.1 },
  });
  const parsed = parseBackup(JSON.stringify(backup), options);
  assert.equal(parsed.documentName, "Current");
  assert.equal(parsed.layout, "classic");
  assert.equal(parsed.theme, "slate");
  assert.equal(parsed.migrated, false);
});

test("imports an older version-history snapshot with top-level settings", () => {
  const parsed = parseBackup(JSON.stringify({
    data: legacyResume,
    documentName: "Alex application",
    layout: "classic",
    theme: "slate",
    textScale: 1.125,
  }), options);
  assert.equal(parsed.documentName, "Alex application");
  assert.equal(parsed.data.basics.name, "Alex Rivera");
  assert.equal(parsed.data.basics.phone, "");
  assert.equal(parsed.data.experience[0].location, "");
  assert.deepEqual(parsed.data.closingStatement, { label: "", text: "", enabled: false });
  assert.equal(parsed.migrated, true);
});

test("imports a raw legacy résumé and fills newer sections", () => {
  const parsed = parseBackup(JSON.stringify(legacyResume), options);
  assert.equal(parsed.documentName, "Alex Rivera résumé");
  assert.deepEqual(parsed.data.achievements, []);
  assert.equal(parsed.layout, "modern");
  assert.equal(parsed.theme, "blue");
});

test("accepts a current wrapper with partial document settings", () => {
  const parsed = parseBackup(JSON.stringify({
    kind: "rapidcv-backup",
    version: 1,
    document: { name: "Partial settings" },
    resume: legacyResume,
  }), options);
  assert.equal(parsed.documentName, "Partial settings");
  assert.equal(parsed.layout, "modern");
  assert.equal(parsed.textScale, 1.25);
});

test("rejects malformed résumé fields", () => {
  assert.throws(
    () => parseBackup(JSON.stringify({ ...legacyResume, skills: "not-an-array" }), options),
    /resume\.skills is not valid/,
  );
});

test("rejects backups from a newer schema version", () => {
  assert.throws(
    () => parseBackup(JSON.stringify({
      kind: "rapidcv-backup",
      version: 99,
      resume: legacyResume,
    }), options),
    /newer version/,
  );
});
