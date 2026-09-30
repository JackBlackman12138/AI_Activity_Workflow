import {readFile} from 'node:fs/promises';
import {validateDemoBrowser} from './project-browser.mjs';
const root=new URL('../',import.meta.url);
const html=await readFile(new URL('src/demo.html',root),'utf8');
const config=JSON.parse(await readFile(new URL('configuration.json',root),'utf8'));
const tests=JSON.parse(await readFile(new URL('project-tests.json',root),'utf8'));
const result=await validateDemoBrowser(html,config,tests,new AbortController().signal);
console.log(JSON.stringify({...result,screenshots:undefined},null,2));
if(!result.passed)process.exitCode=1;
