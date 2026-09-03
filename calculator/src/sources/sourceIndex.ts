export interface SourceReference {
  id: string;
  title: string;
  locator: string;
  /** In-site citation target (the self-hosted rule page for FR sources). */
  url: string;
  /** The same passage on federalregister.gov, for the official version. */
  officialUrl?: string;
  /** Verbatim excerpt from the cited source. */
  quote?: string;
  published?: string;
  effective?: string;
  lastVerified: string;
}

const FEDERAL_REGISTER_RULE =
  "https://www.federalregister.gov/documents/2026/07/17/2026-14439/establishing-a-fixed-time-period-of-admission-and-an-extension-of-stay-procedure-for-nonimmigrant";
// FR citations open the self-hosted copy of the rule (same p-#### anchors,
// loud highlight, quote marking) with the official page one click away.
const HOSTED_RULE = "/rules/duration-of-status/";
const ruleParagraph = (sourceId: string, paragraph: number) => `${HOSTED_RULE}?src=${sourceId}#p-${paragraph}`;
const officialRuleParagraph = (paragraph: number) => `${FEDERAL_REGISTER_RULE}#p-${paragraph}`;

export const SOURCE_INDEX: Record<string, SourceReference> = {
  "FR-2026-FINAL-RULE": {
    id: "FR-2026-FINAL-RULE",
    title: "Establishing a Fixed Time Period of Admission and an Extension of Stay Procedure for Nonimmigrant Academic Students, Exchange Visitors, and Representatives of Foreign Information Media",
    locator: "Federal Register final rule, DHS, published July 17, 2026",
    url: FEDERAL_REGISTER_RULE,
    published: "2026-07-17",
    effective: "2026-09-15",
    quote: "This rule has been classified as a major rule subject to congressional review. The effective date is September 15, 2026.",
    lastVerified: "2026-08-15"
  },
  "8CFR-214-1-A4": {
    id: "8CFR-214-1-A4",
    title: "8 CFR 214.1(a)(4), fixed period of admission",
    locator: "Final rule regulatory text for fixed admissions after the effective date",
    url: ruleParagraph("8CFR-214-1-A4", 1714),
    officialUrl: officialRuleParagraph(1714),
    quote: "Aliens seeking admission to the United States, including those seeking admission with a properly filed pending application for an extension of stay, as an F nonimmigrant after a previously authorized period of admission as an F nonimmigrant expired, may be admitted for a maximum period of 4 years or the length of program as specified on Form I-20, whichever is shorter, plus additional 30 day periods for arrival and departure as provided in § 214.2(f)(5)(i);",
    lastVerified: "2026-08-15"
  },
  "8CFR-214-1-M1": {
    id: "8CFR-214-1-M1",
    title: "8 CFR 214.1(m)(1), transition treatment for D/S admissions",
    locator: "Final rule transition provisions for F and J nonimmigrants admitted for duration of status",
    url: ruleParagraph("8CFR-214-1-M1", 1731),
    officialUrl: officialRuleParagraph(1731),
    quote: "Aliens with F or J status who are properly maintaining their status on September 15, 2026, and who were admitted for duration of status are authorized to remain in the United States in F or J nonimmigrant status until the later date of either the expiration date on an Employment Authorization Document, Form I-766, or successor form, or the program end date noted on their Form I-20 or Form DS-2019, as applicable, not to exceed a period of 4 years from September 15, 2026…",
    lastVerified: "2026-08-15"
  },
  "8CFR-214-1-M1-OPT": {
    id: "8CFR-214-1-M1-OPT",
    title: "8 CFR 214.1(m)(1)(i), transition OPT/STEM OPT filing treatment",
    locator: "Final rule transition provisions for F-1 post-completion OPT and STEM OPT filings",
    url: ruleParagraph("8CFR-214-1-M1-OPT", 1732),
    officialUrl: officialRuleParagraph(1732),
    quote: "an F-1 student recommended for post-completion OPT who files before his or her period of admission expires, including the 60 day departure period, an Application for Employment Authorization, Form I-765, or successor form … on or before March 18, 2027, is not required to file an Application to Extend/Change Nonimmigrant Status, Form I-539, or successor form for the requested period of post-completion OPT.",
    lastVerified: "2026-08-15"
  },
  "8CFR-214-1-C8": {
    id: "8CFR-214-1-C8",
    title: "8 CFR 214.1(c)(8), travel while extension request is pending",
    locator: "Final rule pending extension and departure provisions",
    url: ruleParagraph("8CFR-214-1-C8", 1728),
    officialUrl: officialRuleParagraph(1728),
    quote: "If an alien in F, I, or J nonimmigrant status timely files an application for an extension of stay, USCIS will not consider the application abandoned if the alien departs the United States while the application is pending, provided that when the alien seeks admission, the previously authorized period of admission has not expired, and the alien seeks admission for the balance of the previously authorized admission period.",
    lastVerified: "2026-08-15"
  },
  "8CFR-214-2-F11": {
    id: "8CFR-214-2-F11",
    title: "8 CFR 214.2(f)(11)(i), post-completion OPT filing window (amended: 30 days after program end)",
    locator: "Final rule discussion of the shortened post-completion OPT filing window: 90 days before to 30 days after the program end date",
    url: ruleParagraph("8CFR-214-2-F11", 1538),
    officialUrl: officialRuleParagraph(1538),
    quote: "Since an F-1 student now has 30 days, rather than the previously allotted 60 days, to depart the country or to otherwise maintain status after their completion of their program or program end date, it follows that they need to file a Form I-765 or successor form for post-completion OPT within 30 days, rather than the previously allotted 60 days, after their program end date.",
    lastVerified: "2026-08-15"
  },
  "8CFR-214-2-F5V": {
    id: "8CFR-214-2-F5V",
    title: "8 CFR 214.2(f)(5)(v), F-1 period of preparation for departure",
    locator: "Final rule fixed-period F-1 30-day departure/maintain-status period",
    url: ruleParagraph("8CFR-214-2-F5V", 1760),
    officialUrl: officialRuleParagraph(1760),
    quote: "An F-1 student who has completed a course of study and any authorized practical training will be allowed an additional 30-day period from the program end date or the 4 year maximum period of admission, or the end date of the approved employment authorization for post-completion OPT or STEM OPT, as applicable, to prepare for departure from the United States, or to otherwise seek to maintain lawful status…",
    lastVerified: "2026-08-15"
  },
  "8CFR-214-2-F5II": {
    id: "8CFR-214-2-F5II",
    title: "8 CFR 214.2(f)(5)(ii), F-1 school transfer, program change, and education-level limits",
    locator: "Final rule rules for undergraduate first-year changes, graduate changes/transfers, and same/lower-level programs",
    url: ruleParagraph("8CFR-214-2-F5II", 1754),
    officialUrl: officialRuleParagraph(1754),
    quote: "An F-1 student at any level below the graduate degree level may not transfer or change educational objectives, i.e., majors or educational levels, within the first academic year of a program of study, unless an exception is authorized by SEVP for extenuating circumstances",
    lastVerified: "2026-08-15"
  },
  "8CFR-214-2-F5II-GRADUATE": {
    id: "8CFR-214-2-F5II-GRADUATE",
    title: "8 CFR 214.2(f)(5)(ii)(A), graduate program and transfer limits",
    locator: "Regulatory text for changes and transfers during an active graduate program",
    url: ruleParagraph("8CFR-214-2-F5II-GRADUATE", 1754),
    officialUrl: officialRuleParagraph(1754),
    quote: "An F-1 student at the graduate degree level or above may not change educational objectives at any point during their program of study. An F-1 student at the graduate degree level or above may not transfer at any point during their program of study, unless an exception is authorized by SEVP for extenuating circumstances",
    lastVerified: "2026-08-15"
  },
  "8CFR-214-2-F5II-SAME-LOWER": {
    id: "8CFR-214-2-F5II-SAME-LOWER",
    title: "8 CFR 214.2(f)(5)(ii)(C), same- or lower-level study",
    locator: "DHS explanation that only programs completed after September 15, 2026 count toward the new limit",
    url: ruleParagraph("8CFR-214-2-F5II-SAME-LOWER", 794),
    officialUrl: officialRuleParagraph(794),
    quote: "Additionally, the limits of study at the same or lower educational levels will be applied prospectively. Any programs completed prior to the effective date of the rule will not be counted towards the limits. DHS has therefore clarified in the final rule that this limitation of study at the same or lower educational levels applies only to programs that are completed after the effective date.",
    lastVerified: "2026-08-15"
  },
  "8CFR-214-2-F5VIII-CPT": {
    id: "8CFR-214-2-F5VIII-CPT",
    title: "8 CFR 214.2(f)(5)(viii), CPT and employment during a pending extension",
    locator: "Final rule regulatory text on employment, including CPT, continuing automatically while an F-1 extension of stay is pending (up to 240 days)",
    url: ruleParagraph("8CFR-214-2-F5VIII-CPT", 1768),
    officialUrl: officialRuleParagraph(1768),
    quote: "an F-1 student's current on-campus, curricular practical training (CPT), and severe economic hardship authorized employment is automatically extended during the pendency of the extension of stay application, but such automatic extension may not exceed 240 days beginning from the end date of his or her period of admission as indicated on the alien's Arrival/Departure Record, Form I-94, or successor form.",
    lastVerified: "2026-08-15"
  },
  "FR-FOUR-YEAR-START": {
    id: "FR-FOUR-YEAR-START",
    title: "DHS explanation of the four-year calculation",
    locator: "Final rule preamble: the maximum period is calculated from the Form I-20 program start date",
    url: ruleParagraph("FR-FOUR-YEAR-START", 537),
    officialUrl: officialRuleParagraph(537),
    quote: "Specifically, the 4-year maximum will be calculated from the date the program begins a.k.a “program start date”—whether first day of classes or first day of research, etc. F or J nonimmigrants are allowed to arrive up to 30 days prior to the program start date, but those days will not be taken into account when calculating the maximum allowed period of stay.",
    lastVerified: "2026-08-15"
  },
  "8CFR-214-2-F7": {
    id: "8CFR-214-2-F7",
    title: "8 CFR 214.2(f)(7), F-1 extension of stay",
    locator: "Eligibility, filing requirements, timing, dependents, and extension length",
    url: ruleParagraph("8CFR-214-2-F7", 1769),
    officialUrl: officialRuleParagraph(1769),
    quote: "USCIS may grant an extension of stay to an F-1 student who has maintained his or her F-1 status, but who is unable to complete his or her program by the end of his or her authorized period of admission. Such student may be eligible for an extension if the designated school official issues a new Form I-20 or successor form certifying that the student is eligible under this paragraph (f)(7)(i).",
    lastVerified: "2026-08-15"
  },
  "8CFR-214-2-F7-TIMELY": {
    id: "8CFR-214-2-F7-TIMELY",
    title: "8 CFR 214.2(f)(7)(iii)(B), timely extension filing",
    locator: "USCIS receipt deadline and work limits during the final 30 days",
    url: ruleParagraph("8CFR-214-2-F7-TIMELY", 1780),
    officialUrl: officialRuleParagraph(1780),
    quote: "If the extension of stay application is received during the 30-day period provided in paragraph (f)(5)(v) of this section, the F-1 student is authorized to continue a full course of study but may not continue or begin engaging in practical training or other employment. Notwithstanding § 214.1(c)(4), USCIS must receive the extension of stay application on or before the expiration of the previously authorized period of stay.",
    lastVerified: "2026-08-15"
  },
  "8CFR-214-2-F8-TRANSFER": {
    id: "8CFR-214-2-F8-TRANSFER",
    title: "8 CFR 214.2(f)(8), transfer eligibility and timing",
    locator: "Regulatory text for a transfer from post-completion or STEM OPT into a later program",
    url: ruleParagraph("8CFR-214-2-F8-TRANSFER", 1797),
    officialUrl: officialRuleParagraph(1797),
    quote: "If the F-1 student is authorized to engage in post-completion or STEM OPT, he or she must be able to begin or resume classes within 5 months of transferring out of the school that recommended the post-completion or STEM OPT or the date the post-completion or STEM OPT authorization ends, whichever is earlier.",
    lastVerified: "2026-08-15"
  },
  "8CFR-214-2-F5-EXCEPTIONS": {
    id: "8CFR-214-2-F5-EXCEPTIONS",
    title: "8 CFR 214.2(f)(5)(i), shorter fixed-period limits",
    locator: "English-language training, public high school, pending OPT, and F-2 limits",
    url: ruleParagraph("8CFR-214-2-F5-EXCEPTIONS", 1749),
    officialUrl: officialRuleParagraph(1749),
    quote: "F-1 students whose course of study is in an English language training program are restricted to a maximum of admission period of 24 months, plus an additional 30-day period of stay for the purposes of departure or to otherwise seek to maintain lawful status.",
    lastVerified: "2026-08-15"
  },
  "8CFR-214-2-F5II-DELAY": {
    id: "8CFR-214-2-F5II-DELAY",
    title: "8 CFR 214.2(f)(5)(ii)(E), possible implementation delay",
    locator: "DHS authority to delay or suspend academic-mobility restrictions through September 14, 2028",
    url: ruleParagraph("8CFR-214-2-F5II-DELAY", 1758),
    officialUrl: officialRuleParagraph(1758),
    quote: "Until September 14, 2028, DHS may delay or suspend the implementation of paragraphs (f)(5)(ii)(A) through (C) of this section, in its discretion, if it determines that implementation is infeasible for any reason.",
    lastVerified: "2026-08-15"
  },
  "USCIS-G1055-I539": {
    id: "USCIS-G1055-I539",
    title: "USCIS G-1055 Fee Schedule, Form I-539",
    locator: "Form I-539 general filing fee: $470 paper filing or $420 online filing; page last reviewed July 28, 2026",
    url: "https://www.uscis.gov/g-1055?topic_id=97292",
    quote: "General Filing $470 $420",
    lastVerified: "2026-08-15"
  },
  "FR-F1-EXTENSION-PROCESS": {
    id: "FR-F1-EXTENSION-PROCESS",
    title: "DHS discussion of F-1 extension processing",
    locator: "Final rule discussion of possible biometrics and interviews for F-1 extension applicants",
    url: ruleParagraph("FR-F1-EXTENSION-PROCESS", 704),
    officialUrl: officialRuleParagraph(704),
    quote: "As part of the EOS application process for F, J, and I nonimmigrants, USCIS may require biometrics (such as fingerprints, photographs, and signatures) … and applicants may be required to appear for an interview under 8 CFR 103.2(b)(9).",
    lastVerified: "2026-08-15"
  },
  "FR-I539-PREMIUM": {
    id: "FR-I539-PREMIUM",
    title: "DHS discussion of premium processing for Form I-539",
    locator: "Final rule response explaining that premium processing is not currently available for this extension request",
    url: ruleParagraph("FR-I539-PREMIUM", 612),
    officialUrl: officialRuleParagraph(612),
    quote: "USCIS will continue to explore expanding premium processing for Form I-539 for affected populations requesting an EOS. … In the absence of premium processing, an applicant may request that USCIS expedite the adjudication of an application, including for an EOS, that is under USCIS jurisdiction.",
    lastVerified: "2026-08-15"
  },
  "FR-F1-TEMPORARY-INTENT": {
    id: "FR-F1-TEMPORARY-INTENT",
    title: "DHS discussion of F-1 eligibility during extension review",
    locator: "Final rule response explaining that DHS reassesses the statutory F-1 requirements during an extension adjudication",
    url: ruleParagraph("FR-F1-TEMPORARY-INTENT", 476),
    officialUrl: officialRuleParagraph(476),
    quote: "By implementing a fixed period of admission and requiring EOS thereafter, DHS will be in a position to assess whether a nonimmigrant continues to meet the requirements for F-1 or J-1nonimmigrant status. Extending an alien's nonimmigrant status involves an adjudication of whether an alien is legally eligible to extend his or her stay in the United States in a given immigration status and has been complying with the terms and conditions of his or her admission.",
    lastVerified: "2026-08-15"
  },
  "FR-I140-OUT-OF-SCOPE": {
    id: "FR-I140-OUT-OF-SCOPE",
    title: "DHS treatment of I-140 comments in this rulemaking",
    locator: "Final rule section identifying I-140 and employment-based immigration comments as outside this rule's scope",
    url: ruleParagraph("FR-I140-OUT-OF-SCOPE", 1414),
    officialUrl: officialRuleParagraph(1414),
    quote: "Commenters made out-of-scope remarks about various immigration statuses and programs, … allegations related to visa applicants, employment-based immigration (including H-1B fraud, EB-1, EB-2 NIV and I-140), family-based immigration (marriage, green card), B-1/B-2 visitors, and humanitarian-based immigration such as waivers and the asylum process;",
    lastVerified: "2026-08-15"
  },
  "USCIS-OPT-STEM": {
    id: "USCIS-OPT-STEM",
    title: "USCIS Policy Manual, Practical Training (Vol. 2, Part F, Ch. 5)",
    locator: "USCIS guidance on post-completion OPT and the later 24-month STEM OPT extension; pre-rule filing windows may still appear until USCIS updates it",
    url: "https://www.uscis.gov/node/92821",
    quote: "An F-1 student who meets certain qualifications may qualify for a 24-month STEM OPT extension.",
    lastVerified: "2026-08-15"
  },
  "NAFSA-DS-FINAL-RULE-HUB": {
    id: "NAFSA-DS-FINAL-RULE-HUB",
    title: "NAFSA DHS Final Rule Ending Duration of Status",
    locator: "NAFSA analysis and link hub for the DHS final rule ending duration of status (free NAFSA account required), updated August 14, 2026",
    url: "https://www.nafsa.org/regulatory-information/dhs-final-rule-ending-duration-status",
    published: "2026-07-18",
    lastVerified: "2026-08-15"
  }
};

export function source(id: string): SourceReference {
  return SOURCE_INDEX[id];
}

export function sourceLinkLabel(reference: SourceReference): string {
  if (reference.url.startsWith(HOSTED_RULE)) {
    return "Open the highlighted rule passage";
  }
  if (reference.id === "FR-2026-FINAL-RULE") {
    return "Open the official rule";
  }
  return "Open the cited source";
}
