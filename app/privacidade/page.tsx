import type { Metadata } from "next";
import { StaticInfoPage } from "@/components/static-info-page";

export const metadata: Metadata = {
  title: "Privacidade",
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
  return (
    <StaticInfoPage
      eyebrow="Legal"
      title="Política de Privacidade"
      description="Última atualização: 5 de outubro de 2026. Esta Política explica como a LinkOr trata dados pessoais em conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD)."
      variant="document"
      sections={[
        {
          title: "1. Controlador e contato",
          description:
            "A LinkOr, inscrita no CNPJ sob o nº 27.900.115/0001-99, é a controladora dos dados pessoais tratados para disponibilizar a plataforma, exceto quando atuar em nome de clientes que definam as finalidades do tratamento.",
          items: [
            "E-mail para privacidade e exercício de direitos: rhenancontato@gmail.com.",
            "WhatsApp: +55 41 98895-0911.",
          ],
        },
        {
          title: "2. A quem esta Política se aplica",
          description:
            "Esta Política se aplica a visitantes do site, usuários das ferramentas, titulares de contas, pessoas que entram em contato conosco e pessoas cujos dados sejam tratados em funcionalidades disponibilizadas na LinkOr.",
          paragraphs: [
            "Links, páginas e integrações criados por usuários podem direcionar a serviços de terceiros. Cada terceiro possui suas próprias práticas de privacidade, pelas quais não somos responsáveis.",
          ],
        },
        {
          title: "3. Dados que podemos tratar",
          description:
            "Tratamos apenas os dados necessários para operar, proteger e melhorar a plataforma, conforme o contexto de sua interação.",
          items: [
            "Dados de cadastro e contato, como nome, e-mail, credenciais de acesso e informações de conta fornecidas por você.",
            "Dados técnicos, como endereço IP, tipo de dispositivo e navegador, identificadores técnicos, registros de acesso, data, hora e páginas acessadas.",
            "Dados de uso, como interações com recursos, links criados, configurações, métricas agregadas e eventos necessários para relatórios e segurança.",
            "Conteúdos e informações que você inserir em links, páginas, formulários, campanhas ou solicitações de suporte.",
          ],
        },
        {
          title: "4. Finalidades e bases legais",
          description:
            "Usamos dados pessoais para criar e administrar contas, fornecer recursos, responder solicitações, prevenir fraudes, manter segurança, cumprir obrigações legais e aperfeiçoar nossos serviços.",
          paragraphs: [
            "Conforme cada operação, o tratamento pode se basear na execução de contrato ou de procedimentos preliminares, no cumprimento de obrigação legal ou regulatória, no legítimo interesse da LinkOr ou de terceiros, na proteção da vida e, quando necessário, no consentimento do titular. Você pode revogar consentimentos a qualquer momento, sem afetar tratamentos anteriores realizados validamente.",
          ],
        },
        {
          title: "5. Compartilhamento de dados",
          description:
            "Podemos compartilhar dados com fornecedores que apoiam a infraestrutura, hospedagem, autenticação, pagamentos, comunicação, análise e suporte da plataforma, sempre conforme instruções e medidas de proteção adequadas.",
          paragraphs: [
            "Também podemos compartilhar informações quando exigido por lei, ordem de autoridade competente, para proteger direitos e segurança, ou em operações societárias. Não vendemos dados pessoais.",
          ],
        },
        {
          title: "6. Transferências internacionais",
          description:
            "Alguns fornecedores podem armazenar ou processar dados fora do Brasil. Quando isso ocorrer, adotaremos mecanismos e salvaguardas compatíveis com a LGPD e a regulamentação aplicável para proteger os dados transferidos.",
        },
        {
          title: "7. Retenção e eliminação",
          description:
            "Mantemos dados pessoais pelo tempo necessário para cumprir as finalidades desta Política, atender obrigações legais, resolver disputas, prevenir fraudes e exercer direitos em processos administrativos, arbitrais ou judiciais.",
          paragraphs: [
            "Após o término da necessidade de retenção, eliminaremos, anonimizaremos ou adotaremos medidas de descarte seguro, salvo hipóteses legais de conservação.",
          ],
        },
        {
          title: "8. Cookies e tecnologias semelhantes",
          description:
            "Utilizamos tecnologias necessárias ao funcionamento da sessão, segurança, preferências e limite de uso anônimo. Também poderemos usar tecnologias de medição e melhoria de desempenho, conforme as configurações e recursos disponíveis.",
          paragraphs: [
            "Você pode gerenciar cookies no navegador, mas a desativação de itens essenciais pode comprometer partes da plataforma. A Política de Cookies complementa esta informação quando publicada.",
          ],
          href: "/cookies",
          action: "Ver informações de cookies",
        },
        {
          title: "9. Segurança",
          description:
            "Adotamos medidas técnicas e organizacionais razoáveis para proteger dados pessoais contra acesso não autorizado, alteração, perda, divulgação ou tratamento indevido.",
          paragraphs: [
            "Nenhum ambiente digital é totalmente imune a riscos. Você também deve proteger suas credenciais, usar dispositivos confiáveis e nos avisar ao identificar qualquer suspeita de comprometimento de conta ou dados.",
          ],
        },
        {
          title: "10. Direitos dos titulares",
          description:
            "Nos termos da LGPD e observadas suas exceções, você pode solicitar confirmação de tratamento, acesso, correção, anonimização, bloqueio, eliminação, portabilidade, informação sobre compartilhamentos e revisão de decisões automatizadas, quando aplicável.",
          paragraphs: [
            "Você também pode obter informações sobre consentimentos, revogá-los e apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD). Para exercer direitos, entre em contato pelo e-mail informado nesta Política; poderemos solicitar informações para confirmar sua identidade e proteger seus dados.",
          ],
        },
        {
          title: "11. Dados de crianças e adolescentes",
          description:
            "A LinkOr não é direcionada a crianças. Quando houver tratamento de dados de crianças ou adolescentes, ele deverá ocorrer no melhor interesse do titular e com observância das exigências legais, incluindo consentimento específico de responsável quando necessário.",
        },
        {
          title: "12. Atualizações desta Política",
          description:
            "Podemos atualizar esta Política para refletir alterações legais, técnicas ou operacionais. A versão vigente estará disponível nesta página com sua data de atualização.",
          paragraphs: [
            "Em mudanças relevantes, adotaremos meios razoáveis de comunicação compatíveis com o impacto da alteração. O uso continuado da plataforma após a vigência da nova versão estará sujeito à Política atualizada, quando permitido por lei.",
          ],
        },
        {
          title: "13. Fale conosco",
          description:
            "Para dúvidas sobre esta Política, solicitações relacionadas a dados pessoais ou comunicações sobre privacidade, escreva para rhenancontato@gmail.com ou entre em contato pelo WhatsApp +55 41 98895-0911.",
        },
      ]}
    />
  );
}
