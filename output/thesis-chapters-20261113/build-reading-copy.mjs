import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const directory = path.dirname(fileURLToPath(import.meta.url));
const input = fs.readFileSync(path.join(directory, 'ThreatLens_Chapter_Wise_Draft.md'), 'utf8');
const body = marked.parse(input);
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ThreatLens — Chapter-wise thesis draft</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f3f1ed;color:#202326;font:18px/1.7 Georgia,'Times New Roman',serif}main{max-width:960px;margin:30px auto;padding:48px 64px;background:white}h1,h2{font-family:Arial,sans-serif;line-height:1.3;color:#171b20}h1{font-size:27px;margin:56px 0 24px;border-bottom:1px solid #cbd0d5;padding-bottom:12px}h2{font-size:21px;margin:30px 0 12px}p{margin:0 0 16px}a{color:#174c80;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;font-size:15px;margin:22px 0}td,th{border:1px solid #a8afb5;padding:10px;text-align:left;vertical-align:top}th{background:#f2f3f4}code{font-size:.9em;overflow-wrap:anywhere}strong{font-weight:700}header{font:15px/1.5 Arial,sans-serif;background:#f5f0e5;border-left:4px solid #b06625;padding:16px}li{margin-bottom:8px}@media(max-width:650px){main{margin:0;padding:24px}body{font-size:17px}table{display:block;overflow:auto}}@media print{body{background:white;font-size:11pt;line-height:1.5}main{max-width:none;padding:0;margin:0}h1{break-before:page;font-size:18pt}h2{font-size:13pt;break-after:avoid}header{display:none}table{font-size:9pt}a{color:inherit}p{orphans:3;widows:3}@page{size:A4;margin:24mm}}
</style></head><body><main><header>Reading and copy-paste draft. Chapter 6 still requires verified experimental inputs. Nine figure locations are marked; four diagrams remain to be prepared. Review the editing notes before submission.</header>${body}</main></body></html>`;
fs.writeFileSync(path.join(directory, 'ThreatLens_Chapter_Wise_Draft.html'), html);
const headings = [...input.matchAll(/^## (\d+\.\d+) (.+)$/gm)];
const chapters = [...input.matchAll(/^# CHAPTER \d+ /gm)];
const figures = [...input.matchAll(/\[INSERT FIGURE (\d+\.\d+) HERE/g)];
console.log(JSON.stringify({chapters:chapters.length,subsections:headings.length,figures:figures.map(match=>match[1]),words:input.split(/\s+/).filter(Boolean).length,authorMarkers:[...input.matchAll(/\[AUTHOR INPUT/g)].length},null,2));
