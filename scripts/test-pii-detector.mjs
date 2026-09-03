// Mirror of the frontend detector — must be kept in sync manually with index.html.
const SEVIS_ID_RE = /\bN\d{10}\b/g;
const LABELED_ID_RE =
  /(\b(?:EMPL\s?ID|student\s+id|SEVIS\s+(?:id|no\.?|number)|passport\s+(?:no\.?|number)|I-?94(?:\s+(?:no\.?|number))?|A#|alien\s+(?:registration\s+)?number)\s*[:#]?\s*)(?=[A-Z0-9-]*\d)[A-Z0-9][A-Z0-9-]{4,}/gi;
const EMAIL_HEADER_RE = /^(?:from|to|cc|subject|sent|date)\s*:/gim;

function detectStudentInfo(text) {
  const findings = [];
  if (text.match(SEVIS_ID_RE) || text.match(LABELED_ID_RE)) findings.push("id");
  if ((text.match(EMAIL_HEADER_RE) || []).length >= 2) findings.push("email");
  return findings;
}
function redactStudentInfo(text) {
  return text
    .replace(SEVIS_ID_RE, "[SEVIS ID removed]")
    .replace(LABELED_ID_RE, "$1[removed]");
}

const cases = [
  // [input, expected findings, note]
  ["My student N0012345678 wants to drop below full time", ["id"], "bare SEVIS ID"],
  ["What is a SEVIS ID and where do I find it?", [], "question about the concept"],
  ["SEVIS ID: 0012345678 — can she extend?", ["id"], "labeled SEVIS without N"],
  ["From: Jane Doe\nTo: DSO Office\nSubject: CPT question\nCan I work?", ["email"], "pasted email"],
  ["his I-94 number 12345678901 shows D/S", ["id"], "labeled I-94"],
  ["What is an I-94 number?", [], "concept question, no digits"],
  ["Form I-94 admission record shows D/S", [], "I-94 followed by words only"],
  ["passport number: C1234567 expires soon", ["id"], "labeled passport"],
  ["EMPLID 23456789 needs an RCL", ["id"], "EMPLID"],
  ["Can a student work 20 hours on campus?", [], "clean regulatory question"],
  ["Receipt YSC1234567890 is pending", [], "USCIS receipt is not a SEVIS ID"],
  ["a number of hours: 20 per week", [], "'a number' phrasing must not trip"],
  [
    "From: advisor\nSubject: transfer\nSEVIS record N0098765432 for the student",
    ["id", "email"],
    "mixed email + ID",
  ],
];

let fail = 0;
for (const [input, expected, note] of cases) {
  const got = detectStudentInfo(input);
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  [${note}] got=${JSON.stringify(got)} expected=${JSON.stringify(expected)}`);
}

// Redaction spot checks
const r1 = redactStudentInfo("My student N0012345678 wants CPT");
const r2 = redactStudentInfo("passport number: C1234567 expires");
const r3 = redactStudentInfo("SEVIS ID: 0012345678 extension");
console.log("R1:", r1);
console.log("R2:", r2);
console.log("R3:", r3);
if (/\d{7,}/.test(r1 + r2 + r3)) { console.log("FAIL: digits survive redaction"); fail++; }
console.log(fail === 0 ? "ALL PASS" : `${fail} FAILURES`);
