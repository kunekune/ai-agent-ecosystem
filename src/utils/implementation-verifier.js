const fs = require('fs-extra');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

/**
 * Implementation Verification Protocol (IVP) for AI System
 * Prevents false "implementation complete" reports
 */
class ImplementationVerifier {
  constructor() {
    this.verifierScript = '/home/kunekune/bin/implementation_verifier.sh';
    this.logFile = '/home/kunekune/.openclaw/logs/ai_implementation_verification.log';
  }

  /**
   * Mandatory verification before any implementation report
   * @param {string} claimedStatus - What the AI claims to have done
   * @param {string} featureName - Name of the feature being reported
   * @param {string} configFile - Path to config file (if applicable)
   * @returns {Promise<Object>} Verification result
   */
  async verifyImplementationReport(claimedStatus, featureName, configFile = null) {
    const timestamp = new Date().toISOString();
    
    try {
      // Call external verification script
      const command = configFile 
        ? `${this.verifierScript} verify "${claimedStatus}" "${featureName}" "${configFile}"`
        : `${this.verifierScript} verify "${claimedStatus}" "${featureName}"`;
      
      const { stdout, stderr } = await execAsync(command);
      
      const isValid = !stdout.includes('INVALID');
      const missingRequirements = isValid ? [] : this.extractMissingRequirements(stdout);
      
      const result = {
        timestamp,
        claimedStatus,
        featureName,
        isValid,
        missingRequirements,
        actualStatus: this.extractActualStatus(stdout),
        rawOutput: stdout.trim()
      };
      
      // Log verification attempt
      await this.logVerification(result);
      
      return result;
      
    } catch (error) {
      const errorResult = {
        timestamp,
        claimedStatus,
        featureName, 
        isValid: false,
        error: error.message,
        missingRequirements: ['VERIFICATION_SYSTEM_ERROR']
      };
      
      await this.logVerification(errorResult);
      return errorResult;
    }
  }

  /**
   * Generate accurate implementation status report
   * @param {string} featureName - Name of the feature
   * @param {string} configFile - Path to config file
   * @returns {Promise<string>} Accurate status description
   */
  async generateAccurateReport(featureName, configFile = null) {
    try {
      const command = configFile
        ? `${this.verifierScript} report "${featureName}" "${configFile}"`
        : `${this.verifierScript} report "${featureName}"`;
      
      const { stdout } = await execAsync(command);
      return stdout.trim();
      
    } catch (error) {
      return `❓ ${featureName} status verification FAILED: ${error.message}`;
    }
  }

  /**
   * Mandatory check before allowing "implementation complete" responses
   * This should be called by all AI models before claiming implementation
   * @param {string} responseText - The AI's intended response
   * @returns {Promise<Object>} Verification result and corrected response
   */
  async mandatoryImplementationCheck(responseText, featureName, configFile = null) {
    // Detect implementation claims in response
    const implementationClaims = this.detectImplementationClaims(responseText);
    
    if (implementationClaims.length === 0) {
      // No implementation claims, response is safe
      return {
        verified: true,
        originalResponse: responseText,
        correctedResponse: responseText,
        warnings: []
      };
    }
    
    // Verify each implementation claim
    const verificationResults = [];
    
    for (const claim of implementationClaims) {
      const result = await this.verifyImplementationReport(claim, featureName, configFile);
      verificationResults.push(result);
    }
    
    const hasInvalidClaims = verificationResults.some(r => !r.isValid);
    
    if (hasInvalidClaims) {
      // Generate corrected response with accurate status
      const accurateStatus = await this.generateAccurateReport(featureName, configFile);
      
      const correctedResponse = this.correctImplementationResponse(
        responseText,
        implementationClaims,
        accurateStatus,
        verificationResults
      );
      
      return {
        verified: false,
        originalResponse: responseText,
        correctedResponse,
        verificationResults,
        warnings: ['INVALID_IMPLEMENTATION_CLAIMS_DETECTED']
      };
    }
    
    return {
      verified: true,
      originalResponse: responseText,
      correctedResponse: responseText,
      verificationResults
    };
  }

  /**
   * Detect implementation-related claims in text
   * @param {string} text - Text to analyze
   * @returns {Array<string>} Array of implementation claims found
   */
  detectImplementationClaims(text) {
    const implementationPatterns = [
      /実装完了|implementation complete|implemented successfully/gi,
      /システム展開|system deployed|deployment complete/gi,
      /機能有効|feature active|feature enabled/gi,
      /稼働中|operational|running with/gi
    ];
    
    const claims = [];
    
    for (const pattern of implementationPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        claims.push(...matches);
      }
    }
    
    return [...new Set(claims)]; // Remove duplicates
  }

  /**
   * Correct implementation response with accurate information
   * @param {string} originalResponse - Original response text
   * @param {Array<string>} invalidClaims - Invalid claims detected
   * @param {string} accurateStatus - Actual accurate status
   * @param {Array<Object>} verificationResults - Verification results
   * @returns {string} Corrected response
   */
  correctImplementationResponse(originalResponse, invalidClaims, accurateStatus, verificationResults) {
    let correctedResponse = originalResponse;
    
    // Replace invalid claims with accurate status
    for (const claim of invalidClaims) {
      correctedResponse = correctedResponse.replace(
        new RegExp(claim, 'gi'),
        `${accurateStatus} (IVP Corrected)`
      );
    }
    
    // Add verification warning
    correctedResponse += `\n\n⚠️ **IVP Alert**: Original response contained unverified implementation claims. Status corrected based on actual system verification.`;
    
    return correctedResponse;
  }

  /**
   * Extract missing requirements from verification output
   * @param {string} output - Verification script output
   * @returns {Array<string>} Missing requirements
   */
  extractMissingRequirements(output) {
    const match = output.match(/Missing (.+)/);
    if (match) {
      return match[1].split(' ');
    }
    return [];
  }

  /**
   * Extract actual status from verification output
   * @param {string} output - Verification script output
   * @returns {string} Actual status
   */
  extractActualStatus(output) {
    const lines = output.split('\n');
    const statusLine = lines.find(line => line.includes('📁') || line.includes('🔄') || line.includes('✅'));
    return statusLine ? statusLine.trim() : 'Status unclear';
  }

  /**
   * Log verification attempt
   * @param {Object} verificationResult - Result of verification
   */
  async logVerification(verificationResult) {
    const logEntry = {
      timestamp: verificationResult.timestamp,
      type: 'IMPLEMENTATION_VERIFICATION',
      ...verificationResult
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    
    try {
      await fs.ensureDir('/home/kunekune/.openclaw/logs');
      await fs.appendFile(this.logFile, logLine);
    } catch (error) {
      console.error('Failed to log verification result:', error);
    }
  }
}

module.exports = ImplementationVerifier;