// base: 1 Mild, 2 Moderate, 3 Severe.  type 'bump': a YES adds 1 to severity (max 3).
// type 'red': a YES makes the case Critical (4) straight away.
const q = (id, text, type) => ({ id, text, type });
const s = (id, label, base, questions) => ({ id, label, base, questions });

module.exports = [
  {
    id: "breathing",
    label: "Breathing and chest",
    symptoms: [
      s("cough", "Cough or sore throat", 1, [
        q("cough-fever", "Do you have a fever?", "bump"),
        q(
          "cough-breath",
          "Is it hard to breathe, or hard to speak a full sentence?",
          "red",
        ),
      ]),
      s("chest", "Chest pain or tightness", 3, [
        q(
          "chest-spread",
          "Does the pain spread to your arm, jaw or back, or come with sweating?",
          "red",
        ),
        q("chest-sudden", "Did it start suddenly in the last hour?", "bump"),
      ]),
      s("wheeze", "Asthma or wheezing", 2, [
        q(
          "wheeze-speak",
          "Can you not speak a full sentence, or do your lips look blue?",
          "red",
        ),
        q("wheeze-inhaler", "Is your inhaler not helping?", "bump"),
      ]),
    ],
  },
  {
    id: "head",
    label: "Head and nerves",
    symptoms: [
      s("headache", "Headache", 1, [
        q(
          "head-worst",
          "Is this a sudden, severe headache unlike any you have had?",
          "red",
        ),
        q("head-neck", "Do you also have a stiff neck with fever?", "red"),
        q("head-vomit", "Do you also have vomiting or blurred vision?", "bump"),
      ]),
      s("dizzy", "Dizziness or fainting", 2, [
        q(
          "dizzy-weak",
          "Do you have new weakness on one side, or trouble speaking?",
          "red",
        ),
        q("dizzy-faint", "Did you faint or lose consciousness?", "bump"),
      ]),
    ],
  },
  {
    id: "stomach",
    label: "Stomach and digestion",
    symptoms: [
      s("stomach", "Stomach pain", 1, [
        q(
          "stomach-blood",
          "Are you vomiting blood, or is your stool black?",
          "red",
        ),
        q(
          "stomach-sudden",
          "Is the pain severe and did it start suddenly?",
          "bump",
        ),
      ]),
      s("vomit", "Vomiting or diarrhoea", 1, [
        q("vomit-blood", "Is there blood in your vomit or stool?", "red"),
        q("vomit-fluids", "Are you unable to keep any fluids down?", "bump"),
      ]),
    ],
  },
  {
    id: "fever",
    label: "Fever and infection",
    symptoms: [
      s("fever", "Fever or chills", 2, [
        q(
          "fever-neck",
          "Do you have a stiff neck, confusion, or a rash that does not fade when pressed?",
          "red",
        ),
        q("fever-days", "Has the fever lasted more than 3 days?", "bump"),
      ]),
    ],
  },
  {
    id: "injury",
    label: "Injury and wounds",
    symptoms: [
      s("wound", "Cut or wound", 1, [
        q(
          "wound-bleed",
          "Is the bleeding still heavy after pressing on it for 10 minutes?",
          "red",
        ),
        q("wound-deep", "Is the cut deep or gaping?", "bump"),
      ]),
      s("fall", "Sprain, fall or suspected fracture", 2, [
        q(
          "fall-bone",
          "Is a bone visible, or does the limb look deformed?",
          "red",
        ),
        q(
          "fall-weight",
          "Are you unable to put weight on it or use it?",
          "bump",
        ),
      ]),
    ],
  },
  {
    id: "other",
    label: "Skin, eyes and other",
    symptoms: [
      s("rash", "Rash or skin problem", 1, [
        q(
          "rash-swell",
          "Is your face or mouth swelling, or are you having trouble breathing?",
          "red",
        ),
        q("rash-spread", "Is it spreading fast or very painful?", "bump"),
      ]),
      s("eye", "Eye problem", 1, [
        q(
          "eye-vision",
          "Did you suddenly lose vision, or get a chemical in your eye?",
          "red",
        ),
        q("eye-pain", "Is the eye very painful?", "bump"),
      ]),
      s("minor", "Something else (minor concern)", 1, [
        q(
          "minor-red",
          "Do you have difficulty breathing, severe pain, or heavy bleeding?",
          "red",
        ),
        q("minor-worse", "Is it getting worse quickly?", "bump"),
      ]),
    ],
  },
];
