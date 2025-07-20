#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * QuickSlot Extension Build Script
 * Generates manifest.json from manifest.template.json using environment variables
 */

function loadEnvironmentVariables() {
    const envPath = path.join(__dirname, '.env');
    const env = {};
    
    // Try to load .env file
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split('\n');
        
        lines.forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('#')) {
                const [key, ...valueParts] = line.split('=');
                if (key && valueParts.length > 0) {
                    env[key.trim()] = valueParts.join('=').trim();
                }
            }
        });
    }
    
    // Override with process environment variables
    Object.keys(process.env).forEach(key => {
        if (key.startsWith('CLIENT_ID')) {
            env[key] = process.env[key];
        }
    });
    
    return env;
}

function validateEnvironment(env) {
    const errors = [];
    
    if (!env.CLIENT_ID) {
        errors.push('CLIENT_ID is required but not set');
    } else if (!env.CLIENT_ID.includes('.apps.googleusercontent.com')) {
        errors.push('CLIENT_ID should be a valid Google OAuth2 client ID ending with .apps.googleusercontent.com');
    }
    
    if (errors.length > 0) {
        console.error('❌ Environment validation failed:');
        errors.forEach(error => console.error(`   ${error}`));
        console.error('\n💡 Please check your .env file or set environment variables');
        console.error('   Example: CLIENT_ID=your-client-id.apps.googleusercontent.com');
        process.exit(1);
    }
}

function buildManifest() {
    console.log('🔧 Building QuickSlot extension manifest...');
    
    // Load environment variables
    const env = loadEnvironmentVariables();
    console.log(`📝 Loaded environment variables`);
    
    // Validate environment
    validateEnvironment(env);
    console.log('✅ Environment validation passed');
    
    // Read template
    const templatePath = path.join(__dirname, 'manifest.template.json');
    if (!fs.existsSync(templatePath)) {
        console.error('❌ manifest.template.json not found');
        process.exit(1);
    }
    
    let template = fs.readFileSync(templatePath, 'utf8');
    console.log('📖 Read manifest template');
    
    // Replace placeholders
    template = template.replace(/\{\{CLIENT_ID\}\}/g, env.CLIENT_ID);
    
    // Validate JSON
    try {
        JSON.parse(template);
    } catch (error) {
        console.error('❌ Generated manifest.json is not valid JSON:', error.message);
        process.exit(1);
    }
    
    // Write manifest.json
    const manifestPath = path.join(__dirname, 'manifest.json');
    fs.writeFileSync(manifestPath, template);
    console.log('📝 Generated manifest.json');
    
    // Success
    console.log('✅ Build completed successfully!');
    console.log(`   Client ID: ${env.CLIENT_ID.substring(0, 20)}...`);
    console.log('   📄 manifest.json is ready for Chrome extension loading');
}

// Run the build
if (require.main === module) {
    try {
        buildManifest();
    } catch (error) {
        console.error('❌ Build failed:', error.message);
        process.exit(1);
    }
}

module.exports = { buildManifest };
