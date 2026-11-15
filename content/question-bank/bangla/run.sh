#!/bin/sh
# একটি ব্যাচের পুরো ধাপ: গঠন যাচাই → মিল যাচাই → উত্তর-সাম্য → TSV/CSV/Word
set -e
cd "$(dirname "$0")"
B=$1
node -e '
const d=require("./'$B'/questions.json");const bad=[];
d.questions.forEach((q,i)=>{if(!d.subtopics[q.st])bad.push(i+1+": unknown st "+q.st);if(q.o.length!==4||new Set(q.o).size!==4)bad.push(i+1+": options");if(!(q.a>=0&&q.a<4))bad.push(i+1+": answer");for(const k of ["q","e","t","src","dup","v","d"])if(!q[k])bad.push(i+1+": missing "+k)});
const c={};d.questions.forEach(q=>c[q.st]=(c[q.st]||0)+1);console.log("count",d.questions.length,JSON.stringify(c));
if(bad.length){console.log(bad.join("\n"));process.exit(1)}'
node dupcheck.js "$B" source/lecture_final_document.xml > "$B/dupcheck.txt"
tail -1 "$B/dupcheck.txt"
node -e '
const d=require("./'$B'/dupcheck.json");const q=require("./'$B'/questions.json").questions;
for(const r of d.rows){const f=[];if(r.pastMax>=0.45)f.push("PAST "+r.pastMax+" "+r.pastId+": "+r.pastText.slice(0,60));if(r.lecMax>=0.62)f.push("LEC "+r.lecMax+": "+r.lecText.slice(0,60));if(r.intMax>=0.62)f.push("INT "+r.intMax+" "+r.intId);if(r.ansHit&&r.ansHit.length)f.push("ANSWER-IN-PAST "+r.ansHit.join(","));if(f.length)console.log("#"+r.n+" "+q[r.n-1].q.slice(0,60)+"\n   "+f.join("\n   "))}'
