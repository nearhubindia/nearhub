#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const csvPath =
  '/media/pavanprasad/a94c88ad-0b85-442a-8c22-74ac77e8f907/pavanprasad/Documents/Downloads/pincode_database.csv';
const outputPath = path.join(__dirname, '../data/pincodes.json');

// Ensure output directory exists
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const pincodeMap = new Map();

async function importPincodes() {
  try {
    console.log('Starting pincode import...');

    const fileStream = fs.createReadStream(csvPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let lineCount = 0;
    let isHeader = true;

    for await (const line of rl) {
      lineCount++;

      if (isHeader) {
        isHeader = false;
        console.log(`Header: ${line.substring(0, 100)}...`);
        continue;
      }

      if (lineCount % 10000 === 0) {
        console.log(`Processed ${lineCount} lines...`);
      }

      // Parse CSV line (handle quoted fields)
      const fields = parseCSVLine(line);

      if (fields.length < 11) continue;

      const pincode = fields[4]?.trim() || '';
      const officeName = fields[3]?.trim() || '';
      const district = fields[7]?.trim() || '';
      const state = fields[8]?.trim() || '';
      const latitude = parseFloat(fields[9]) || null;
      const longitude = parseFloat(fields[10]) || null;

      // Skip invalid pincodes or missing coordinates
      if (!pincode || pincode === 'NA' || latitude === null || longitude === null) {
        continue;
      }

      // Store pincode data (avoid duplicates, keep first entry)
      if (!pincodeMap.has(pincode)) {
        pincodeMap.set(pincode, {
          pincode,
          city: officeName,
          state: normalizeState(state),
          district: normalizeDistrict(district),
          latitude,
          longitude,
          region: getRegionByState(state),
        });
      }
    }

    console.log(`\nTotal lines processed: ${lineCount}`);
    console.log(`Unique pincodes found: ${pincodeMap.size}`);

    // Convert to array and sort
    const pincodeArray = Array.from(pincodeMap.values()).sort(
      (a, b) => parseInt(a.pincode) - parseInt(b.pincode)
    );

    // Save to JSON
    fs.writeFileSync(outputPath, JSON.stringify(pincodeArray, null, 2));
    console.log(`\n✅ Pincodes saved to: ${outputPath}`);
    console.log(`Total pincodes imported: ${pincodeArray.length}`);

    // Generate TypeScript code
    generateTypeScriptCode(pincodeArray);
  } catch (error) {
    console.error('Error importing pincodes:', error);
    process.exit(1);
  }
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result.map((field) => field.replace(/^"|"$/g, ''));
}

function normalizeState(state) {
  const stateMap = {
    TELANGANA: 'Telangana',
    'ANDHRA PRADESH': 'Andhra Pradesh',
    MAHARASHTRA: 'Maharashtra',
    KARNATAKA: 'Karnataka',
    'TAMIL NADU': 'Tamil Nadu',
    DELHI: 'Delhi',
    'UTTAR PRADESH': 'Uttar Pradesh',
    'WEST BENGAL': 'West Bengal',
    PUNJAB: 'Punjab',
    HARYANA: 'Haryana',
    'MADHYA PRADESH': 'Madhya Pradesh',
    RAJASTHAN: 'Rajasthan',
    BIHAR: 'Bihar',
    JHARKHAND: 'Jharkhand',
    ODISHA: 'Odisha',
    KERALA: 'Kerala',
    ASSAM: 'Assam',
    UTTARAKHAND: 'Uttarakhand',
    'HIMACHAL PRADESH': 'Himachal Pradesh',
    'JAMMU & KASHMIR': 'Jammu & Kashmir',
    LADAKH: 'Ladakh',
    TRIPURA: 'Tripura',
    MANIPUR: 'Manipur',
    NAGALAND: 'Nagaland',
    MIZORAM: 'Mizoram',
    MEGHALAYA: 'Meghalaya',
    CHHATTISGARH: 'Chhattisgarh',
    TELANGANA: 'Telangana',
  };
  return stateMap[state?.toUpperCase()] || state;
}

function normalizeDistrict(district) {
  return district
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function getRegionByState(state) {
  const regionMap = {
    TELANGANA: 'South',
    'ANDHRA PRADESH': 'South',
    KARNATAKA: 'South',
    'TAMIL NADU': 'South',
    KERALA: 'South',
    MAHARASHTRA: 'West',
    GUJARAT: 'West',
    RAJASTHAN: 'West',
    GOA: 'West',
    DELHI: 'North',
    HARYANA: 'North',
    PUNJAB: 'North',
    'HIMACHAL PRADESH': 'North',
    UTTARAKHAND: 'North',
    'JAMMU & KASHMIR': 'North',
    'UTTAR PRADESH': 'North',
    'WEST BENGAL': 'East',
    BIHAR: 'East',
    JHARKHAND: 'East',
    ODISHA: 'East',
    ASSAM: 'Northeast',
    MEGHALAYA: 'Northeast',
    TRIPURA: 'Northeast',
    MANIPUR: 'Northeast',
    NAGALAND: 'Northeast',
    MIZORAM: 'Northeast',
  };
  return regionMap[state?.toUpperCase()] || 'Central';
}

function generateTypeScriptCode(pincodeArray) {
  const tsCode = `// Auto-generated pincode database from import script
// Total pincodes: ${pincodeArray.length}
// Generated: ${new Date().toISOString()}

export interface PincodeData {
  pincode: string;
  city: string;
  state: string;
  district: string;
  latitude: number;
  longitude: number;
  region: string;
}

export const PINCODE_DATABASE: PincodeData[] = ${JSON.stringify(pincodeArray.slice(0, 100), null, 2).slice(0, -2)}
  // ... ${pincodeArray.length - 100} more entries
];
`;

  const tsPath = path.join(__dirname, '../data/pincodes.ts');
  fs.writeFileSync(tsPath, tsCode);
  console.log(`\n✅ TypeScript sample code saved to: ${tsPath}`);
}

importPincodes();
