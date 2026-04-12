#!/usr/bin/env node

/**
 * Production Readiness Validation Script
 * Automated checks for critical production requirements
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class ProductionValidator {
  constructor() {
    this.checks = [];
    this.passed = 0;
    this.failed = 0;
  }

  log(message, status = 'INFO') {
    const colors = {
      'PASS': '\x1b[32m✓',
      'FAIL': '\x1b[31m✗',
      'WARN': '\x1b[33m⚠',
      'INFO': '\x1b[36mℹ'
    };
    const reset = '\x1b[0m';
    console.log(`${colors[status] || ''} ${message}${reset}`);
  }

  async checkFileExists(filePath, description) {
    try {
      await fs.access(filePath);
      this.log(`${description}: Found`, 'PASS');
      this.passed++;
      return true;
    } catch {
      this.log(`${description}: Missing`, 'FAIL');
      this.failed++;
      return false;
    }
  }

  async checkFileContains(filePath, searchString, description) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      if (content.includes(searchString)) {
        this.log(`${description}: Present`, 'PASS');
        this.passed++;
        return true;
      } else {
        this.log(`${description}: Missing`, 'FAIL');
        this.failed++;
        return false;
      }
    } catch {
      this.log(`${description}: File not readable`, 'FAIL');
      this.failed++;
      return false;
    }
  }

  checkEnvironmentVariable(varName, description) {
    if (process.env[varName]) {
      this.log(`${description}: Set`, 'PASS');
      this.passed++;
      return true;
    } else {
      this.log(`${description}: Not set`, 'WARN');
      return false;
    }
  }

  async runSyntaxCheck(filePath, description) {
    try {
      execSync(`node --check "${filePath}"`, { stdio: 'pipe' });
      this.log(`${description}: Valid syntax`, 'PASS');
      this.passed++;
      return true;
    } catch {
      this.log(`${description}: Syntax errors`, 'FAIL');
      this.failed++;
      return false;
    }
  }

  async validatePackageJson() {
    const packagePath = path.join(process.cwd(), 'package.json');
    const exists = await this.checkFileExists(packagePath, 'package.json exists');

    if (exists) {
      await this.checkFileContains(packagePath, '"helmet"', 'Security: Helmet dependency');
      await this.checkFileContains(packagePath, '"express-rate-limit"', 'Security: Rate limiting dependency');
      await this.checkFileContains(packagePath, '"firebase-admin"', 'Database: Firebase Admin SDK');
    }
  }

  async validateSourceFiles() {
    const srcDir = path.join(process.cwd(), 'src');

    // Check main files exist
    await this.checkFileExists(path.join(srcDir, 'app.js'), 'Main application file');
    await this.checkFileExists(path.join(srcDir, 'config', 'firebase.js'), 'Firebase configuration');
    await this.checkFileExists(path.join(srcDir, 'monitoring.js'), 'Monitoring system');

    // Syntax checks
    await this.runSyntaxCheck(path.join(srcDir, 'app.js'), 'app.js syntax');
    await this.runSyntaxCheck(path.join(srcDir, 'monitoring.js'), 'monitoring.js syntax');
    await this.runSyntaxCheck(path.join(srcDir, 'trust-score.js'), 'trust-score.js syntax');
  }

  async validateSecurity() {
    const appPath = path.join(process.cwd(), 'src', 'app.js');

    await this.checkFileContains(appPath, 'helmet(', 'Security: Helmet middleware');
    await this.checkFileContains(appPath, 'cors(', 'Security: CORS configuration');
    await this.checkFileContains(appPath, 'rateLimit(', 'Security: Rate limiting');
    await this.checkFileContains(appPath, 'requireAdmin', 'Security: Admin authorization');
    await this.checkFileContains(appPath, 'ensureVerifiedUser', 'Security: User verification');
  }

  async validateMonitoring() {
    const appPath = path.join(process.cwd(), 'src', 'app.js');
    const monitoringPath = path.join(process.cwd(), 'src', 'monitoring.js');

    await this.checkFileContains(appPath, 'initializeMonitoring', 'Monitoring: Initialization');
    await this.checkFileContains(appPath, 'trackApiFailure', 'Monitoring: API failure tracking');
    await this.checkFileContains(monitoringPath, 'trackOtpError', 'Monitoring: OTP error tracking');
    await this.checkFileContains(monitoringPath, 'trackBookingFailure', 'Monitoring: Booking failure tracking');
    await this.checkFileContains(monitoringPath, 'trackSessionIssue', 'Monitoring: Session issue tracking');
  }

  async validateEnvironment() {
    this.checkEnvironmentVariable('PORT', 'PORT environment variable');
    this.checkEnvironmentVariable('NODE_ENV', 'NODE_ENV environment variable');

    // Firebase environment variables
    this.checkEnvironmentVariable('FIREBASE_PROJECT_ID', 'Firebase Project ID');
    this.checkEnvironmentVariable('FIREBASE_PRIVATE_KEY', 'Firebase Private Key');
    this.checkEnvironmentVariable('FIREBASE_CLIENT_EMAIL', 'Firebase Client Email');
  }

  async validateLogs() {
    const logsDir = path.join(process.cwd(), 'logs');
    await this.checkFileExists(logsDir, 'Logs directory exists');
    await this.checkFileExists(path.join(logsDir, 'monitoring.log'), 'Monitoring log file');
  }

  async runAllChecks() {
    console.log('🔍 PRODUCTION READINESS VALIDATION\n');
    console.log('=' .repeat(50));

    await this.validatePackageJson();
    console.log('');

    await this.validateSourceFiles();
    console.log('');

    await this.validateSecurity();
    console.log('');

    await this.validateMonitoring();
    console.log('');

    await this.validateEnvironment();
    console.log('');

    await this.validateLogs();
    console.log('');

    // Summary
    console.log('=' .repeat(50));
    console.log(`📊 VALIDATION SUMMARY:`);
    console.log(`   ✅ Passed: ${this.passed}`);
    console.log(`   ❌ Failed: ${this.failed}`);
    console.log(`   📈 Success Rate: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`);

    if (this.failed === 0) {
      console.log('\n🎉 ALL AUTOMATED CHECKS PASSED!');
      console.log('Ready for manual checklist review.');
    } else {
      console.log(`\n⚠️  ${this.failed} checks failed.`);
      console.log('Review and fix before proceeding.');
    }

    return this.failed === 0;
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new ProductionValidator();
  validator.runAllChecks().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

module.exports = ProductionValidator;