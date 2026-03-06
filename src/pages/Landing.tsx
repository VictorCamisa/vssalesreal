import { useState, useEffect, FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import vsLogo from "@/assets/vs-sales-logo.png";
import { ParticleCanvas } from "@/components/landing/ParticleCanvas";
import { useScrollAnimation, useAnimatedCounter } from "@/hooks/useScrollAnimation";
import {
  Search, Target, CalendarCheck, DollarSign, CheckCircle2,
  Zap, Clock, TrendingUp, Users, ChevronDown, ArrowRight, Shield,
  Brain, BarChart3, Sparkles, MessageCircle, X, Rocket, Building2,
  Globe, Lock, Send, RefreshCw, Headphones, Eye, BotMessageSquare
} from "lucide-react";

/* ─── scroll-animated wrapper ─── */
function Reveal({ children, className = "", delay = 0, direction = "up" }: { children: React.ReactNode; className?: string; delay?: number; direction?: "up" | "left" | "right" | "scale" }) {
  const { ref, isVisible } = useScrollAnimation(0.1);
  const transforms: Record<string, string> = {
    up: "translateY(40px)",
    left: "translateX(-40px)",
    right: "translateX(40px)",
    scale: "scale(0.92)",
  };
  return (
    <div
      ref={ref}
      className={`transition-all ease-out ${className}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "none" : transforms[direction],
        transitionDuration: "800ms",
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ─── Hero stagger animation ─── */
function HeroLine({ children, delay, className = "" }: { children: React.ReactNode; delay: number; className?: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <span
      className={`block transition-all duration-700 ease-out ${className}`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) skewY(0)" : "translateY(60px) skewY(2deg)",
        filter: visible ? "blur(0)" : "blur(4px)",
      }}
    >
      {children}
    </span>
  );
}

/* ─── FAQ Item ─── */
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[#1a1a2e] rounded-xl overflow-hidden transition-colors hover:border-[#00D4FF]/15">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-[#0d0d1a] transition-colors"
        aria-expanded={open}
      >
        <span className="font-medium text-sm md:text-base text-gray-200 pr-4">{question}</span>
        <ChevronDown className={`h-4 w-4 text-[#00D4FF] shrink-0 transition-transform duration-500 ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        className="grid transition-all duration-500 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-sm text-gray-400 leading-relaxed">{answer}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Flow Step with animated line ─── */
function FlowStep({ step, index, total }: { step: { title: string; desc: string; color: string; emoji: string }; index: number; total: number }) {
  const { ref, isVisible } = useScrollAnimation(0.2);
  return (
    <div ref={ref} className="relative flex flex-col items-center text-center group" style={{ transitionDelay: `${index * 150}ms` }}>
      {index < total - 1 && (
        <div className="hidden md:block absolute top-7 left-[calc(50%+28px)] right-[-50%] h-px z-0">
          <div
            className="h-full transition-all duration-1000 ease-out"
            style={{
              background: `linear-gradient(90deg, ${step.color}, ${step.color}40)`,
              transform: isVisible ? "scaleX(1)" : "scaleX(0)",
              transformOrigin: "left",
              transitionDelay: `${index * 150 + 300}ms`,
            }}
          />
        </div>
      )}
      <div
        className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border transition-all duration-700"
        style={{
          borderColor: isVisible ? `${step.color}40` : "rgba(255,255,255,0.05)",
          backgroundColor: isVisible ? `${step.color}08` : "transparent",
          boxShadow: isVisible ? `0 0 30px ${step.color}15` : "none",
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateY(0) scale(1)" : "translateY(20px) scale(0.8)",
          transitionDelay: `${index * 150}ms`,
        }}
      >
        <span className="text-xl">{step.emoji}</span>
      </div>
      <div className="mt-3 text-[10px] font-mono font-semibold tracking-widest transition-all duration-700"
        style={{ color: isVisible ? step.color : "rgba(255,255,255,0.1)", opacity: isVisible ? 1 : 0, transitionDelay: `${index * 150 + 100}ms` }}>
        0{index + 1}
      </div>
      <h3 className="mt-2 text-sm font-semibold text-white transition-all duration-700"
        style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? "translateY(0)" : "translateY(12px)", transitionDelay: `${index * 150 + 200}ms` }}>
        {step.title}
      </h3>
      <p className="mt-1.5 text-xs text-gray-500 leading-relaxed max-w-[180px] transition-all duration-700"
        style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? "translateY(0)" : "translateY(12px)", transitionDelay: `${index * 150 + 300}ms` }}>
        {step.desc}
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
/*                    LANDING PAGE                     */
/* ═══════════════════════════════════════════════════ */
export default function Landing() {
  const [earlyForm, setEarlyForm] = useState({ name: "", email: "", whatsapp: "" });
  const [earlySubmitted, setEarlySubmitted] = useState(false);
  const [dbPlans, setDbPlans] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("plans").select("*").eq("is_active", true).order("sort_order").then(({ data }) => {
      if (data && data.length > 0) setDbPlans(data);
    });
  }, []);

  const handleEarlySubmit = async (e: FormEvent) => {
    e.preventDefault();
    await supabase.from("site_leads").insert({
      name: earlyForm.name,
      email: earlyForm.email,
      phone: earlyForm.whatsapp,
      form_source: "early_access",
    });
    setEarlySubmitted(true);
    setTimeout(() => setEarlySubmitted(false), 4000);
    setEarlyForm({ name: "", email: "", whatsapp: "" });
  };

  const lowestPrice = dbPlans.length > 0 ? Math.min(...dbPlans.map(p => Number(p.price_monthly))) : null;
  const formattedLowest = lowestPrice != null ? lowestPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 600";

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white overflow-x-hidden" style={{ fontFamily: "'Inter', 'Space Grotesk', sans-serif" }}>

      {/* ═══ NAVBAR ═══ */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0F]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={vsLogo} alt="VS Sales" className="h-8 w-8 sm:h-9 sm:w-9 object-contain" />
            <span style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-lg tracking-wider">VS SALES</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-xs text-gray-400">
            <a href="#problema" className="hover:text-white transition-colors">O Problema</a>
            <a href="#solucao" className="hover:text-white transition-colors">A Solução</a>
            <a href="#como-funciona" className="hover:text-white transition-colors">Como Funciona</a>
            <a href="#diferenciais" className="hover:text-white transition-colors">Diferenciais</a>
            <a href="#planos" className="hover:text-white transition-colors">Planos</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="/auth" className="text-xs font-medium px-3 sm:px-4 py-2 rounded-lg border border-white/10 text-gray-300 hover:text-white hover:border-white/25 transition-all">
              Entrar
            </a>
            <a href="#acesso" className="text-xs font-medium px-3 sm:px-4 py-2 rounded-lg bg-gradient-to-r from-[#00D4FF] to-[#0057FF] text-white hover:shadow-[0_0_20px_rgba(0,212,255,0.3)] transition-all">
              Testar grátis
            </a>
          </div>
        </div>
      </nav>

      {/* ═══ 1. HERO ═══ */}
      <section className="relative min-h-screen flex items-center justify-center pt-14 overflow-hidden">
        <ParticleCanvas />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(rgba(0,212,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,1) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }} />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-5 text-center">
          <HeroLine delay={200}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00D4FF]/20 bg-[#00D4FF]/5 text-[10px] text-[#00D4FF] font-medium mb-6 sm:mb-8 tracking-wider uppercase">
              <Sparkles className="h-3 w-3" /> Powered by VS Soluções Labs
            </div>
          </HeroLine>

          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-4xl sm:text-7xl md:text-8xl lg:text-9xl leading-[0.9] tracking-tight mb-5 sm:mb-6">
            <HeroLine delay={400}>Sua equipe comercial</HeroLine>
            <HeroLine delay={600}>inteira.</HeroLine>
            <HeroLine delay={900} className="bg-gradient-to-r from-[#00D4FF] to-[#0057FF] bg-clip-text text-transparent">Só que é IA.</HeroLine>
          </h1>

          <HeroLine delay={1200}>
            <p className="text-gray-400 max-w-xl mx-auto text-sm sm:text-base md:text-lg leading-relaxed mb-6 sm:mb-8 px-2">
              SDR, BDR e Closer autônomos. 24/7. Por {formattedLowest}/mês.
            </p>
          </HeroLine>

          <HeroLine delay={1500}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8 sm:mb-12 px-2">
              <a
                href="#acesso"
                className="group flex items-center gap-2 px-6 sm:px-8 py-3.5 rounded-lg bg-gradient-to-r from-[#00D4FF] to-[#0057FF] font-semibold text-sm hover:shadow-[0_0_30px_rgba(0,212,255,0.4)] transition-all duration-300 hover:scale-[1.03] w-full sm:w-auto justify-center"
              >
                Testar grátis por 7 dias
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
              </a>
            </div>
          </HeroLine>

          <HeroLine delay={1800}>
            <p className="text-[10px] text-gray-600">Sem cartão de crédito • Setup em menos de 48h • Cancele quando quiser</p>
          </HeroLine>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0A0A0F] to-transparent" />
      </section>

      {/* ═══ 2. BARRA DE CREDIBILIDADE ═══ */}
      <section className="py-8 sm:py-12 border-b border-[#1a1a2e]/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-5">
          <Reveal>
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-center">
              {[
                { label: "Operação", value: "24/7", sub: "sem pausa" },
                { label: "Setup", value: "< 48h", sub: "para começar" },
                { label: "Economia", value: "até 80%", sub: "vs time humano" },
                { label: "Resposta", value: "< 5 min", sub: "ao novo lead" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <p className="text-xl sm:text-2xl font-bold text-[#00D4FF]" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em" }}>
                    {item.value}
                  </p>
                  <div className="text-left">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider leading-tight">{item.label}</p>
                    <p className="text-[9px] text-gray-600">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ 3. O PROBLEMA ═══ */}
      <section id="problema" className="py-16 sm:py-24 md:py-32 relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-5">
          <Reveal>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#00D4FF] font-medium mb-3">O problema</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-2xl sm:text-3xl md:text-5xl tracking-tight mb-4">
              Seu time comercial está te custando<br className="hidden sm:block" />
              <span className="text-gray-500">mais do que deveria.</span>
            </h2>
            <p className="text-gray-400 text-xs sm:text-sm max-w-xl mb-8 sm:mb-12">
              Enquanto você paga salários, encargos e treinamento, sua concorrência já automatizou o comercial inteiro.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
            {[
              { icon: Users, title: "SDR custa R$ 3.500/mês", desc: "E prospecta no máximo 40 leads por dia. Com hora de almoço, férias e 13º." },
              { icon: Target, title: "Qualificação inconsistente", desc: "Cada SDR tem um critério diferente. Seu Closer perde tempo com leads que nunca vão comprar." },
              { icon: Clock, title: "Follow-up que nunca acontece", desc: "67% dos leads são abandonados após o primeiro contato. Dinheiro no lixo." },
              { icon: BarChart3, title: "Pipeline fictício", desc: "CRM desatualizado, forecast que não bate, decisões no achismo. Todo mês a mesma história." },
            ].map((card, i) => (
              <Reveal key={card.title} delay={i * 100}>
                <div className="group p-4 sm:p-5 rounded-xl border border-[#1a1a2e] bg-[#0d0d18]/60 hover:border-red-500/20 hover:bg-red-500/[0.03] transition-all duration-300">
                  <card.icon className="h-5 w-5 text-red-400/70 mb-2 sm:mb-3" />
                  <h3 className="text-xs sm:text-sm font-semibold text-white mb-1">{card.title}</h3>
                  <p className="text-[10px] sm:text-xs text-gray-500 leading-relaxed">{card.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 4. A SOLUÇÃO ═══ */}
      <section id="solucao" className="py-16 sm:py-24 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#00D4FF]/[0.02] to-transparent" />
        <div className="max-w-6xl mx-auto px-4 sm:px-5 relative z-10">
          <Reveal>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#00D4FF] font-medium mb-3 text-center">A solução</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-2xl sm:text-3xl md:text-5xl tracking-tight mb-4 text-center">
              Conheça o VS SALES
            </h2>
            <p className="text-gray-400 text-xs sm:text-sm max-w-2xl mx-auto text-center mb-10 sm:mb-14">
              Uma plataforma de IA que substitui SDR, BDR e Closer. Prospecta, qualifica, agenda e fecha — tudo automatizado,
              24 horas por dia, 7 dias por semana. Sem férias, sem encargos, sem desculpas.
            </p>
          </Reveal>

          {/* Dashboard mockup visual */}
          <Reveal delay={200}>
            <div className="relative max-w-4xl mx-auto rounded-2xl border border-[#00D4FF]/20 bg-[#0d0d18]/80 p-1 overflow-hidden"
              style={{ boxShadow: "0 0 80px rgba(0,212,255,0.08)" }}>
              <div className="rounded-xl bg-[#0b0e14] p-4 sm:p-6">
                {/* Fake dashboard header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500/60" />
                    <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
                    <div className="h-3 w-3 rounded-full bg-green-500/60" />
                  </div>
                  <span className="text-[9px] text-gray-600 font-mono">app.vssales.com.br/dashboard</span>
                </div>
                {/* Fake metrics grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "Leads Hoje", val: "47", change: "+12%", color: "#00D4FF" },
                    { label: "Pipeline", val: "R$ 234k", change: "+8%", color: "#0057FF" },
                    { label: "Conversão", val: "23%", change: "+5%", color: "#00D4FF" },
                    { label: "Agendamentos", val: "12", change: "+3", color: "#0057FF" },
                  ].map(m => (
                    <div key={m.label} className="rounded-lg border border-[#1a1a2e] bg-[#0d0d18] p-3">
                      <p className="text-[9px] text-gray-500 uppercase tracking-wider">{m.label}</p>
                      <p className="text-lg font-bold text-white mt-1" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{m.val}</p>
                      <p className="text-[9px] font-medium mt-0.5" style={{ color: m.color }}>{m.change}</p>
                    </div>
                  ))}
                </div>
                {/* Fake chart bars */}
                <div className="flex items-end gap-1.5 h-20 px-2">
                  {[40, 55, 35, 70, 60, 80, 45, 90, 65, 75, 50, 85].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t transition-all duration-700" style={{
                      height: `${h}%`,
                      background: `linear-gradient(to top, #00D4FF40, #0057FF60)`,
                    }} />
                  ))}
                </div>
              </div>
              {/* Glow overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#00D4FF]/[0.03] to-transparent pointer-events-none rounded-2xl" />
            </div>
          </Reveal>

          {/* Quick features under mockup */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 max-w-4xl mx-auto">
            {[
              { icon: BotMessageSquare, label: "IA Vendedora 24/7" },
              { icon: MessageCircle, label: "WhatsApp Nativo" },
              { icon: BarChart3, label: "CRM Automático" },
              { icon: CalendarCheck, label: "Agenda Inteligente" },
            ].map((f, i) => (
              <Reveal key={f.label} delay={i * 80}>
                <div className="flex items-center gap-2 p-3 rounded-lg border border-[#1a1a2e] bg-[#0d0d18]/60">
                  <f.icon className="h-4 w-4 text-[#00D4FF]" />
                  <span className="text-xs text-gray-300">{f.label}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 5. COMO FUNCIONA ═══ */}
      <section id="como-funciona" className="py-16 sm:py-24 md:py-36 relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-5 relative z-10">
          <Reveal>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#00D4FF] font-medium mb-3 text-center">Como funciona</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-2xl sm:text-3xl md:text-5xl tracking-tight mb-3 text-center">
              Da prospecção ao fechamento.
            </h2>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-2xl sm:text-3xl md:text-5xl tracking-tight mb-10 sm:mb-16 text-center text-gray-500">
              Sem intervenção humana.
            </p>
          </Reveal>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6 md:gap-4">
            {[
              { emoji: "🔍", title: "Prospecção Ativa", desc: "IA mapeia leads do seu ICP em tempo real via web e redes.", color: "#00D4FF" },
              { emoji: "🧩", title: "Enriquecimento", desc: "Contato, empresa, cargo e dados complementados automaticamente.", color: "#00A0FF" },
              { emoji: "🎯", title: "Qualificação IA", desc: "Score inteligente de 0-100%. Só leads quentes avançam.", color: "#0057FF" },
              { emoji: "💬", title: "Abordagem WhatsApp", desc: "Mensagem personalizada enviada direto no WhatsApp do lead.", color: "#0057FF" },
              { emoji: "📅", title: "Agendamento Auto", desc: "Reunião marcada sem intervenção humana.", color: "#0070FF" },
              { emoji: "💰", title: "Fechamento", desc: "IA conduz a negociação ou encaminha ao Closer humano.", color: "#00D4FF" },
            ].map((step, i, arr) => (
              <FlowStep key={step.title} step={step} index={i} total={arr.length} />
            ))}
          </div>

          <Reveal delay={900}>
            <div className="mt-16 flex items-center justify-center">
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full border border-[#00D4FF]/15 bg-[#00D4FF]/[0.03]">
                <div className="flex -space-x-1">
                  {["#00D4FF", "#0057FF", "#0070FF"].map(c => (
                    <div key={c} className="h-2 w-2 rounded-full" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <p className="text-xs text-gray-400">
                  Tudo isso em <span className="text-[#00D4FF] font-semibold">modo 100% automático</span>
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ 6. PARA QUEM É ═══ */}
      <section className="py-16 sm:py-24 md:py-32 bg-[#070712]">
        <div className="max-w-6xl mx-auto px-4 sm:px-5">
          <Reveal>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#00D4FF] font-medium mb-3 text-center">Para quem é</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-2xl sm:text-3xl md:text-5xl tracking-tight mb-4 text-center">
              O VS SALES é para quem<br /><span className="text-gray-500">quer vender mais gastando menos.</span>
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-4 mt-10 sm:mt-14">
            {[
              {
                icon: Rocket, color: "#00D4FF", title: "Startups B2B",
                desc: "Você não tem verba para contratar 3 SDRs. Mas precisa de pipeline. O VS SALES é seu time comercial inteiro por uma fração do custo.",
                scenario: "\"Tínhamos 0 SDRs e precisávamos de 50 reuniões/mês. Agora temos.\"",
              },
              {
                icon: Building2, color: "#0057FF", title: "PMEs com time enxuto",
                desc: "Seu vendedor prospecta, qualifica, fecha e ainda faz pós-venda. Com o VS SALES, ele só faz o que importa: fechar.",
                scenario: "\"Meu closer agora recebe leads quentes prontos. Triplicou a conversão.\"",
              },
              {
                icon: Globe, color: "#00D4FF", title: "Agências que revendem",
                desc: "White-label pronto. Coloque sua marca, revenda para seus clientes e ganhe receita recorrente sem desenvolver nada.",
                scenario: "\"Adicionei R$ 15k/mês de receita recorrente revendendo o VS SALES.\"",
              },
            ].map((card, i) => (
              <Reveal key={card.title} delay={i * 120}>
                <div className="rounded-xl border border-[#1a1a2e] bg-[#0d0d18]/60 p-6 h-full flex flex-col hover:border-[#00D4FF]/15 transition-all duration-300">
                  <card.icon className="h-6 w-6 mb-4" style={{ color: card.color }} />
                  <h3 className="text-base font-semibold text-white mb-2">{card.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed mb-4 flex-1">{card.desc}</p>
                  <div className="rounded-lg bg-[#00D4FF]/[0.04] border border-[#00D4FF]/10 p-3">
                    <p className="text-[11px] text-[#00D4FF] italic leading-relaxed">{card.scenario}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 7. DIFERENCIAIS ═══ */}
      <section id="diferenciais" className="py-16 sm:py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-5">
          <Reveal>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#00D4FF] font-medium mb-3 text-center">Diferenciais</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-2xl sm:text-3xl md:text-5xl tracking-tight mb-4 text-center">
              Tudo que você precisa.<br /><span className="text-gray-500">Nada que você não precisa.</span>
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10 sm:mt-14">
            {[
              { icon: Search, title: "Prospecção Autônoma", desc: "IA rastreia leads ideais via Google Maps, LinkedIn e web scraping. Sem trabalho manual." },
              { icon: MessageCircle, title: "WhatsApp Nativo", desc: "Integração direta com WhatsApp via Evolution API. Mensagens personalizadas, não spam." },
              { icon: BarChart3, title: "CRM Inteligente", desc: "Pipeline atualizado automaticamente. Drag-and-drop com automação em cada estágio." },
              { icon: Brain, title: "IA Treinável", desc: "Ensine sua IA com documentos, FAQs e tom de voz. Ela vende do jeito que você venderia." },
              { icon: Send, title: "Disparos em Massa", desc: "Broadcasts segmentados com variáveis dinâmicas. Milhares de mensagens, zero esforço." },
              { icon: CalendarCheck, title: "Agendamento Automático", desc: "A IA marca reuniões diretamente na agenda do seu Closer. Sem ping-pong de horários." },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <div className="group p-5 rounded-xl border border-[#1a1a2e] bg-[#0d0d18]/60 hover:border-[#00D4FF]/20 hover:bg-[#00D4FF]/[0.02] transition-all duration-300">
                  <f.icon className="h-5 w-5 text-[#00D4FF] mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="text-sm font-semibold text-white mb-1.5">{f.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 8. COMPARATIVO ═══ */}
      <section id="comparativo" className="py-16 sm:py-24 md:py-32 bg-[#070712]">
        <div className="max-w-4xl mx-auto px-4 sm:px-5">
          <Reveal>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#00D4FF] font-medium mb-3 text-center">Comparativo</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-2xl sm:text-3xl md:text-5xl tracking-tight mb-10 sm:mb-14 text-center">
              Time Humano <span className="text-gray-500">vs</span> VS SALES
            </h2>
          </Reveal>

          <Reveal>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left p-4 text-gray-500 text-xs font-medium" />
                    <th className="p-4 text-center text-gray-400 text-xs font-medium">Time Humano</th>
                    <th className="p-4 text-center rounded-t-xl border-t border-x border-[#00D4FF]/30 bg-[#00D4FF]/[0.03]">
                      <span className="text-xs font-semibold text-[#00D4FF]">VS SALES</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {[
                    ["Custo mensal", "R$ 10.000 – 15.000+", `A partir de ${formattedLowest}`],
                    ["Horário de operação", "8h/dia, seg-sex", "24/7/365"],
                    ["Consistência", "Depende do humor", "100% todo dia"],
                    ["Escalabilidade", "Contratar + treinar (90 dias)", "Imediata (< 48h)"],
                    ["Integração CRM", "Manual (se fizer)", "Automática em tempo real"],
                    ["Tempo de ramp-up", "30-90 dias", "< 48 horas"],
                    ["Follow-up", "Esquecido em 67% dos casos", "100% garantido"],
                    ["Férias / 13º / Encargos", "Sim", "Não"],
                  ].map(([feature, human, vs]) => (
                    <tr key={feature} className="border-b border-[#1a1a2e]/50">
                      <td className="p-4 text-gray-400 font-medium">{feature}</td>
                      <td className="p-4 text-center text-gray-500">{human}</td>
                      <td className="p-4 text-center border-x border-[#00D4FF]/30 bg-[#00D4FF]/[0.03] text-white font-medium">{vs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ 9. PLANOS & PREÇOS ═══ */}
      <section id="planos" className="py-16 sm:py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-5">
          <Reveal>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#00D4FF] font-medium mb-3 text-center">Planos & Preços</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-2xl sm:text-3xl md:text-5xl tracking-tight mb-4 text-center">
              Escolha o plano ideal<br /><span className="text-gray-500">para sua operação.</span>
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 text-center mb-8 sm:mb-12 max-w-2xl mx-auto">
              Todos os planos incluem operação 24/7, integração com CRM e suporte dedicado.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
            {(dbPlans.length > 0 ? dbPlans.map((p, i) => ({
              name: p.name,
              subtitle: p.description || "",
              price: Number(p.price_monthly).toLocaleString("pt-BR"),
              color: ["#00D4FF", "#0057FF", "#00D4FF"][i % 3],
              popular: p.is_popular,
              features: Array.isArray(p.features) ? p.features : [],
              cta: p.is_popular ? `Escolher ${p.name}` : i === 0 ? `Começar com ${p.name}` : "Falar com comercial",
              slug: p.slug,
            })) : [
              {
                name: "Starter", subtitle: "O SDR Digital", price: "600", color: "#00D4FF", popular: false,
                features: ["Prospecção ativa automática", "Qualificação com IA", "WhatsApp integrado", "Dashboard de métricas", "Operação 24/7", "Suporte por chat"],
                cta: "Começar com Starter", slug: "starter",
              },
              {
                name: "Pro", subtitle: "A Equipe Completa", price: "1.200", color: "#0057FF", popular: true,
                features: ["Tudo do Starter, mais:", "Closer com IA", "Score de qualificação avançado", "Agendamentos automáticos", "CRM completo", "Disparos em massa", "Suporte prioritário"],
                cta: "Escolher Pro", slug: "pro",
              },
              {
                name: "Agency", subtitle: "White-Label", price: "2.400", color: "#00D4FF", popular: false,
                features: ["Tudo do Pro, mais:", "White-label com sua marca", "Múltiplas instâncias de IA", "Gestão multi-cliente", "API completa", "Onboarding dedicado", "Revenue share"],
                cta: "Falar com comercial", slug: "agency",
              },
            ]).map((plan) => (
              <Reveal key={plan.name}>
                <div
                  className={`relative rounded-2xl border p-6 flex flex-col h-full transition-all duration-300 hover:translate-y-[-4px] ${
                    plan.popular
                      ? "border-[#0057FF]/50 bg-gradient-to-b from-[#0057FF]/[0.08] to-transparent shadow-[0_0_40px_rgba(0,87,255,0.12)]"
                      : "border-[#1a1a2e] bg-[#0d0d18]/60 hover:border-[#1a1a2e]/80"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#0057FF] text-white">
                        Mais popular
                      </span>
                    </div>
                  )}
                  <div className="mb-5">
                    <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-1" style={{ color: plan.color }}>{plan.subtitle}</p>
                    <h3 className="text-xl font-bold text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em" }}>{plan.name}</h3>
                  </div>
                  <div className="mb-5">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs text-gray-500">R$</span>
                      <span className="text-4xl font-black text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{plan.price}</span>
                      <span className="text-xs text-gray-500">/mês</span>
                    </div>
                  </div>
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((f: string) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-gray-300">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: plan.color }} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href={`/checkout?plan=${plan.slug || plan.name.toLowerCase()}`}
                    className={`w-full text-center py-3 rounded-xl text-sm font-semibold transition-all duration-300 block ${
                      plan.popular
                        ? "bg-gradient-to-r from-[#0057FF] to-[#00D4FF] text-white hover:shadow-[0_0_30px_rgba(0,87,255,0.3)]"
                        : "border text-white hover:bg-white/[0.05]"
                    }`}
                    style={!plan.popular ? { borderColor: `${plan.color}30` } : undefined}
                  >
                    {plan.cta}
                  </a>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 10. GARANTIA ═══ */}
      <section className="py-16 sm:py-24 md:py-28 bg-[#070712]">
        <div className="max-w-3xl mx-auto px-4 sm:px-5">
          <Reveal>
            <div className="rounded-2xl border border-[#00D4FF]/15 bg-[#0d0d18]/60 p-8 sm:p-10 text-center"
              style={{ boxShadow: "0 0 60px rgba(0,212,255,0.04)" }}>
              <div className="flex items-center justify-center gap-3 mb-5">
                <Shield className="h-6 w-6 text-[#00D4FF]" />
                <Lock className="h-5 w-5 text-[#00D4FF]/70" />
                <CheckCircle2 className="h-6 w-6 text-[#00D4FF]" />
              </div>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-2xl sm:text-3xl md:text-4xl tracking-tight mb-3">
                Sem contrato. Sem multa.<br />Cancele quando quiser.
              </h2>
              <p className="text-sm text-gray-400 max-w-lg mx-auto leading-relaxed">
                Teste o VS SALES por 7 dias grátis. Se não funcionar pra você, cancele com um clique.
                Sem burocracia, sem pegadinha, sem fidelidade. A gente confia no produto.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ 11. FAQ ═══ */}
      <section id="faq" className="py-16 sm:py-24 md:py-32">
        <div className="max-w-2xl mx-auto px-4 sm:px-5">
          <Reveal>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#00D4FF] font-medium mb-3 text-center">Perguntas frequentes</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-2xl sm:text-3xl md:text-4xl tracking-tight mb-10 text-center">
              Tire suas dúvidas
            </h2>
          </Reveal>

          <div className="space-y-2">
            {[
              { q: "O VS SALES substitui 100% do meu time comercial?", a: "Para operações com ticket médio até R$ 5.000, sim — prospecção, qualificação e fechamento são 100% automatizados. Para tickets maiores, recomendamos que um Closer humano assuma a etapa final após a qualificação da IA." },
              { q: "Quanto tempo leva para configurar?", a: "Menos de 48 horas. O onboarding é guiado: você cadastra sua empresa, define o ICP, conecta o WhatsApp e a IA já começa a operar." },
              { q: "Funciona para meu segmento?", a: "Sim. O VS SALES se adapta a qualquer segmento B2B ou B2C. Você define o perfil ideal de cliente e os critérios de qualificação — a IA faz o resto." },
              { q: "E se o lead não quiser falar com IA?", a: "O sistema é 100% configurável. Você define que leads acima de um determinado score sejam direcionados direto para um humano, sem passar pela IA de fechamento." },
              { q: "Preciso ter WhatsApp Business?", a: "Você precisa de um número de WhatsApp dedicado. O VS SALES conecta via API (Evolution API) e opera de forma autônoma, sem precisar do celular ligado." },
              { q: "Posso cancelar a qualquer momento?", a: "Sim. Sem contrato, sem multa, sem fidelidade. Cancele com um clique quando quiser. Simples assim." },
              { q: "Como o VS SALES é diferente de um chatbot?", a: "Chatbots seguem scripts fixos. O VS SALES usa IA treinável que entende contexto, personaliza abordagens, qualifica com score inteligente e conduz negociações completas. É um vendedor, não um robô de FAQ." },
            ].map((item) => (
              <Reveal key={item.q}>
                <FAQItem question={item.q} answer={item.a} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 12. CTA FINAL + FORMULÁRIO ═══ */}
      <section id="acesso" className="py-16 sm:py-24 md:py-32 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#00D4FF]/[0.02] to-transparent" />
        <div className="max-w-lg mx-auto px-4 sm:px-5 relative z-10">
          <Reveal>
            <div className="text-center mb-8">
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl sm:text-4xl md:text-5xl tracking-tight mb-3">
                Sua concorrência já vai usar.<br />
                <span className="bg-gradient-to-r from-[#00D4FF] to-[#0057FF] bg-clip-text text-transparent">Você vai esperar?</span>
              </h2>
              <p className="text-sm text-gray-400">Comece agora. 7 dias grátis. Sem cartão.</p>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div className="rounded-2xl border border-[#00D4FF]/20 bg-[#0d0d18]/80 p-6 sm:p-8 backdrop-blur-sm"
              style={{ boxShadow: "0 0 60px rgba(0,212,255,0.06)" }}>

              {earlySubmitted ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="h-8 w-8 text-[#00D4FF] mx-auto mb-3" />
                  <p className="text-sm font-medium text-white">Acesso garantido! 🎉</p>
                  <p className="text-xs text-gray-400 mt-1">Você receberá um e-mail com os próximos passos.</p>
                </div>
              ) : (
                <form onSubmit={handleEarlySubmit} className="space-y-3">
                  <input required value={earlyForm.name} onChange={e => setEarlyForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Seu nome" className="w-full px-4 py-3 rounded-lg bg-[#0A0A0F] border border-[#1a1a2e] text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#00D4FF]/40 transition-colors" />
                  <input required type="email" value={earlyForm.email} onChange={e => setEarlyForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="Seu melhor e-mail" className="w-full px-4 py-3 rounded-lg bg-[#0A0A0F] border border-[#1a1a2e] text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#00D4FF]/40 transition-colors" />
                  <input value={earlyForm.whatsapp} onChange={e => setEarlyForm(p => ({ ...p, whatsapp: e.target.value }))}
                    placeholder="WhatsApp (opcional)" className="w-full px-4 py-3 rounded-lg bg-[#0A0A0F] border border-[#1a1a2e] text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#00D4FF]/40 transition-colors" />
                  <button type="submit"
                    className="w-full py-3.5 rounded-lg bg-gradient-to-r from-[#00D4FF] to-[#0057FF] text-sm font-bold text-white hover:shadow-[0_0_30px_rgba(0,212,255,0.4)] transition-all">
                    Quero testar grátis por 7 dias →
                  </button>
                </form>
              )}

              <p className="text-[10px] text-gray-600 mt-4 text-center">Sem cartão de crédito. Sem compromisso. Com resultado.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ 13. FOOTER ═══ */}
      <footer className="border-t border-[#1a1a2e] py-8 sm:py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
            <div className="flex items-center gap-2">
              <img src={vsLogo} alt="VS Soluções" className="h-7 w-7 object-contain" />
              <div>
                <span className="text-xs font-semibold text-white">VS Soluções</span>
                <span className="text-[10px] text-gray-600 ml-2 hidden sm:inline">Tecnologia que substitui. Resultado que comprova.</span>
              </div>
            </div>
            <div className="flex items-center gap-4 sm:gap-6 text-[10px] text-gray-600 flex-wrap justify-center">
              <a href="#" className="hover:text-gray-400 transition-colors">Privacidade</a>
              <a href="#" className="hover:text-gray-400 transition-colors">Termos</a>
              <a href="#" className="hover:text-gray-400 transition-colors">Contato</a>
              <a href="/auth" className="hover:text-[#00D4FF] transition-colors">Entrar</a>
              <a href="/admin" className="hover:text-[#00D4FF] transition-colors flex items-center gap-1">
                <Shield className="h-3 w-3" />Admin
              </a>
            </div>
          </div>
          <p className="text-[10px] text-gray-700 text-center mt-4 sm:mt-6">© 2026 VS Soluções. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* Smooth scroll */}
      <style>{`
        html { scroll-behavior: smooth; }
      `}</style>
    </div>
  );
}
