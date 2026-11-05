import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X, GripVertical, PlusCircle } from 'lucide-react';
import { api } from './api';
import {IconTile, TestimonialGrid, IconGrid, ImageTextBlock} from './BuilderWidgets';

export type CibWidget = {
  id:string; type:'heading'|'text'|'image'|'button'|'features'|'quote'|'faq'|'signup'|'divider'|'spacer'|'testimonials'|'iconGrid'|'imageText';
  title?:string; text?:string; image?:string; url?:string; label?:string;
  imageWidth?:number; imageHeight?:number; imageBytes?:number; imageMime?:string;
  icon?:string; imagePosition?:'left'|'right'; columns?:number;
  color?:string; background?:string; align?:'left'|'center'|'right';fontSize?:number;
  items?:Array<{title?:string;text?:string;role?:string;image?:string;icon?:string}>;
};
export type CibSection = {id:string;label:string;columns:number;background:string;color:string;padding:number;backgroundImage?:string;widgets:CibWidget[]};
export type CibMenuItem = {id:string;label:string;href:string};
export type CibPage = {title:string;font:'sans'|'serif'|'modern';headerColor:string;accentColor:string;sections:CibSection[];menuItems?:CibMenuItem[];logoImage?:string;brandName?:string;brandSubtitle?:string;footerText?:string};
export const freshId = () => 'cib'+Math.random().toString(36).slice(2,11);
export const widgetNames:Record<CibWidget['type'],string> = {
  heading:'Título',text:'Texto',image:'Imagem',button:'Botão',features:'Cards / Benefícios',
  quote:'Frase de destaque',testimonials:'Depoimentos com foto',iconGrid:'Grade de ícones',imageText:'Imagem e texto',faq:'Perguntas frequentes',signup:'Formulário de adesão',divider:'Divisória',spacer:'Espaçador'
};
export function newWidget(type:CibWidget['type']):CibWidget{
  const base:CibWidget={id:freshId(),type,align:'left',fontSize:type==='heading'?42:17};
  if(type==='heading')return {...base,title:'Novo título',text:'Subtítulo opcional'};
  if(type==='text')return {...base,text:'Digite seu texto aqui.'};
  if(type==='image')return {...base,image:'',label:'Imagem do grupo'};
  if(type==='button')return {...base,label:'Saiba mais',url:'#participar'};
  if(type==='features')return {...base,title:'Nossos diferenciais',items:[{title:'Conexões',text:'Crescemos juntos'},{title:'Conhecimento',text:'Aprendizado prático'},{title:'Negócios',text:'Oportunidades reais'}]};
  if(type==='faq')return {...base,title:'Perguntas frequentes',items:[{title:'Como faço parte?',text:'Preencha seu cadastro e aguarde o retorno da comissão.'}]};
  if(type==='quote')return {...base,title:'Frase de destaque',text:'Uma ideia que merece destaque.'};
  if(type==='testimonials')return {...base,title:'Quem participa recomenda',columns:3,items:[{title:'Nome do associado',role:'Profissão ou empresa',text:'Escreva um depoimento real e autorizado.',image:''}]};
  if(type==='iconGrid')return {...base,title:'O que você ganha ao fazer parte',columns:3,items:[{title:'Conexões',text:'Networking que gera novas oportunidades.',icon:'users'},{title:'Conhecimento',text:'Aprendizado prático para crescer.',icon:'lightbulb'},{title:'Negócios',text:'Compartilhe projetos e construa parcerias.',icon:'handshake'}]};
  if(type==='imageText')return {...base,title:'Compartilhando boas experiências',text:'Uma história do Conectando Ideias Brasil.',label:'NOSSO GRUPO',image:'',imagePosition:'left'};
  if(type==='signup')return {...base,title:'Faça parte do Conectando Ideias Brasil',text:'Preencha o formulário para manifestar seu interesse.'};
  return base;
}
export const defaultCibPage:CibPage = {
  title:'Conectando Ideias Brasil',font:'modern',headerColor:'#083d31',accentColor:'#d5ee48',
  sections:[
    {id:'inicio',label:'Destaque principal',columns:2,background:'#083d31',color:'#ffffff',padding:90,widgets:[
      {id:'hero-title',type:'heading',title:'Grandes ideias nascem de conexões verdadeiras.',text:'Um grupo de empresários e empreendedores que acredita no poder de compartilhar experiências, abrir portas e crescer junto.',fontSize:55},
      {id:'hero-photo',type:'image',image:'https://editoranpe.com.br/wp-content/uploads/2025/12/06.jpeg',label:'Empreendedores reunidos'}
    ]},
    {id:'proposito',label:'Propósito',columns:1,background:'#f5f8f3',color:'#133d33',padding:80,widgets:[
      {id:'our-story',type:'heading',title:'Desde 2016, transformando boas conversas em grandes oportunidades.',fontSize:39,align:'center'},
      {id:'our-text',type:'text',text:'O Conectando Ideias Brasil nasceu para aproximar empresários, estimular a troca de experiências e construir uma rede de apoio ao empreendedorismo em Blumenau e região.',align:'center',fontSize:19}
    ]},
    {id:'como-funciona',label:'Nossos diferenciais',columns:1,background:'#ffffff',color:'#103d31',padding:80,widgets:[
      {id:'pillars',type:'features',title:'Conexões que realmente fazem a diferença',items:[
        {title:'Momento Empresa',text:'Apresente seu negócio ao grupo.'},{title:'Hot Seat',text:'Desafios reais, soluções coletivas.'},
        {title:'Minuto Conectando',text:'Dicas práticas e atualizações de mercado.'},{title:'Palestras e workshops',text:'Conhecimento, aprendizado e colaboração.'}
      ]}
    ]},
    {id:'encontros',label:'Encontros',columns:2,background:'#e9f4eb',color:'#123c32',padding:78,widgets:[
      {id:'meet-photo',type:'image',image:'https://editoranpe.com.br/wp-content/uploads/2025/12/07.jpeg',label:'Networking na prática'},
      {id:'meet-copy',type:'text',text:'Encontros mensais, em geral na segunda terça-feira às 8h, no Auditório do Casarão dos Sonhos, em Blumenau. Um espaço para aprender, construir confiança e realizar negócios.',fontSize:24}
    ]},
    {id:'depoimentos',label:'Depoimentos',columns:1,background:'#ffffff',color:'#133d33',padding:80,widgets:[
      {id:'quote-1',type:'testimonials',title:'Quem participa recomenda',columns:3,items:[{title:'Associado do grupo',role:'Empreendedor',text:'Espaço reservado para um depoimento verdadeiro de um associado.',image:''}]}
    ]},
    {id:'perguntas',label:'Dúvidas frequentes',columns:1,background:'#f5f8f3',color:'#103b2e',padding:70,widgets:[
      {id:'faq-one',type:'faq',title:'Perguntas frequentes',items:[
        {title:'Qual é o valor da mensalidade?',text:'O valor de referência é R$ 40 por mês, destinado aos custos operacionais do grupo.'},
        {title:'Quando acontecem os encontros?',text:'Em geral, toda segunda terça-feira do mês, às 8h, em Blumenau.'},
        {title:'Como posso participar?',text:'Envie uma solicitação. A entrada está sujeita à aprovação da comissão.'}
      ]}
    ]},
    {id:'participar',label:'Quero participar',columns:1,background:'#083d31',color:'#ffffff',padding:76,widgets:[
      {id:'signup-one',type:'signup',title:'Faça parte dessa conexão',text:'Conte um pouco sobre você e seu negócio. Nossa comissão entrará em contato.'}
    ]}
  ]
};
function Signup({w}:{w:CibWidget}){
 const [form,setForm]=useState({name:'',email:'',phone:'',company:'',message:'',consent:false,website:''});
 const [status,setStatus]=useState('');
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setStatus('Enviando...');try{await api('apply','POST',form);setStatus('Recebemos seu interesse. A comissão entrará em contato!');setForm({name:'',email:'',phone:'',company:'',message:'',consent:false,website:''});}catch(err){setStatus((err as Error).message)}};
 return <div className="cib-signup"><h2>{w.title||'Quero participar'}</h2><p>{w.text}</p><form onSubmit={submit}><div className="cib-signup-row"><input aria-label="Nome completo" required placeholder="Nome completo" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><input aria-label="E-mail" type="email" required placeholder="E-mail" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div><div className="cib-signup-row"><input aria-label="WhatsApp" required placeholder="WhatsApp" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/><input aria-label="Empresa" required placeholder="Empresa" value={form.company} onChange={e=>setForm({...form,company:e.target.value})}/></div><textarea aria-label="Mensagem" placeholder="Como podemos conectar você?" value={form.message} onChange={e=>setForm({...form,message:e.target.value})}/><label className="cib-consent"><input type="checkbox" required checked={form.consent} onChange={e=>setForm({...form,consent:e.target.checked})}/> Autorizo o uso dos meus dados para retorno sobre minha solicitação. <Link to="/privacidade">Política de privacidade</Link>.</label><button className="cib-signup-button">Enviar solicitação <ArrowRight size={16}/></button><div role="status">{status}</div></form></div>
}
function CibImageWidget({w}:{w:CibWidget}){
 const [broken,setBroken]=useState(false);
 React.useEffect(()=>{setBroken(false)},[w.image]);
 const usable=!!w.image&&!broken;
 return <figure className="cib-widget-image">
   {usable?<img src={w.image} alt={w.label||'Imagem do grupo'} loading="lazy" onError={()=>setBroken(true)}/>:
     <div className="cib-widget-image-placeholder" role="img" aria-label="Imagem não disponível">
       <span>✳</span><strong>{w.image?'Não foi possível carregar esta imagem.':'Imagem ainda não enviada'}</strong>
       <small>Abra o widget no editor e escolha um arquivo do seu computador.</small>
     </div>}
   {w.label&&<figcaption>{w.label}</figcaption>}
 </figure>;
}
export function CibWidgetView({widget:w,editing=false}:{widget:CibWidget;editing?:boolean}){
 const style:React.CSSProperties={textAlign:w.align||'left',color:w.color||'inherit',background:w.background||'transparent',fontSize:w.fontSize? w.fontSize:undefined};
 if(w.type==='heading')return <div className="cib-widget-heading" style={style}><h1 style={{fontSize:'inherit'}}>{w.title}</h1>{w.text&&<p>{w.text}</p>}</div>;
 if(w.type==='text')return <div className="cib-widget-text" style={style}>{w.text}</div>;
 if(w.type==='image')return <CibImageWidget w={w}/>;
 if(w.type==='button')return <div style={style}><a className="cib-widget-button" href={editing?'#':w.url||'#participar'} onClick={editing?e=>e.preventDefault():undefined}>{w.label||'Saiba mais'} <ArrowRight size={17}/></a></div>;
 if(w.type==='features')return <div className="cib-widget-features" style={style}><h2>{w.title}</h2><div className="cib-feature-grid">{(w.items||[]).map((item,i)=><article key={i}><span className="cib-feature-icon"><IconTile name={item.icon||'sparkles'}/></span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div></div>;
 if(w.type==='iconGrid')return <IconGrid widget={w}/>;
 if(w.type==='testimonials')return <TestimonialGrid widget={w}/>;
 if(w.type==='imageText')return <ImageTextBlock widget={w} editing={editing}/>
 if(w.type==='quote')return <blockquote className="cib-widget-quote" style={style}><h2>{w.title}</h2><p>“{w.text}”</p></blockquote>;
 if(w.type==='faq')return <div className="cib-widget-faq" style={style}><h2>{w.title}</h2>{(w.items||[]).map((item,i)=><details key={i}><summary>{item.title}</summary><p>{item.text}</p></details>)}</div>;
 if(w.type==='signup')return editing?<div className="cib-signup cib-signup-mock"><h2>{w.title}</h2><p>{w.text}</p><div className="cib-signup-row"><input disabled placeholder="Nome completo"/><input disabled placeholder="E-mail"/></div><div className="cib-signup-row"><input disabled placeholder="WhatsApp"/><input disabled placeholder="Empresa"/></div><span>Formulário de adesão (interativo no site publicado)</span></div>:<Signup w={w}/>;
 if(w.type==='divider')return <hr className="cib-widget-divider"/>;
 return <div style={{height:Math.max(20,w.fontSize||40)}}/>;
}
export function VisualSite({page,editing=false,selected,select,dragStart,dropAt}:{page:CibPage;editing?:boolean;selected?:string|null;select?:(kind:'section'|'widget',id:string)=>void;dragStart?:(section:string,widget:string)=>void;dropAt?:(section:string,widget:string)=>void}){
 const [menu,setMenu]=useState(false);
 return <div className={`cib-rendered-site cib-font-${page.font}`} style={{'--cib-header':page.headerColor,'--cib-accent':page.accentColor} as React.CSSProperties}>
  <header className="cib-visual-header"><a href="/" className="cib-visual-logo" onClick={editing?e=>e.preventDefault():undefined}>{page.logoImage?<img src={page.logoImage} alt="Logotipo do grupo" />:<span className="cib-simple-logo" aria-hidden="true">✳</span>} <strong>{page.brandName||'Conectando Ideias'} <span>{page.brandSubtitle||'BRASIL'}</span></strong></a><button type="button" aria-label={menu?'Fechar menu':'Abrir menu'} className="cib-menu-toggle" onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button><nav className={menu?'open':''}>{(page.menuItems!==undefined?page.menuItems:page.sections.slice(0,5).map(s=>({id:s.id,label:s.label,href:`#${s.id}` }))).map(link=><a key={link.id} href={editing?'#':link.href} onClick={editing?e=>e.preventDefault():()=>setMenu(false)}>{link.label}</a>)}{!editing&&<Link to="/entrar">Área do associado</Link>}</nav></header>
  <main>{page.sections.map(section=><section key={section.id} id={section.id} className={`cib-visual-section ${editing&&selected===section.id?'cib-selected':''}`} style={{background:section.background,color:section.color,padding:`${section.padding}px 22px`,backgroundImage:section.backgroundImage?`linear-gradient(#0005,#0005),url("${section.backgroundImage}")`:undefined,backgroundPosition:'center',backgroundSize:'cover'}}>
   {editing&&<button className="cib-section-handle" onClick={()=>select?.('section',section.id)}><PlusCircle size={14}/> Editar seção: {section.label}</button>}
   <div className="cib-visual-grid" style={{gridTemplateColumns:`repeat(${section.columns}, minmax(0, 1fr))`}}>
    {section.widgets.map(widget=><div key={widget.id} className={`cib-visual-widget ${editing?'cib-editable':''} ${selected===widget.id?'cib-selected':''}`} onClick={editing?e=>{e.stopPropagation();select?.('widget',widget.id)}:undefined} draggable={editing} onDragStart={editing?e=>{e.stopPropagation();dragStart?.(section.id,widget.id)}:undefined} onDragOver={editing?e=>e.preventDefault():undefined} onDrop={editing?e=>{e.preventDefault();e.stopPropagation();dropAt?.(section.id,widget.id)}:undefined}>
      {editing&&<span className="cib-widget-handle"><GripVertical size={13}/> {widgetNames[widget.type]}</span>}<CibWidgetView widget={widget} editing={editing}/>
    </div>)}
   </div>
  </section>)}</main>
  <footer className="cib-visual-footer">© {new Date().getFullYear()} {page.footerText||'Conectando Ideias Brasil · Blumenau, SC'} <Link to="/privacidade">Privacidade</Link></footer>
 </div>;
}
