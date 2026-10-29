import { newQuestionId } from '../../services/firestore.js'

export {
  getRecentTemplateKeys,
  saveRecentTemplateKey,
  useRecentTemplateKeys,
} from './recentTemplates.js'

// Starter tests for the dashboard's start row and the Template gallery.
// Each is a ready-to-use draft: sample questions with the correct answer
// marked (teachers edit or replace them), plus a time limit and strict mode
// that suit the format. build() returns fresh question ids every time.
//
// Questions are written as [question, [options], index of the correct option].

export const CATEGORIES = [
  { id: 'starter', title: 'Quick starts' },
  { id: 'subject', title: 'School subjects' },
  { id: 'format', title: 'Exam formats' },
  { id: 'work', title: 'Work and training' },
]

const make = (rows) =>
  rows.map(([question, options, correct]) => ({ id: newQuestionId(), question, options: [...options], correct }))

function template({ key, name, category, description, minutes, strictMode = false, questions }) {
  return {
    key,
    name,
    category,
    description,
    minutes,
    strictMode,
    count: questions.length,
    build: () => ({ displayName: name, minutes, strictMode, questions: make(questions) }),
    // A stable copy for thumbnails (ids don't matter there).
    preview: { displayName: name, questions: questions.slice(0, 3).map(([question, options]) => ({ question, options })) },
  }
}

export const TEMPLATES = [
  // ── Quick starts ───────────────────────────────────────────
  template({
    key: 'quick-quiz',
    name: 'Quick quiz',
    category: 'starter',
    description: '5 questions · 5 minutes. A short check at the start or end of a lesson.',
    minutes: 5,
    questions: [
      ['Which of these is a prime number?', ['9', '15', '17', '21'], 2],
      ['How many minutes are in 2½ hours?', ['120', '150', '180', '250'], 1],
      ['Which planet is closest to the Sun?', ['Venus', 'Mercury', 'Earth', 'Mars'], 1],
      ['What is the plural of “child”?', ['Childs', 'Childes', 'Children', 'Childrens'], 2],
      ['Water boils at what temperature at sea level?', ['50 °C', '90 °C', '100 °C', '120 °C'], 2],
    ],
  }),

  // ── School subjects ────────────────────────────────────────
  template({
    key: 'mathematics',
    name: 'Mathematics',
    category: 'subject',
    description: '6 questions · 20 minutes. Number, algebra and geometry basics.',
    minutes: 20,
    questions: [
      ['Simplify 3x + 5x − 2x.', ['6x', '8x', '10x', '6'], 0],
      ['Solve for x: 2x + 7 = 19.', ['5', '6', '7', '13'], 1],
      ['What is 15% of 240?', ['24', '30', '36', '40'], 2],
      ['The angles of a triangle add up to…', ['90°', '180°', '270°', '360°'], 1],
      ['What is the area of a rectangle 8 cm long and 5 cm wide?', ['13 cm²', '26 cm²', '40 cm²', '80 cm²'], 2],
      ['Write 0.75 as a fraction in its lowest terms.', ['3/4', '7/5', '75/10', '15/25'], 0],
    ],
  }),
  template({
    key: 'english',
    name: 'English language',
    category: 'subject',
    description: '6 questions · 20 minutes. Grammar, vocabulary and usage.',
    minutes: 20,
    questions: [
      ['Choose the word closest in meaning to “rapid”.', ['Slow', 'Quick', 'Heavy', 'Quiet'], 1],
      ['Choose the word opposite in meaning to “generous”.', ['Kind', 'Mean', 'Wealthy', 'Polite'], 1],
      ['Fill the gap: Neither the teacher nor the students ___ ready.', ['is', 'was', 'were', 'be'], 2],
      ['Which sentence is correct?', ['She don’t like rice.', 'She doesn’t likes rice.', 'She doesn’t like rice.', 'She not like rice.'], 2],
      ['What part of speech is “quickly” in “He ran quickly”?', ['Noun', 'Adjective', 'Verb', 'Adverb'], 3],
      ['Choose the correctly spelt word.', ['Accomodation', 'Accommodation', 'Acommodation', 'Accommodasion'], 1],
    ],
  }),
  template({
    key: 'basic-science',
    name: 'Basic science',
    category: 'subject',
    description: '6 questions · 15 minutes. Living things, matter and energy.',
    minutes: 15,
    questions: [
      ['Which of these is a living thing?', ['Stone', 'Mushroom', 'Water', 'Sand'], 1],
      ['Which state of matter has a fixed shape?', ['Solid', 'Liquid', 'Gas', 'Steam'], 0],
      ['Plants make their food by a process called…', ['Respiration', 'Digestion', 'Photosynthesis', 'Evaporation'], 2],
      ['Which gas is there more of in the air we breathe out than in the air we breathe in?', ['Oxygen', 'Carbon dioxide', 'Hydrogen', 'Helium'], 1],
      ['The main source of energy for the Earth is the…', ['Moon', 'Wind', 'Sun', 'Ocean'], 2],
      ['Which of these is a good conductor of electricity?', ['Rubber', 'Wood', 'Plastic', 'Copper'], 3],
    ],
  }),
  template({
    key: 'biology',
    name: 'Biology',
    category: 'subject',
    description: '6 questions · 20 minutes. Cells, the body and ecology.',
    minutes: 20,
    questions: [
      ['Which part of the cell controls its activities?', ['Cell membrane', 'Nucleus', 'Cytoplasm', 'Vacuole'], 1],
      ['Which organelle releases energy from food (respiration)?', ['Ribosome', 'Chloroplast', 'Mitochondrion', 'Cell wall'], 2],
      ['Which blood cells help to fight infection?', ['Red blood cells', 'White blood cells', 'Platelets', 'Plasma'], 1],
      ['Which organ pumps blood around the body?', ['Lungs', 'Liver', 'Heart', 'Kidney'], 2],
      ['In a food chain, green plants are…', ['Producers', 'Primary consumers', 'Decomposers', 'Predators'], 0],
      ['The green pigment in leaves is called…', ['Haemoglobin', 'Chlorophyll', 'Melanin', 'Keratin'], 1],
    ],
  }),
  template({
    key: 'chemistry',
    name: 'Chemistry',
    category: 'subject',
    description: '6 questions · 20 minutes. Atoms, the periodic table and reactions.',
    minutes: 20,
    questions: [
      ['What is the chemical symbol for sodium?', ['S', 'So', 'Na', 'Sd'], 2],
      ['What is the atomic number of carbon?', ['4', '6', '12', '14'], 1],
      ['A solution with a pH of 3 is…', ['Strongly basic', 'Neutral', 'Acidic', 'Slightly basic'], 2],
      ['Which particle has a negative charge?', ['Proton', 'Neutron', 'Electron', 'Nucleus'], 2],
      ['What is the chemical formula for water?', ['H₂O', 'HO₂', 'H₂O₂', 'OH'], 0],
      ['Rusting of iron needs both…', ['Oxygen and water', 'Nitrogen and water', 'Oxygen and salt only', 'Heat and light'], 0],
    ],
  }),
  template({
    key: 'physics',
    name: 'Physics',
    category: 'subject',
    description: '6 questions · 20 minutes. Motion, forces and energy.',
    minutes: 20,
    questions: [
      ['What is the SI unit of force?', ['Joule', 'Newton', 'Watt', 'Pascal'], 1],
      ['A car travels 120 km in 2 hours. What is its average speed?', ['40 km/h', '60 km/h', '120 km/h', '240 km/h'], 1],
      ['Which of these is a vector quantity?', ['Mass', 'Time', 'Velocity', 'Temperature'], 2],
      ['The SI unit of electrical resistance is the…', ['Volt', 'Ampere', 'Ohm', 'Coulomb'], 2],
      ['Energy stored in a stretched spring is…', ['Kinetic energy', 'Elastic potential energy', 'Heat energy', 'Sound energy'], 1],
      ['Light travels fastest through…', ['Water', 'Glass', 'A vacuum', 'Air at sea level'], 2],
    ],
  }),

  // ── Exam formats ───────────────────────────────────────────
  template({
    key: 'mid-term',
    name: 'Mid-term test',
    category: 'format',
    description: '30 minutes, normal mode. Replace the samples with this half-term’s topics.',
    minutes: 30,
    questions: [
      ['Sample: Which of these is the largest number?', ['0.5', '0.45', '0.405', '0.054'], 0],
      ['Sample: Which word is a synonym of “begin”?', ['Finish', 'Start', 'Stop', 'Delay'], 1],
      ['Sample: Which of these is a renewable source of energy?', ['Coal', 'Petrol', 'Solar', 'Natural gas'], 2],
      ['Sample: How many sides does a hexagon have?', ['5', '6', '7', '8'], 1],
    ],
  }),
  template({
    key: 'end-of-term',
    name: 'End-of-term exam',
    category: 'format',
    description: '60 minutes, strict mode (full screen). Replace the samples with the term’s syllabus.',
    minutes: 60,
    strictMode: true,
    questions: [
      ['Sample: What is 12 × 12?', ['124', '144', '154', '164'], 1],
      ['Sample: Which continent is Nigeria in?', ['Asia', 'Europe', 'Africa', 'South America'], 2],
      ['Sample: Which of these is a noun?', ['Run', 'Happy', 'Table', 'Quickly'], 2],
      ['Sample: Ice melting into water is a…', ['Chemical change', 'Physical change', 'Nuclear change', 'Biological change'], 1],
    ],
  }),
  template({
    key: 'mock-exam',
    name: 'Mock / practice exam',
    category: 'format',
    description: '45 minutes, normal mode. A dress rehearsal before the real exam.',
    minutes: 45,
    questions: [
      ['Sample: If 3 pens cost ₦450, how much do 5 pens cost?', ['₦600', '₦700', '₦750', '₦900'], 2],
      ['Sample: Choose the correct spelling.', ['Recieve', 'Receive', 'Receeve', 'Riceive'], 1],
      ['Sample: Which organ is used for breathing?', ['Heart', 'Lungs', 'Stomach', 'Brain'], 1],
      ['Sample: What is 25% of 80?', ['15', '20', '25', '40'], 1],
    ],
  }),
  template({
    key: 'aptitude',
    name: 'Entrance / aptitude test',
    category: 'format',
    description: '30 minutes, strict mode. Numerical, verbal and reasoning questions.',
    minutes: 30,
    strictMode: true,
    questions: [
      ['What comes next: 2, 6, 12, 20, 30, …?', ['36', '40', '42', '48'], 2],
      ['Book is to reading as fork is to…', ['Drawing', 'Writing', 'Eating', 'Cooking'], 2],
      ['Which word does not belong: apple, mango, carrot, orange?', ['Apple', 'Mango', 'Carrot', 'Orange'], 2],
      ['A shirt costs ₦8,000 after a 20% discount. What was the original price?', ['₦9,600', '₦10,000', '₦10,400', '₦12,000'], 1],
      ['If all roses are flowers and some flowers fade quickly, which must be true?', ['All roses fade quickly', 'Some roses fade quickly', 'No roses fade quickly', 'None of these must be true'], 3],
    ],
  }),

  // ── Work and training ──────────────────────────────────────
  template({
    key: 'staff-training',
    name: 'Staff training check',
    category: 'work',
    description: '15 minutes. Check what staff took away from a training session.',
    minutes: 15,
    questions: [
      ['After the training, who should you contact first with a question about a new procedure?', ['A customer', 'Your line manager or the trainer', 'Nobody', 'Social media'], 1],
      ['How should you store customer information?', ['On a personal phone', 'Only in approved company systems', 'On paper on your desk', 'In a group chat'], 1],
      ['What should you do if a step in the procedure is unclear?', ['Guess and continue', 'Skip it', 'Ask before carrying on', 'Wait until it goes wrong'], 2],
      ['Which of these is the best reason to follow a standard procedure?', ['It is slower', 'It gives the same safe result every time', 'Nobody checks', 'It is optional'], 1],
    ],
  }),
  template({
    key: 'onboarding',
    name: 'New staff onboarding quiz',
    category: 'work',
    description: '10 minutes. Confirms new starters know the essentials.',
    minutes: 10,
    questions: [
      ['Where can you find the staff handbook?', ['The company intranet / shared drive', 'Nowhere', 'Only from customers', 'In the canteen'], 0],
      ['Who do you report an absence to?', ['A colleague', 'Your line manager', 'HR next month', 'Nobody'], 1],
      ['When should you report a safety hazard?', ['At the end of the year', 'Only if someone is hurt', 'As soon as you notice it', 'Never'], 2],
      ['Your password should be…', ['Shared with your team', 'Written on your desk', 'Kept private and strong', 'The same everywhere'], 2],
    ],
  }),
  template({
    key: 'health-safety',
    name: 'Health and safety quiz',
    category: 'work',
    description: '15 minutes. Workplace safety basics.',
    minutes: 15,
    questions: [
      ['What should you do first if you discover a fire?', ['Finish your task', 'Raise the alarm', 'Open all windows', 'Hide'], 1],
      ['Which extinguisher should NOT be used on an electrical fire?', ['CO₂', 'Dry powder', 'Water', 'None - all are safe'], 2],
      ['A spill on the floor should be…', ['Ignored', 'Cleaned or signed straight away', 'Covered with paper', 'Left for the next shift'], 1],
      ['Personal protective equipment (PPE) should be…', ['Worn only when a manager is watching', 'Worn whenever the task requires it', 'Shared without cleaning', 'Optional'], 1],
      ['Where do you gather after evacuating the building?', ['In the car park exit lane', 'At the agreed assembly point', 'At your desk', 'Anywhere you like'], 1],
    ],
  }),
  template({
    key: 'certification',
    name: 'Certification test',
    category: 'work',
    description: '45 minutes, strict mode. A formal pass/fail assessment.',
    minutes: 45,
    strictMode: true,
    questions: [
      ['Sample: Which document defines how a task must be done?', ['A memo', 'A standard operating procedure', 'A newsletter', 'An invoice'], 1],
      ['Sample: Before using new equipment you should…', ['Read the instructions or get trained', 'Try it and see', 'Ask a customer', 'Skip the safety check'], 0],
      ['Sample: Quality checks are done to…', ['Slow work down', 'Find and fix problems early', 'Blame staff', 'Fill in time'], 1],
      ['Sample: A near-miss should be…', ['Forgotten', 'Reported so it can be prevented', 'Kept secret', 'Joked about'], 1],
    ],
  }),
]

export const TEMPLATE_BY_KEY = Object.fromEntries(TEMPLATES.map((t) => [t.key, t]))

// Shown in the dashboard's start row (the rest are in the gallery).
export const START_ROW_KEYS = ['quick-quiz', 'mid-term']
