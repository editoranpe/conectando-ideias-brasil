import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {VisualSite,type CibPage} from './VisualSite';
import {whiteLabelDemoPage,NPE_THEME} from './whiteLabel';
import {api} from './api';

/** Public rendering: an untouched installation shows the placeholder demo.
 * Publishing from the admin editor replaces the demo with the client's own page.
 */
export default function PublicSite(){
  const [page,setPage]=useState<CibPage>(whiteLabelDemoPage);
  useEffect(()=>{
    let active=true;
    api<{page:CibPage|null}>('public-page').then(response=>{
      if(active && response.page?.sections?.length)setPage(response.page);
    }).catch(()=>{/* Public demo stays usable without provisioned D1. */});
    return ()=>{active=false};
  },[]);
  useEffect(()=>{document.title=page.title||NPE_THEME.productName},[page.title]);
  return <VisualSite page={page}/>;
}

/** Starter notice, intentionally not a finished legal policy.
 * Customers must replace this with a reviewed policy before collecting personal data.
 */
export function Privacy(){
 return <div className="npe-privacy">
   <header><Link to="/"><img src={NPE_THEME.logo} alt="Editora NPE"/><span>Voltar ao site</span></Link></header>
   <main>
     <small>MODELO PERSONALIZÁVEL</small>
     <h1>Privacidade e tratamento de dados</h1>
     <p>Este texto é um <strong>marcador de conteúdo</strong>, destinado apenas à demonstração comercial da plataforma.</p>
     <p>Antes de receber dados reais, a empresa responsável deverá informar sua razão social, o responsável pelos dados, as finalidades do tratamento, os canais de contato, prazos de retenção e demais informações exigidas pela legislação aplicável.</p>
     <p>Substitua este aviso por sua própria política de privacidade revisada. A Editora NPE não é automaticamente controladora dos dados cadastrados pelas empresas clientes.</p>
     <Link className="npe-privacy-back" to="/">Retornar à página inicial</Link>
   </main>
 </div>;
}
