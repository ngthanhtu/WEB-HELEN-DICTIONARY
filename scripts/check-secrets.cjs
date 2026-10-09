#!/usr/bin/env node
'use strict';
// Report locations and rule names only. Never log a matching value or source line.
const {spawnSync} = require('node:child_process');
const path = require('node:path');

const rules = [
  ['ElevenLabs key', /\bsk_[A-Za-z0-9]{32,}\b/g],
  ['Google API key', /\bAIza[A-Za-z0-9_-]{35}\b/g],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/g],
  ['Private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g]
];
const placeholder = /^(?:test-only|test-key|dummy|fake|example|your_[A-Za-z0-9_]+|replace_[A-Za-z0-9_]+|<[^>]+>)$/i;
function findings(file, content) {
  const text = content.toString('utf8'), result = [];
  const add = (rule, offset) => result.push({file, line:text.slice(0,offset).split('\n').length, rule});
  const name = path.posix.basename(file);
  if (name === 'env' || name === '.env' || name.startsWith('.env.') && name !== '.env.example') add('Local credential file must not be tracked',0);
  for (const [rule,pattern] of rules) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) add(rule,match.index);
  }
  const assignment = /^[ \t]*(?:export[ \t]+)?(ELEVENLABS_API_KEY|GEMINI_API_KEY|MW_LEARNERS_KEY|MYSQL_PASSWORD|DATABASE_URL)[ \t]*=[ \t]*([^\r\n]*)/gm;
  for (const match of text.matchAll(assignment)) {
    const value = match[2].trim().replace(/\s+#.*$/,'').replace(/^(['"])(.*)\1$/,'$2');
    if (value && !placeholder.test(value)) add('Credential value in environment assignment',match.index);
  }
  const literal = /\b(?:ELEVENLABS_API_KEY|GEMINI_API_KEY|MW_LEARNERS_KEY)['"]?\s*[:=]\s*(['"])([^'"\r\n]+)\1/g;
  for (const match of text.matchAll(literal)) if (!placeholder.test(match[2])) add('Hardcoded API credential',match.index);
  return result;
}
function git(args,cwd,input) {
  const result = spawnSync('git',args,{cwd,input,maxBuffer:256*1024*1024});
  if (result.error || result.status !== 0) throw new Error('Git security check could not read repository data.');
  return result.stdout;
}
function scan(cwd,mode='tracked') {
  if (mode === 'history') {
    const objects = git(['rev-list','--objects','--all'],cwd).toString().trim().split('\n').filter(Boolean).map(line => {
      const separator=line.indexOf(' '); return separator<0 ? {oid:line,file:null} : {oid:line.slice(0,separator),file:line.slice(separator+1)};
    });
    if (!objects.length) return {checked:0,findings:[]};
    const data=git(['cat-file','--batch'],cwd,objects.map(item=>item.oid).join('\n')+'\n');
    let offset=0,checked=0,result=[];
    for (const item of objects) {
      const end=data.indexOf(10,offset), header=data.subarray(offset,end).toString().split(' '), size=Number(header[2]);
      if (end<0 || !Number.isSafeInteger(size) || size<0) throw new Error('Invalid Git batch response.');
      const content=data.subarray(end+1,end+1+size); offset=end+size+2;
      if (header[1]==='blob' || header[1]==='commit' || header[1]==='tag') {
        checked++; result.push(...findings(item.file || `${header[1]} ${item.oid}`,content).map(f=>({...f,object:item.oid})));
      }
    }
    return {checked,findings:result};
  }
  const files=git(mode==='staged'?['diff','--cached','--name-only','--diff-filter=ACMR','-z']:['ls-files','-z'],cwd).toString().split('\0').filter(Boolean);
  return {checked:files.length,findings:files.flatMap(file=>findings(file,git(['show',`:${file}`],cwd)))};
}
if (require.main === module) {
  try {
    const args=process.argv.slice(2);
    if (args.some(arg=>!['--history','--staged'].includes(arg)) || args.length>1) throw new Error('Use no arguments, --staged, or --history.');
    const result=scan(process.cwd(),args[0]==='--history'?'history':args[0]==='--staged'?'staged':'tracked');
    if (result.findings.length) {
      console.error(`Security check blocked ${result.findings.length} finding(s); credential values are hidden.`);
      for (const finding of result.findings) console.error(`${JSON.stringify(finding.file)}:${finding.line} — ${finding.rule}${finding.object?` (object ${finding.object})`:''}`);
      process.exitCode=1;
    } else console.log(`Security check passed: ${result.checked} ${args[0]==='--history'?'historical objects':'tracked/staged files'} checked.`);
  } catch (error) { console.error(error.message);process.exitCode=2; }
}
module.exports={findings,scan};
