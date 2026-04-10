const fs = require('fs');
const pdf = require('pdf-parse');
const textAnalyzer = require('./textAnalyzer');

class DocumentAnalyzer {
  async analyze(file) {
    if (!file) return { type: 'document', riskScore: 0, threats: [], indicators: [], details: {} };
    
    try {
      const dataBuffer = fs.readFileSync(file.path);
      let extractedText = '';

      // PDF Parsing
      if (file.mimetype === 'application/pdf') {
        const data = await pdf(dataBuffer);
        extractedText = data.text;
      } else {
        // Fallback for TXT or other raw formats
        extractedText = dataBuffer.toString('utf8');
      }

      if (extractedText.trim().length > 0) {
        // Pass to our powerful text analyzer (OpenAI)
        const textResult = await textAnalyzer.analyze(extractedText.substring(0, 5000)); // Limit to first 5k chars to save tokens
        return {
          type: 'document',
          riskScore: textResult.riskScore,
          threats: textResult.threats,
          indicators: textResult.indicators,
          details: {
            fileName: file.originalname,
            source: 'OpenAI + DocumentParser',
            message: 'Extract text analyzed successfully'
          }
        };
      } else {
        return { type: 'document', riskScore: 0, threats: [], indicators: [], details: { message: 'No readable text found in document' } };
      }

    } catch (e) {
      console.error('Document analysis error:', e.message);
      return { type: 'document', riskScore: 0, threats: [{type: 'PARSE_ERROR', description: 'Failed to read document content'}], indicators: [], details: {} };
    }
  }
}

module.exports = new DocumentAnalyzer();
