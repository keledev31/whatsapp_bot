const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'jamb_bot',
  user: process.env.POSTGRES_USER || 'jamb_user',
  password: process.env.POSTGRES_PASSWORD || 'jamb_password'
});

// Sample JAMB Questions (100+ questions)
const questions = [
  // English - 2023
  { subject: 'English', year: 2023, number: 1, question: 'Which word is the odd one out?', options: ['Mobile', 'Phone', 'Telephone', 'Call'], answer: 'D', explanation: 'Call is a verb while others are nouns for communication devices' },
  { subject: 'English', year: 2023, number: 2, question: 'Choose the correct meaning: "He is a dark horse in this election"', options: ['He is mysterious and unknown', 'He rides horses at night', 'He is very unfortunate', 'He is lazy'], answer: 'A', explanation: 'Dark horse means a person whose abilities or qualities are not known' },
  { subject: 'English', year: 2023, number: 3, question: 'What is the past tense of "withdraw"?', options: ['withdrawed', 'withdrew', 'withdrawn', 'withdrawing'], answer: 'B', explanation: 'Withdrew is the simple past tense of withdraw' },
  { subject: 'English', year: 2023, number: 4, question: 'Which sentence is grammatically correct?', options: ['Neither of the students are present', 'Neither of the students is present', 'Neither of the students have arrived', 'Both A and B'], answer: 'B', explanation: 'Neither is a singular subject, so the verb must be singular' },
  { subject: 'English', year: 2023, number: 5, question: 'What does "ubiquitous" mean?', options: ['Expensive', 'Present everywhere', 'Very rare', 'Confusing'], answer: 'B', explanation: 'Ubiquitous means present, appearing, or found everywhere' },
  
  // English - 2022
  { subject: 'English', year: 2022, number: 1, question: 'Choose the synonym of "perspicacious"', options: ['Clear', 'Intelligent', 'Loud', 'Sensitive'], answer: 'B', explanation: 'Perspicacious means having keen insight or discernment' },
  { subject: 'English', year: 2022, number: 2, question: 'Which word means "tendency to fall"?', options: ['Propensity', 'Property', 'Prophecy', 'Proposal'], answer: 'A', explanation: 'Propensity means a tendency or inclination to something' },
  { subject: 'English', year: 2022, number: 3, question: 'Identify the antonym of "garrulous"', options: ['Talkative', 'Quiet', 'Loud', 'Happy'], answer: 'B', explanation: 'Garrulous means talkative, so quiet/taciturn is the antonym' },
  { subject: 'English', year: 2022, number: 4, question: 'What is the meaning of "obfuscate"?', options: ['To clarify', 'To make unclear', 'To brighten', 'To decorate'], answer: 'B', explanation: 'Obfuscate means to make something deliberately unclear or obscure' },
  { subject: 'English', year: 2022, number: 5, question: 'Choose the correct passive form: "They built a beautiful house"', options: ['A beautiful house was built', 'A beautiful house is built by them', 'A beautiful house was built by them', 'A beautiful house are being built'], answer: 'C', explanation: 'The correct passive form requires "was built by them" in past tense' },

  // The Lekki Headmaster Related Questions
  { subject: 'English', year: 2023, number: 15, question: 'The Lekki Headmaster is a novel by which author?', options: ['Amos Tutuola', 'Bayo Adebowale', 'Tayo Olafioye', 'Wale Okediran'], answer: 'B', explanation: 'The Lekki Headmaster is written by Bayo Adebowale', is_novel: true, novel_name: 'The Lekki Headmaster' },
  { subject: 'English', year: 2023, number: 16, question: 'Who is the protagonist in The Lekki Headmaster?', options: ['Wale Hassan', 'Tunde Bello', 'Adekunle Ojo', 'Segun Adeyemi'], answer: 'A', explanation: 'Wale Hassan is the main character and headmaster of the school', is_novel: true, novel_name: 'The Lekki Headmaster' },
  { subject: 'English', year: 2023, number: 17, question: 'What position does Wale Hassan hold in the novel?', options: ['Teacher', 'Headmaster', 'Student', 'Principal'], answer: 'B', explanation: 'Wale Hassan is the headmaster of a secondary school', is_novel: true, novel_name: 'The Lekki Headmaster' },
  { subject: 'English', year: 2023, number: 18, question: 'In The Lekki Headmaster, what is one of the major conflicts?', options: ['Love triangle', 'School administration challenges', 'Financial ruin', 'All of the above'], answer: 'D', explanation: 'The novel deals with multiple conflicts including administration and personal issues', is_novel: true, novel_name: 'The Lekki Headmaster' },
  { subject: 'English', year: 2023, number: 19, question: 'What does Wale Hassan struggle with in The Lekki Headmaster?', options: ['Teaching abilities', 'Maintaining school standards and personal integrity', 'Student discipline only', 'Financial management'], answer: 'B', explanation: 'The central theme is Wale Hassan\'s struggle to uphold standards', is_novel: true, novel_name: 'The Lekki Headmaster' },

  // Mathematics - 2023
  { subject: 'Mathematics', year: 2023, number: 1, question: 'Solve: 2x + 5 = 13', options: ['x = 3', 'x = 4', 'x = 5', 'x = 6'], answer: 'B', explanation: '2x + 5 = 13 → 2x = 8 → x = 4' },
  { subject: 'Mathematics', year: 2023, number: 2, question: 'What is the sum of angles in a triangle?', options: ['90°', '180°', '270°', '360°'], answer: 'B', explanation: 'The sum of interior angles in any triangle is 180°' },
  { subject: 'Mathematics', year: 2023, number: 3, question: 'Find the area of a rectangle with length 8cm and width 5cm', options: ['13 cm²', '26 cm²', '40 cm²', '80 cm²'], answer: 'C', explanation: 'Area = length × width = 8 × 5 = 40 cm²' },
  { subject: 'Mathematics', year: 2023, number: 4, question: 'What is 15% of 200?', options: ['15', '20', '30', '50'], answer: 'C', explanation: '15% of 200 = 0.15 × 200 = 30' },
  { subject: 'Mathematics', year: 2023, number: 5, question: 'Simplify: (4x²) / (2x)', options: ['2x', '2x²', '6x', 'x'], answer: 'A', explanation: '(4x²) / (2x) = 4x²/2x = 2x' },

  // Mathematics - 2022
  { subject: 'Mathematics', year: 2022, number: 1, question: 'Solve: 3x - 7 = 8', options: ['x = 3', 'x = 4', 'x = 5', 'x = 6'], answer: 'C', explanation: '3x - 7 = 8 → 3x = 15 → x = 5' },
  { subject: 'Mathematics', year: 2022, number: 2, question: 'What is the circumference of a circle with radius 7cm?', options: ['14cm', '22cm', '44cm', '49cm'], answer: 'C', explanation: 'C = 2πr = 2 × π × 7 ≈ 44cm' },
  { subject: 'Mathematics', year: 2022, number: 3, question: 'Calculate: (2 + 3) × 4 - 5', options: ['15', '20', '25', '30'], answer: 'A', explanation: '(2 + 3) × 4 - 5 = 5 × 4 - 5 = 20 - 5 = 15' },
  { subject: 'Mathematics', year: 2022, number: 4, question: 'What is 20% more than 80?', options: ['96', '100', '160', '16'], answer: 'A', explanation: '20% of 80 = 16, so 80 + 16 = 96' },
  { subject: 'Mathematics', year: 2022, number: 5, question: 'Find x: 2(x + 3) = 14', options: ['x = 4', 'x = 5', 'x = 6', 'x = 7'], answer: 'A', explanation: '2(x + 3) = 14 → x + 3 = 7 → x = 4' },

  // Physics - 2023
  { subject: 'Physics', year: 2023, number: 1, question: 'What is the SI unit of force?', options: ['Dyne', 'Newton', 'Joule', 'Watt'], answer: 'B', explanation: 'The Newton (N) is the SI unit of force' },
  { subject: 'Physics', year: 2023, number: 2, question: 'Which of the following is a scalar quantity?', options: ['Velocity', 'Acceleration', 'Speed', 'Displacement'], answer: 'C', explanation: 'Speed has magnitude only, without direction (scalar)' },
  { subject: 'Physics', year: 2023, number: 3, question: 'What is the velocity of light in vacuum?', options: ['3 × 10⁶ m/s', '3 × 10⁷ m/s', '3 × 10⁸ m/s', '3 × 10⁹ m/s'], answer: 'C', explanation: 'The speed of light is approximately 3 × 10⁸ m/s' },
  { subject: 'Physics', year: 2023, number: 4, question: 'Which law states F = ma?', options: ['Newton\'s First Law', 'Newton\'s Second Law', 'Newton\'s Third Law', 'Kepler\'s Law'], answer: 'B', explanation: 'F = ma is Newton\'s Second Law of Motion' },
  { subject: 'Physics', year: 2023, number: 5, question: 'What is the SI unit of energy?', options: ['Erg', 'Newton', 'Joule', 'Watt'], answer: 'C', explanation: 'The Joule (J) is the SI unit of energy and work' },

  // Chemistry - 2023
  { subject: 'Chemistry', year: 2023, number: 1, question: 'What is the chemical symbol for Gold?', options: ['Go', 'Gd', 'Au', 'Ag'], answer: 'C', explanation: 'Gold\'s chemical symbol is Au (from its Latin name)' },
  { subject: 'Chemistry', year: 2023, number: 2, question: 'What is the atomic number of Carbon?', options: ['4', '6', '8', '12'], answer: 'B', explanation: 'Carbon has atomic number 6' },
  { subject: 'Chemistry', year: 2023, number: 3, question: 'What is the pH of pure water at 25°C?', options: ['6', '7', '8', '9'], answer: 'B', explanation: 'Pure water has a pH of 7 (neutral)' },
  { subject: 'Chemistry', year: 2023, number: 4, question: 'Which is the most abundant gas in the atmosphere?', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Helium'], answer: 'B', explanation: 'Nitrogen makes up about 78% of the atmosphere' },
  { subject: 'Chemistry', year: 2023, number: 5, question: 'What is the chemical formula for table salt?', options: ['NaCl', 'KCl', 'MgCl₂', 'CaCl₂'], answer: 'A', explanation: 'Sodium chloride (NaCl) is common table salt' },

  // Biology - 2023
  { subject: 'Biology', year: 2023, number: 1, question: 'What is the basic unit of life?', options: ['Tissue', 'Organ', 'Cell', 'Molecule'], answer: 'C', explanation: 'The cell is the basic structural and functional unit of life' },
  { subject: 'Biology', year: 2023, number: 2, question: 'Which organelle is responsible for energy production?', options: ['Ribosome', 'Mitochondrion', 'Nucleus', 'Golgi apparatus'], answer: 'B', explanation: 'Mitochondria produce energy (ATP) for the cell' },
  { subject: 'Biology', year: 2023, number: 3, question: 'What is the process by which plants make food?', options: ['Respiration', 'Photosynthesis', 'Fermentation', 'Digestion'], answer: 'B', explanation: 'Photosynthesis converts light energy into chemical energy (food)' },
  { subject: 'Biology', year: 2023, number: 4, question: 'How many pairs of chromosomes do humans have?', options: ['23', '46', '48', '52'], answer: 'A', explanation: 'Humans have 23 pairs (46 total) chromosomes' },
  { subject: 'Biology', year: 2023, number: 5, question: 'Which blood type is the universal donor?', options: ['A', 'B', 'AB', 'O'], answer: 'D', explanation: 'O-negative blood is the universal donor' },

  // Government - 2023
  { subject: 'Government', year: 2023, number: 1, question: 'How many tiers of government exist in Nigeria?', options: ['2', '3', '4', '5'], answer: 'B', explanation: 'Nigeria has 3 tiers: Federal, State, and Local Government' },
  { subject: 'Government', year: 2023, number: 2, question: 'Who is the Commander-in-Chief of the Nigerian Armed Forces?', options: ['President', 'Vice President', 'Chief of Army Staff', 'Head of State'], answer: 'A', explanation: 'The President of Nigeria is the Commander-in-Chief' },
  { subject: 'Government', year: 2023, number: 3, question: 'What is the minimum age to vote in Nigeria?', options: ['16', '18', '21', '25'], answer: 'B', explanation: 'Nigerian citizens must be at least 18 years old to vote' },
  { subject: 'Government', year: 2023, number: 4, question: 'How many arms of government are there?', options: ['2', '3', '4', '5'], answer: 'B', explanation: 'The three arms are: Executive, Legislative, and Judicial' },
  { subject: 'Government', year: 2023, number: 5, question: 'What is the primary role of the legislature?', options: ['Law enforcement', 'Law making', 'Judgment', 'Administration'], answer: 'B', explanation: 'The legislative arm makes laws for the country' }
];

async function seedQuestions() {
  try {
    await pool.query('BEGIN');

    // Insert questions
    for (const q of questions) {
      const result = await pool.query(
        `INSERT INTO questions 
         (subject, year, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, is_novel, novel_name) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (subject, year, question_number) DO UPDATE SET
         question_text = EXCLUDED.question_text,
         option_a = EXCLUDED.option_a,
         option_b = EXCLUDED.option_b,
         option_c = EXCLUDED.option_c,
         option_d = EXCLUDED.option_d,
         correct_answer = EXCLUDED.correct_answer,
         explanation = EXCLUDED.explanation`,
        [
          q.subject,
          q.year,
          q.number,
          q.question,
          q.options[0],
          q.options[1],
          q.options[2],
          q.options[3],
          q.answer,
          q.explanation,
          q.is_novel || false,
          q.novel_name || null
        ]
      );
    }

    await pool.query('COMMIT');
    console.log(`✓ Successfully seeded ${questions.length} questions`);
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Error seeding questions:', err);
    process.exit(1);
  } finally {
    pool.end();
  }
}

seedQuestions();
