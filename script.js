#!/usr/bin/env node

const fs = require('fs');
const util = require('util');
const file = process.argv[2];
const readline = require('readline');
let { pdfToText } = require('pdf-to-text');

pdfToText = util.promisify(pdfToText);

if (!file) {
  console.log(
    'Please specify a proxy voting record PDF file to extract data from.'
  );
  process.exit(1);
}

// Temporarily holds each issuer
let tempEntryObj = {};
// Array of issuers and their corresponding data
const extractedEntries = [];

// Converts PDF to TEXT for easier parsing
(async function main() {
  const data = await pdfToText(file, {});
  fs.writeFileSync('results.txt', data);

  // Reads generated TEXT file
  const readInterface = readline.createInterface({
    input: fs.createReadStream('results.txt'),
    output: null,
    console: false
  });

  readInterface.on('line', line => {
    processLine(line.toString());
  });

  readInterface.on('close', () => {
    fs.unlinkSync('results.txt');
    fs.writeFileSync('results.json', JSON.stringify(extractedEntries));
    console.log(
      'results.json file has been generated in your current directory.'
    );
  });
})();

/**
 * Extracts specific data from a single line
 * @param {String} line line to extract data from
 * @returns {void}
 */
function processLine(line) {
  // Each issuer object begins with line containing TICKER and CUSIP
  if (line.includes('TICKER')) {
    // Prevents pushing empty object
    if (tempEntryObj.ticker) {
      extractedEntries.push(tempEntryObj);
    }

    // Erase the previous issuer and prepare for the next one
    tempEntryObj = {};
    const [ticker, cusip] = line.split(/[ ]+/).filter((str, i) => i % 2 !== 0);

    tempEntryObj.ticker = ticker;
    tempEntryObj.cusip = cusip;
  } else if (line.includes('MEETING DATE:')) {
    const meetingDate = line.split(/[ ]+/)[2];
    tempEntryObj.meetingDate = meetingDate;
  } else if (line.includes('PROPOSAL #')) {
    const entry = line
      .split(/(  )+/)
      .map(word => word.trim())
      .filter(word => word.length !== 0);

    const [proposal, proposedBy, voted, voteCast, forAgainstMgmt] = entry;

    if (!tempEntryObj.proposals) {
      tempEntryObj.proposals = [];
    }

    tempEntryObj.proposals.push({
      title: proposal,
      proposedBy,
      voted: voted === 'YES',
      voteCast,
      forAgainstMgmt
    });
  }
}
