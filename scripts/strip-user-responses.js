import { readdir, readFile, mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const HISTORY_DIR = join(__dirname, '..', '.specstory', 'history');
const OUTPUT_DIR = join(__dirname, '..', '.specstory', 'stripped_history');

/**
 * Extracts user responses from markdown chat history
 * User responses are between `_**User` and `_**Agent` markers
 */
function extractUserResponses(content) {
  const userResponses = [];
  const lines = content.split('\n');
  
  let currentUserResponse = null;
  let inUserSection = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this is a User marker
    if (line.startsWith('_**User')) {
      inUserSection = true;
      currentUserResponse = [];
      continue;
    }
    
    // Check if this is an Agent marker (end of user section)
    if (line.startsWith('_**Agent')) {
      if (inUserSection && currentUserResponse.length > 0) {
        // Trim trailing empty lines
        while (currentUserResponse.length > 0 && currentUserResponse[currentUserResponse.length - 1].trim() === '') {
          currentUserResponse.pop();
        }
        
        if (currentUserResponse.length > 0) {
          userResponses.push(currentUserResponse.join('\n'));
        }
      }
      inUserSection = false;
      currentUserResponse = null;
      continue;
    }
    
    // If we're in a user section, collect the line
    if (inUserSection && currentUserResponse !== null) {
      currentUserResponse.push(line);
    }
  }
  
  // Handle case where file ends with a user section
  if (inUserSection && currentUserResponse && currentUserResponse.length > 0) {
    while (currentUserResponse.length > 0 && currentUserResponse[currentUserResponse.length - 1].trim() === '') {
      currentUserResponse.pop();
    }
    
    if (currentUserResponse.length > 0) {
      userResponses.push(currentUserResponse.join('\n'));
    }
  }
  
  return userResponses.join('\n\n---\n\n');
}

/**
 * Processes all markdown files in the history directory
 */
async function processFiles() {
  try {
    // Create output directory if it doesn't exist
    await mkdir(OUTPUT_DIR, { recursive: true });
    
    // Read all files from history directory
    const files = await readdir(HISTORY_DIR);
    const mdFiles = files.filter(file => file.endsWith('.md'));
    
    console.log(`Found ${mdFiles.length} markdown files to process`);
    
    let processedCount = 0;
    
    for (const file of mdFiles) {
      const inputPath = join(HISTORY_DIR, file);
      const outputPath = join(OUTPUT_DIR, file);
      
      try {
        const content = await readFile(inputPath, 'utf-8');
        const userResponses = extractUserResponses(content);
        
        if (userResponses.trim()) {
          await writeFile(outputPath, userResponses, 'utf-8');
          processedCount++;
          console.log(`✓ Processed: ${file}`);
        } else {
          console.log(`⚠ No user responses found in: ${file}`);
        }
      } catch (error) {
        console.error(`✗ Error processing ${file}:`, error.message);
      }
    }
    
    console.log(`\nCompleted! Processed ${processedCount} files.`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

processFiles();
