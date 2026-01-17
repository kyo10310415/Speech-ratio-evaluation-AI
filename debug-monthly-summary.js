/**
 * Debug script to check monthly_tutors data
 * Run on Render: node debug-monthly-summary.js
 */

import { config } from './src/config/env.js';
import { sheetsService } from './src/services/sheetsService.js';

async function debugMonthlySummary() {
  try {
    console.log('🔍 Debugging Monthly Summary Issue...\n');
    
    await sheetsService.initialize();
    console.log('✅ Sheets service initialized\n');
    
    // Check monthly_lessons
    console.log('=== Checking monthly_lessons ===');
    const lessonsData = await sheetsService.getSheetData('monthly_lessons');
    
    if (lessonsData.length <= 1) {
      console.log('❌ ERROR: No lesson data found in monthly_lessons sheet');
      console.log('📝 Action: Run monthly job first: node src/jobs/monthly.js 2026-01-15\n');
      return;
    }
    
    const lessonHeaders = lessonsData[0];
    console.log(`✅ Found ${lessonsData.length - 1} lessons`);
    console.log('Headers:', lessonHeaders.slice(0, 15).join(', '));
    
    // Analyze first lesson
    const firstLesson = lessonsData[1];
    const tutorIdx = lessonHeaders.indexOf('tutor_name');
    const durationIdx = lessonHeaders.indexOf('duration_sec');
    const talkRatioIdx = lessonHeaders.indexOf('talk_ratio_tutor');
    const silenceIdx = lessonHeaders.indexOf('student_silence_over_15s_count');
    const statusIdx = lessonHeaders.indexOf('status');
    
    console.log('\n📊 First Lesson Sample:');
    console.log(`  Tutor: ${firstLesson[tutorIdx]}`);
    console.log(`  Duration: ${firstLesson[durationIdx]} sec`);
    console.log(`  Talk Ratio: ${firstLesson[talkRatioIdx]}`);
    console.log(`  Silence 15s: ${firstLesson[silenceIdx]}`);
    console.log(`  Status: ${firstLesson[statusIdx]}`);
    
    // Count OK vs ERROR
    let okCount = 0;
    let errorCount = 0;
    for (let i = 1; i < lessonsData.length; i++) {
      if (lessonsData[i][statusIdx] === 'OK') okCount++;
      else if (lessonsData[i][statusIdx] === 'ERROR') errorCount++;
    }
    console.log(`\n✅ OK lessons: ${okCount}`);
    console.log(`❌ ERROR lessons: ${errorCount}`);
    
    // Check monthly_tutors
    console.log('\n=== Checking monthly_tutors ===');
    const tutorsData = await sheetsService.getSheetData('monthly_tutors');
    
    if (tutorsData.length <= 1) {
      console.log('❌ ERROR: No tutor data found in monthly_tutors sheet');
      console.log('📝 Action: The aggregation might have failed\n');
      return;
    }
    
    const tutorHeaders = tutorsData[0];
    console.log(`✅ Found ${tutorsData.length - 1} tutor records`);
    console.log('Headers:', tutorHeaders.join(', '));
    
    // Check data types and values
    console.log('\n📊 Tutor Summary Data:');
    for (let i = 1; i < Math.min(4, tutorsData.length); i++) {
      const row = tutorsData[i];
      console.log(`\nTutor ${i}:`);
      console.log(`  Month: ${row[0]} (type: ${typeof row[0]})`);
      console.log(`  Name: ${row[1]} (type: ${typeof row[1]})`);
      console.log(`  Lessons: ${row[2]} (type: ${typeof row[2]})`);
      console.log(`  Avg Talk Ratio: ${row[3]} (type: ${typeof row[3]})`);
      console.log(`  Avg Silence: ${row[4]} (type: ${typeof row[4]})`);
      console.log(`  Total Duration: ${row[5]} (type: ${typeof row[5]})`);
      
      // Check if values are strings instead of numbers
      if (typeof row[3] === 'string') {
        console.log(`  ⚠️  WARNING: Talk ratio is string, should be number`);
        console.log(`  🔄 Parsed: ${parseFloat(row[3])}`);
      }
    }
    
    // Check API response format
    console.log('\n=== Testing API Response ===');
    const summary = tutorsData.slice(1).map((row) => ({
      month: row[tutorHeaders.indexOf('date_jst')],
      tutor_name: row[tutorHeaders.indexOf('tutor_name')],
      lessons_count: parseInt(row[tutorHeaders.indexOf('lessons_count')] || 0),
      avg_tutor_talk_ratio: parseFloat(row[tutorHeaders.indexOf('avg_tutor_talk_ratio')] || 0),
      avg_silence_15s_count: parseFloat(row[tutorHeaders.indexOf('avg_silence_15s_count')] || 0),
      total_duration_min: parseFloat(row[tutorHeaders.indexOf('total_duration_min')] || 0),
    }));
    
    console.log('\n📋 API Response Preview:');
    console.log(JSON.stringify(summary[0], null, 2));
    
    if (summary[0].avg_tutor_talk_ratio === 0) {
      console.log('\n❌ PROBLEM DETECTED: avg_tutor_talk_ratio is 0');
      console.log('📝 Possible causes:');
      console.log('   1. Data in sheet is stored as string "0" or empty');
      console.log('   2. Header mismatch (column index wrong)');
      console.log('   3. Aggregation function not called correctly');
      console.log('\n🔧 Solution: Re-run monthly job to regenerate data');
      console.log('   cd /opt/render/project/src');
      console.log('   rm -f temp/monthly-job.lock');
      console.log('   node src/jobs/monthly.js 2026-01-15');
    } else {
      console.log('\n✅ Data looks good!');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugMonthlySummary();
