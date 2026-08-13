import fs from 'node:fs';
const p='hotcache-main-v084.js';let s=fs.readFileSync(p,'utf8');
const must=(c,m)=>{if(!c)throw new Error(m);};

if(!s.includes('MAX_MEMORY_BYTES')){
  s=s.replace('  const MAX_ENTRY_BYTES = 40 * 1024 * 1024;','  const MAX_ENTRY_BYTES = 40 * 1024 * 1024;\n  const MAX_MEMORY_ENTRIES = 2;\n  const MAX_MEMORY_BYTES = 48 * 1024 * 1024;');
}

const touchRx=/  function touchMemory\(entry\) \{[\s\S]*?\n  \}/;
must(touchRx.test(s),'touchMemory anchor missing');
s=s.replace(touchRx,`  function touchMemory(entry) {\n    memory.delete(entry.id);\n    memory.set(entry.id, entry);\n    let total = [...memory.values()].reduce((sum,item)=>sum+(Number(item?.bytes)||0),0);\n    while (memory.size > MAX_MEMORY_ENTRIES || total > MAX_MEMORY_BYTES) {\n      const oldestId = memory.keys().next().value;\n      if (!oldestId) break;\n      const oldest = memory.get(oldestId);\n      memory.delete(oldestId);\n      total -= Number(oldest?.bytes) || 0;\n    }\n  }`);

const metaRx=/  function extractResponseMeta\(text\) \{[\s\S]*?\n  \}/;
must(metaRx.test(s),'extractResponseMeta anchor missing');
s=s.replace(metaRx,`  function extractResponseMeta(text) {\n    let updateTime = 0;\n    let currentNode = '';\n    try {\n      // Conversation-level metadata is emitted outside the massive mapping. Scanning\n      // bounded head/tail windows avoids walking tens of megabytes on every store.\n      const head = text.slice(0, 128 * 1024);\n      const tail = text.length > 128 * 1024 ? text.slice(-128 * 1024) : head;\n      const timeMatch = head.match(/\\\"update_time\\\"\\s*:\\s*(\\\"[^\\\"]+\\\"|\\d+(?:\\.\\d+)?)/);\n      if (timeMatch) updateTime = parseTime(String(timeMatch[1] || '').replace(/^\\\"|\\\"$/g, ''));\n      const nodeMatch = tail.match(/\\\"current_node\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"/) || head.match(/\\\"current_node\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"/);\n      if (nodeMatch) currentNode = nodeMatch[1];\n    } catch {}\n    return { updateTime, currentNode };\n  }`);

must(s.includes('MAX_MEMORY_BYTES = 48 * 1024 * 1024'),'memory byte cap missing');
must(s.includes('memory.size > MAX_MEMORY_ENTRIES || total > MAX_MEMORY_BYTES'),'memory LRU byte cap missing');
must(s.includes('const head = text.slice(0, 128 * 1024)'),'bounded metadata head scan missing');
must(!s.includes('while ((match = timeRx.exec(text)))'),'full response timestamp scan remains');
fs.writeFileSync(p,s);

const cp='tools/check-hotpath-v096.mjs';let c=fs.readFileSync(cp,'utf8');
if(!c.includes('MAX_MEMORY_BYTES'))c=c.replace('// Core cache writes must notify consumers without causing the core to rebuild its own state.',"// Hot conversation cache memory is bounded independently from IndexedDB.\nconst hotMain=read('hotcache-main-v084.js');\nhas(hotMain,'MAX_MEMORY_ENTRIES = 2','hot-cache memory entry cap missing');\nhas(hotMain,'MAX_MEMORY_BYTES = 48 * 1024 * 1024','hot-cache memory byte cap missing');\nhas(hotMain,'const head = text.slice(0, 128 * 1024)','bounded metadata scan missing');\nno(hotMain,'while ((match = timeRx.exec(text)))','full huge-response metadata scan reintroduced');\n\n// Core cache writes must notify consumers without causing the core to rebuild its own state.");
fs.writeFileSync(cp,c);
console.log('NiakGPT 0.9.6 hot-cache memory bounded and metadata scan shortened');
