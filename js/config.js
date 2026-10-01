export const CONFIG = {
  eventName: "Mission: Impossible",
  tagline: "Make the impossible work.",
  organiser: "IEEE Computational Intelligence Society · SSN Student Branch",
  occasion: "IEEE Day 2026",
  start: "2026-10-09T09:30:00+05:30",
  end: "2026-10-09T13:30:00+05:30",
  venue: "SSN College of Engineering",
  room: "TBA",
  registerUrl: "https://docs.google.com/forms/d/e/1FAIpQLSe2w_my1qFhgysbs3-5dtREk-wR5czb2x2A1uGgfeG68eLWfg/viewform",
  rulebookUrl: "https://canva.link/sc5l5dqu56g76ud",
  fees: { member: 25, nonMember: 35, unit: "per head" },
  teamSize: "3–4",
  prizes: [
    { place: "1st", amount: 1000, cert: "Certificate of Excellence" },
    { place: "2nd", amount: 750, cert: "Certificate of Merit" },
    { place: "3rd", amount: 500, cert: "Certificate of Appreciation" }
  ],
  contact: { name: "Harini Narasimhan", phone: "+918072001636", display: "+91 80720 01636" },
  schedule: [
    { time: "09:30", end: "09:40", label: "Check-in", detail: "Registration & team check-in" },
    { time: "09:40", end: "09:50", label: "Briefing", detail: "Welcome, rules & format" },
    { time: "09:50", end: "10:50", label: "Phase 01 · Prep", detail: "Ideate and build your pitch", phase: 1 },
    { time: "10:50", end: "11:35", label: "Phase 01 · Pitches", detail: "~3 min per squad + cross-questioning", phase: 1 },
    { time: "11:35", end: "13:00", label: "Phase 02 · Build", detail: "Turn the pitch into a working prototype", phase: 2 },
    { time: "13:00", end: "13:20", label: "Phase 02 · Demos", detail: "Final demos to the judges", phase: 2 },
    { time: "13:20", end: "13:30", label: "Debrief", detail: "Results & awards" }
  ],
  judging: [
    { name: "Creativity & Innovation", weight: 25, round: "Phase 01" },
    { name: "Technical Understanding", weight: 20, round: "Both" },
    { name: "Pitch Quality & Communication", weight: 15, round: "Phase 01" },
    { name: "Execution & Prototype Quality", weight: 25, round: "Phase 02" },
    { name: "AI Tool Utilisation", weight: 10, round: "Both" },
    { name: "Teamwork & Adaptability", weight: 5, round: "Both" }
  ],
  leaks: [
    { concept: "Light-mode UI", audience: "a vampire" },
    { concept: "Neuralink brain–computer interfaces", audience: "Indian parents who blame your headache on your 5G phone" },
    { concept: "Neural networks", audience: "a medieval king" },
    { concept: "Fuzzy logic", audience: "a professional chef" },
    { concept: "Blockchain", audience: "a history teacher" },
    { concept: "Machine learning", audience: "a farmer" }
  ],
  rules: [
    "Squads of 3–4 operatives, registered in advance with a team name and every member's name.",
    "Any AI tool is allowed in both phases — ChatGPT, Claude, Gemini, dev tools, anything.",
    "Every member must take part in the pitch and the demo.",
    "Your final build must be tech-based and tied to the concept you're assigned.",
    "Bring your own charged laptop with access to your AI tools."
  ],
  wordmark: "IEEE CIS · SSN",
  shortOrganiser: "IEEE CIS SSN",
  timeZone: "Asia/Kolkata",
  timeZoneLabel: "IST",
  phaseCount: 2,
  aiTools: "Any",
  equipment: "Your own laptop, charged, with AI tool access",
  participation: "Every operative receives a Certificate of Participation.",
  operation: {
    prepMinutes: 60,
    prepDuration: "One hour",
    pitchMinutes: "~3",
    buildMinutes: 90,
    buildDuration: "Ninety minutes",
    demoMinutes: "3–5"
  },
  selfDestructSeconds: 5
};
