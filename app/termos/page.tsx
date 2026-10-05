import type { Metadata } from "next";
import { StaticInfoPage } from "@/components/static-info-page";

export const metadata: Metadata = {
  title: "Termos",
  robots: { index: false, follow: false },
};

export default function TermsPage() {
  return (
    <StaticInfoPage
      eyebrow="Legal"
      title="Termos de Uso"
      description="Última atualização: 5 de outubro de 2026. Estes Termos de Uso regulam o acesso e o uso da plataforma LinkOr."
      variant="document"
      sections={[
        {
          title: "1. Quem somos e como falar conosco",
          description:
            "A LinkOr, inscrita no CNPJ sob o nº 27.900.115/0001-99, disponibiliza ferramentas para criação, organização, distribuição e análise de links e campanhas.",
          items: [
            "E-mail: rhenancontato@gmail.com.",
            "WhatsApp: +55 41 98895-0911.",
          ],
        },
        {
          title: "2. Aceitação dos Termos",
          description:
            "Ao criar uma conta, acessar ou utilizar a plataforma, você declara que leu, compreendeu e concorda com estes Termos e com a Política de Privacidade.",
          paragraphs: [
            "Caso não concorde com qualquer condição, não utilize a LinkOr. Se estiver usando a plataforma em nome de uma empresa ou organização, você declara possuir poderes para vinculá-la a estes Termos.",
          ],
        },
        {
          title: "3. Elegibilidade e conta",
          description:
            "Você deve fornecer dados corretos, completos e atualizados ao criar ou manter sua conta e é responsável por todas as atividades realizadas com suas credenciais.",
          items: [
            "Mantenha senha e métodos de acesso em sigilo e avise-nos imediatamente sobre uso não autorizado.",
            "Não crie contas com dados de terceiros sem autorização, nem transfira ou comercialize sua conta.",
            "Menores de idade devem usar a plataforma com autorização e supervisão de responsável legal, quando aplicável.",
          ],
        },
        {
          title: "4. Uso da plataforma",
          description:
            "A LinkOr oferece recursos de links curtos, páginas públicas, QR Codes, parâmetros de campanha, métricas e outras funcionalidades que podem variar conforme o produto, plano e disponibilidade técnica.",
          paragraphs: [
            "Recursos gratuitos, testes, limites de uso e funcionalidades pagas podem ter condições próprias apresentadas antes da contratação. A LinkOr pode evoluir, substituir, restringir ou descontinuar recursos mediante comunicação razoável quando isso for material ao serviço contratado.",
          ],
        },
        {
          title: "5. Condutas proibidas",
          description:
            "Você se compromete a usar a plataforma de forma lícita, ética e compatível com estes Termos.",
          items: [
            "Violar leis, direitos de terceiros, direitos autorais, marcas, privacidade ou proteção de dados.",
            "Distribuir malware, phishing, spam, fraude, conteúdo enganoso, ilegal, discriminatório ou que incentive violência.",
            "Tentar acessar áreas restritas, interferir na segurança, contornar limites técnicos ou automatizar acessos sem autorização.",
            "Usar a plataforma para coletar dados pessoais de terceiros sem base legal ou transparência adequada.",
          ],
        },
        {
          title: "6. Links, conteúdo e páginas publicadas",
          description:
            "Você é integralmente responsável pelos destinos, mensagens, arquivos, produtos, serviços e conteúdos associados aos links e páginas que criar ou compartilhar.",
          paragraphs: [
            "A LinkOr não controla os destinos de terceiros e não garante sua disponibilidade, segurança, legalidade ou exatidão. Podemos remover, bloquear ou restringir links e conteúdos que apresentem risco, violem estes Termos, recebam denúncia fundamentada ou sejam exigidos por lei.",
          ],
        },
        {
          title: "7. Dados e conteúdo do usuário",
          description:
            "Você mantém seus direitos sobre o conteúdo que envia à plataforma. Para operar o serviço, você concede à LinkOr licença limitada, não exclusiva e revogável para hospedar, processar, exibir e transmitir esse conteúdo conforme suas configurações e estes Termos.",
          paragraphs: [
            "Você declara possuir os direitos, autorizações e bases legais necessários para usar e publicar tal conteúdo. Faça cópias de segurança dos dados que considerar essenciais; a plataforma não substitui uma solução de backup independente.",
          ],
        },
        {
          title: "8. Disponibilidade, segurança e suporte",
          description:
            "Empregamos esforços razoáveis para manter a plataforma funcional e segura, mas não garantimos operação contínua, livre de erros ou compatível com todos os dispositivos, redes e serviços de terceiros.",
          paragraphs: [
            "Manutenções, atualizações, falhas de infraestrutura, eventos de segurança e fatores fora do nosso controle podem causar indisponibilidades. O suporte é prestado pelos canais informados e pode depender do plano contratado e da complexidade da solicitação.",
          ],
        },
        {
          title: "9. Propriedade intelectual",
          description:
            "A marca LinkOr, a plataforma, seu código, design, textos, bases de dados, funcionalidades e demais elementos são protegidos por direitos de propriedade intelectual e pertencem à LinkOr ou a seus licenciantes.",
          paragraphs: [
            "Estes Termos não transferem propriedade sobre a plataforma. Você recebe apenas uma licença pessoal, limitada, revogável, não exclusiva e intransferível para usar os recursos contratados de acordo com estas condições.",
          ],
        },
        {
          title: "10. Planos, pagamentos e cancelamento",
          description:
            "Quando houver contratação de plano pago, preço, período, forma de cobrança, impostos, renovação e condições de cancelamento serão informados no fluxo de contratação ou em proposta aplicável.",
          paragraphs: [
            "O cancelamento não elimina valores já devidos por períodos utilizados, sem prejuízo dos direitos previstos na legislação aplicável. Em caso de inadimplência, podemos limitar ou suspender recursos após comunicação compatível com a situação.",
          ],
        },
        {
          title: "11. Privacidade e proteção de dados",
          description:
            "O tratamento de dados pessoais realizado pela LinkOr é descrito na Política de Privacidade, que integra estes Termos. Ao usar a plataforma, você também se compromete a respeitar a legislação de proteção de dados em relação às informações de terceiros que inserir ou tratar.",
          href: "/privacidade",
          action: "Ler Política de Privacidade",
        },
        {
          title: "12. Limitação de responsabilidade",
          description:
            "Na extensão permitida pela lei, a LinkOr não se responsabiliza por danos indiretos, lucros cessantes, perda de oportunidades, danos decorrentes de links ou serviços de terceiros, nem por decisões tomadas exclusivamente com base em métricas da plataforma.",
          paragraphs: [
            "Nada nestes Termos exclui responsabilidades que não possam ser afastadas pela legislação brasileira, inclusive normas de proteção ao consumidor quando aplicáveis.",
          ],
        },
        {
          title: "13. Suspensão e encerramento",
          description:
            "Você pode deixar de usar a plataforma a qualquer momento. A LinkOr poderá suspender ou encerrar acessos em caso de violação destes Termos, risco de segurança, exigência legal, fraude ou uso que prejudique a plataforma, outros usuários ou terceiros.",
          paragraphs: [
            "Sempre que adequado, buscaremos comunicar a medida e disponibilizar informações necessárias para o encerramento. Obrigações que, por sua natureza, devam permanecer vigentes continuam válidas após o término da relação.",
          ],
        },
        {
          title: "14. Alterações e legislação aplicável",
          description:
            "Podemos atualizar estes Termos para refletir mudanças legais, técnicas, operacionais ou comerciais. A versão vigente estará sempre nesta página, com a data de atualização indicada no início.",
          paragraphs: [
            "Estes Termos são regidos pelas leis da República Federativa do Brasil. Eventuais controvérsias serão tratadas no foro competente previsto pela legislação aplicável, preservados os direitos do consumidor.",
          ],
        },
      ]}
    />
  );
}
