// Mock data for VS LEADS dashboard visualization

export const MOCK_LEADS = [
  { id: "1", name: "Carlos Mendes", phone: "+5511999001001", email: "carlos@techsol.com.br", source: "whatsapp", status: "pending", ai_status: "aguardando", created_at: "2026-02-25T10:00:00Z" },
  { id: "2", name: "Ana Paula Silva", phone: "+5521988002002", email: "ana@innovatech.com", source: "web", status: "enriched", ai_status: "qualificando", created_at: "2026-02-25T09:30:00Z" },
  { id: "3", name: "Roberto Almeida", phone: "+5511977003003", email: "roberto@alphagroup.com.br", source: "whatsapp", status: "enriched", ai_status: "negociando", created_at: "2026-02-24T15:00:00Z" },
  { id: "4", name: "Fernanda Costa", phone: "+5531966004004", email: "fernanda@greentech.io", source: "manual", status: "converted", ai_status: "vendido", created_at: "2026-02-24T11:00:00Z" },
  { id: "5", name: "Lucas Oliveira", phone: "+5511955005005", email: "lucas@dataprime.com.br", source: "whatsapp", status: "pending", ai_status: "aguardando", created_at: "2026-02-24T08:00:00Z" },
  { id: "6", name: "Mariana Santos", phone: "+5521944006006", email: "mariana@cloudbase.com", source: "web", status: "enriched", ai_status: "qualificando", created_at: "2026-02-23T16:00:00Z" },
  { id: "7", name: "Pedro Henrique", phone: "+5511933007007", email: "pedro@nexusinc.com.br", source: "whatsapp", status: "enriched", ai_status: "negociando", created_at: "2026-02-23T14:00:00Z" },
  { id: "8", name: "Juliana Ferreira", phone: "+5541922008008", email: "juliana@smartflow.com", source: "import", status: "converted", ai_status: "vendido", created_at: "2026-02-23T10:00:00Z" },
  { id: "9", name: "Thiago Barbosa", phone: "+5511911009009", email: "thiago@megacorp.com.br", source: "whatsapp", status: "pending", ai_status: "aguardando", created_at: "2026-02-22T17:00:00Z" },
  { id: "10", name: "Camila Rocha", phone: "+5521900010010", email: "camila@visionlab.com", source: "web", status: "enriched", ai_status: "qualificando", created_at: "2026-02-22T13:00:00Z" },
  { id: "11", name: "Rafael Nascimento", phone: "+5531889011011", email: "rafael@connecthub.com.br", source: "manual", status: "pending", ai_status: "aguardando", created_at: "2026-02-22T09:00:00Z" },
  { id: "12", name: "Beatriz Lima", phone: "+5511878012012", email: "beatriz@prodata.io", source: "whatsapp", status: "enriched", ai_status: "negociando", created_at: "2026-02-21T15:00:00Z" },
  { id: "13", name: "Gustavo Moreira", phone: "+5521867013013", email: "gustavo@soltec.com.br", source: "web", status: "converted", ai_status: "vendido", created_at: "2026-02-21T11:00:00Z" },
  { id: "14", name: "Isabela Cardoso", phone: "+5511856014014", email: "isabela@corebi.com", source: "whatsapp", status: "pending", ai_status: "qualificando", created_at: "2026-02-21T08:00:00Z" },
  { id: "15", name: "Diego Martins", phone: "+5541845015015", email: "diego@pixelwave.com.br", source: "import", status: "enriched", ai_status: "negociando", created_at: "2026-02-20T16:00:00Z" },
  { id: "16", name: "Larissa Souza", phone: "+5511834016016", email: "larissa@byteworks.io", source: "whatsapp", status: "converted", ai_status: "vendido", created_at: "2026-02-20T14:00:00Z" },
  { id: "17", name: "Marcos Vieira", phone: "+5521823017017", email: "marcos@trendset.com.br", source: "web", status: "pending", ai_status: "aguardando", created_at: "2026-02-20T10:00:00Z" },
  { id: "18", name: "Patrícia Duarte", phone: "+5511812018018", email: "patricia@innovare.com", source: "manual", status: "enriched", ai_status: "qualificando", created_at: "2026-02-19T17:00:00Z" },
  { id: "19", name: "André Teixeira", phone: "+5531801019019", email: "andre@scaletec.com.br", source: "whatsapp", status: "pending", ai_status: "aguardando", created_at: "2026-02-19T13:00:00Z" },
  { id: "20", name: "Vanessa Pereira", phone: "+5511790020020", email: "vanessa@agilelab.io", source: "web", status: "converted", ai_status: "vendido", created_at: "2026-02-19T09:00:00Z" },
  { id: "21", name: "Felipe Gomes", phone: "+5521779021021", email: "felipe@maxdata.com.br", source: "whatsapp", status: "enriched", ai_status: "negociando", created_at: "2026-02-18T15:00:00Z" },
  { id: "22", name: "Tatiana Ribeiro", phone: "+5511768022022", email: "tatiana@flowtech.com", source: "import", status: "pending", ai_status: "aguardando", created_at: "2026-02-18T11:00:00Z" },
  { id: "23", name: "Bruno Araújo", phone: "+5541757023023", email: "bruno@rapidpay.com.br", source: "whatsapp", status: "enriched", ai_status: "qualificando", created_at: "2026-02-18T08:00:00Z" },
  { id: "24", name: "Aline Machado", phone: "+5511746024024", email: "aline@cloudpeak.io", source: "web", status: "converted", ai_status: "vendido", created_at: "2026-02-17T16:00:00Z" },
  { id: "25", name: "Ricardo Campos", phone: "+5521735025025", email: "ricardo@bluepoint.com.br", source: "manual", status: "pending", ai_status: "aguardando", created_at: "2026-02-17T10:00:00Z" },
];

export const MOCK_INSTANCES = [
  { name: "VS Vendas Principal", state: "open", owner: "user1" },
  { name: "Suporte Técnico", state: "open", owner: "user1" },
  { name: "Pós-venda", state: "open", owner: "user1" },
  { name: "Marketing", state: "connecting", owner: "user1" },
  { name: "Backup", state: "close", owner: "user1" },
];

export const MOCK_AI_LOG = [
  { id: "1", action: "conversa_iniciada", description: "IA iniciou conversa com Carlos Mendes", timestamp: "2026-02-26T09:45:00Z", icon: "message" },
  { id: "2", action: "lead_qualificado", description: "IA qualificou Ana Paula Silva como lead quente", timestamp: "2026-02-26T09:30:00Z", icon: "target" },
  { id: "3", action: "reuniao_agendada", description: "IA agendou reunião com Roberto Almeida para 27/02", timestamp: "2026-02-26T09:15:00Z", icon: "calendar" },
  { id: "4", action: "venda_concluida", description: "Fernanda Costa confirmou compra — R$ 4.500", timestamp: "2026-02-26T08:50:00Z", icon: "check" },
  { id: "5", action: "follow_up", description: "IA enviou follow-up para Lucas Oliveira (2º toque)", timestamp: "2026-02-26T08:30:00Z", icon: "refresh" },
  { id: "6", action: "conversa_iniciada", description: "IA iniciou conversa com Mariana Santos", timestamp: "2026-02-26T08:15:00Z", icon: "message" },
  { id: "7", action: "objecao_tratada", description: "IA contornou objeção de preço de Pedro Henrique", timestamp: "2026-02-26T08:00:00Z", icon: "shield" },
  { id: "8", action: "lead_qualificado", description: "IA qualificou Juliana Ferreira como lead morno", timestamp: "2026-02-25T17:30:00Z", icon: "target" },
  { id: "9", action: "conversa_iniciada", description: "IA iniciou conversa com Thiago Barbosa", timestamp: "2026-02-25T17:00:00Z", icon: "message" },
  { id: "10", action: "venda_concluida", description: "Camila Rocha confirmou assinatura — R$ 2.900/mês", timestamp: "2026-02-25T16:30:00Z", icon: "check" },
  { id: "11", action: "follow_up", description: "IA enviou proposta revisada para Rafael Nascimento", timestamp: "2026-02-25T16:00:00Z", icon: "refresh" },
  { id: "12", action: "lead_qualificado", description: "IA qualificou Beatriz Lima como lead quente", timestamp: "2026-02-25T15:30:00Z", icon: "target" },
  { id: "13", action: "reuniao_agendada", description: "IA agendou call de fechamento com Gustavo Moreira", timestamp: "2026-02-25T15:00:00Z", icon: "calendar" },
  { id: "14", action: "conversa_iniciada", description: "IA iniciou conversa com Isabela Cardoso", timestamp: "2026-02-25T14:30:00Z", icon: "message" },
  { id: "15", action: "objecao_tratada", description: "IA contornou objeção de timing de Diego Martins", timestamp: "2026-02-25T14:00:00Z", icon: "shield" },
];

export const MOCK_FUNNEL_DATA = [
  { stage: "Leads", value: 247, fill: "hsl(221 83% 53%)" },
  { stage: "Qualificados", value: 142, fill: "hsl(221 83% 60%)" },
  { stage: "Negociando", value: 68, fill: "hsl(152 69% 41%)" },
  { stage: "Vendidos", value: 31, fill: "hsl(152 69% 50%)" },
];

export const MOCK_LEADS_OVER_TIME = [
  { day: "20/02", leads: 18, qualified: 8, sales: 2 },
  { day: "21/02", leads: 24, qualified: 12, sales: 3 },
  { day: "22/02", leads: 31, qualified: 15, sales: 4 },
  { day: "23/02", leads: 28, qualified: 14, sales: 3 },
  { day: "24/02", leads: 42, qualified: 22, sales: 6 },
  { day: "25/02", leads: 55, qualified: 28, sales: 8 },
  { day: "26/02", leads: 49, qualified: 25, sales: 5 },
];
