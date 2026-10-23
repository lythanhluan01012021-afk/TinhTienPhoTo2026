const fs = require('fs');
const seed = fs.readFileSync('src/data/tuan7_seed.json', 'utf8');

const codeToAppend = `
export const DEFAULT_BILLING_ITEMS_TUAN_7 = ${seed};

export const DEFAULT_DEBTS_TUAN_7 = {
  '10A10': { amount: 51300, note: 'THIẾU TUẦN 6', updatedAt: '23/10/2026' },
  '10A3': { amount: 102600, note: 'THIẾU TUẦN 6', updatedAt: '23/10/2026' },
  '10A7': { amount: 153900, note: 'THIẾU TUẦN 6', updatedAt: '23/10/2026' },
  '11A3': { amount: 127680, note: 'THIẾU TUẦN 6', updatedAt: '23/10/2026' },
  '11A7': { amount: 31160, note: 'THIẾU TUẦN 6', updatedAt: '23/10/2026' },
  '11A10': { amount: 28800, note: 'THIẾU TUẦN 6', updatedAt: '23/10/2026' }
};
`;

fs.appendFileSync('src/data/defaultData.js', codeToAppend);
console.log('Successfully appended seed data to src/data/defaultData.js');
