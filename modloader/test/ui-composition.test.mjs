import {test} from 'node:test';import assert from 'node:assert/strict';
import {patchPackRows} from '../../uitweaks-mod/patches.mjs';
test('pack rows capture renamed helpers while keeping full unique structural anchors',()=>{
 for(const [a,b]of [['Fo','El'],['Wo','Il']]){
  const s='c.append(W(`span`,null,n.name+(n.stack?` ×${n.stack}`:``)));'+`let l=[n.material,n.word,n.lit?\`lit\`:null,n.quest==null?null:${a}()].filter(Boolean).join(\` · \`);${b}(o,e);let s=P===e&&F===t;`;
  const out=patchPackRows(s);assert.match(out,/rowName/);assert.match(out,/decorateRow/);assert.ok(out.includes(b+'(o,e)'));
  assert.throws(()=>patchPackRows(s+s));assert.throws(()=>patchPackRows(s.replace('n.material','other.material')));assert.throws(()=>patchPackRows(out));
 }
});
