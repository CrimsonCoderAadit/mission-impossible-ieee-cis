export const CONFIG = {
  eventName: "Mission: Impossible",
  tagline: "Make the impossible work.",
  organiser: "IEEE Computational Intelligence Society · SSN Student Branch",
  occasion: "IEEE Day 2026",
  start: "2026-10-09T11:15:00+05:30",
  end: "2026-10-09T14:30:00+05:30",
  venue: "Mech Seminar Hall",
  room: "TBA",
  registerUrl: "https://docs.google.com/forms/d/e/1FAIpQLSe2w_my1qFhgysbs3-5dtREk-wR5czb2x2A1uGgfeG68eLWfg/viewform",
  rulebookUrl: "assets/mission-impossible-rulebook.pdf",
  fees: { member: 25, nonMember: 35, unit: "per head" },
  teamSize: "3 to 4",
  prizes: [
    { place: "1st", amount: 1000, cert: "Certificate of Excellence" },
    { place: "2nd", amount: 750, cert: "Certificate of Merit" },
    { place: "3rd", amount: 500, cert: "Certificate of Appreciation" }
  ],
  contact: { name: "Harini Narasimhan", phone: "+918072001636", display: "+91 80720 01636" },
  schedule: [
    { time: "11:15", end: "11:25", label: "Arrival", detail: "Team registration" },
    { time: "11:25", end: "11:35", label: "Briefing", detail: "Welcome, rules and format" },
    { time: "11:35", end: "12:20", label: "Phase 01 · Prep", detail: "Ideate and build your pitch", phase: 1 },
    { time: "12:20", end: "12:55", label: "Phase 01 · Pitches", detail: "About 3 min per squad plus questions from other teams", phase: 1 },
    { time: "12:55", end: "14:05", label: "Phase 02 · Build", detail: "Turn the pitch into a working prototype", phase: 2 },
    { time: "14:05", end: "14:20", label: "Phase 02 · Demos", detail: "Final demos to the judges", phase: 2 },
    { time: "14:20", end: "14:30", label: "Debrief", detail: "Results and awards" }
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
    { concept: "Light mode UI", audience: "a vampire" },
    { concept: "Neuralink interfaces between the brain and a computer", audience: "Indian parents who blame your headache on your 5G phone" },
    { concept: "Neural networks", audience: "a medieval king" },
    { concept: "Fuzzy logic", audience: "a professional chef" },
    { concept: "Blockchain", audience: "a history teacher" },
    { concept: "Machine learning", audience: "a farmer" }
  ],
  rules: [
    "Squads of 3 to 4 operatives, registered in advance with a team name and every member's name.",
    "Any AI tool is allowed in both phases, including ChatGPT, Claude, Gemini and development tools.",
    "Every member must take part in the pitch and the demo.",
    "Your final build must use technology and relate to your assigned concept.",
    "Bring your own charged laptop with access to your AI tools."
  ],
  shortOrganiser: "IEEE CIS SSN",
  timeZone: "Asia/Kolkata",
  timeZoneLabel: "IST",
  phaseCount: 2,
  aiTools: "ChatGPT, Claude, or any AI tool",
  equipment: "Your own laptop, charged, with AI tool access",
  participation: "Every operative receives a Certificate of Participation.",
  operation: {
    prepMinutes: 45,
    prepDuration: "Forty-five minutes",
    pitchMinutes: "~3",
    buildMinutes: 70,
    buildDuration: "Seventy minutes",
    demoMinutes: "3 to 5"
  },
  selfDestructSeconds: 5
};
