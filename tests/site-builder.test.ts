import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePage} from '../functions/_lib/siteBuilder.ts';
const safe=()=>({title:'Conectando Ideias Brasil',font:'modern',headerColor:'#0b493a',accentColor:'#d5ee48',sections:[{id:'inicio',label:'Topo',columns:1,background:'#ffffff',color:'#123d32',padding:60,widgets:[{id:'titulo01',type:'heading',title:'Olá, associados',text:'Bem-vindos'}]}]});
test('permite publicação de páginas estruturadas',()=>{assert.equal(validatePage(safe()),true)});
test('rejeita URL javascript e código perigoso',()=>{
 const page=safe() as any;page.sections[0].widgets[0].url='javascript:alert(1)';
 assert.equal(validatePage(page),false);
});
test('rejeita cores CSS fora do padrão seguro',()=>{
 const page=safe();page.sections[0].background='url(javascript:foo)';
 assert.equal(validatePage(page),false);
});
test('rejeita ids duplicados e layouts excessivos',()=>{
 const page=safe() as any;page.sections[0].widgets.push({...page.sections[0].widgets[0]});
 assert.equal(validatePage(page),false);
});
