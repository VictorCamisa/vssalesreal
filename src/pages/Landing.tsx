import { useState, useEffect, useRef, FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import vsLogo from "@/assets/vs-logo.png";
import { ParticleCanvas } from "@/components/landing/ParticleCanvas";
import { useScrollAnimation, useAnimatedCounter } from "@/hooks/useScrollAnimation";
import {
  Search, PuzzleIcon, Target, CalendarCheck, DollarSign, CheckCircle2,
  Zap, Clock, TrendingUp, Users, ChevronDown, ArrowRight, Shield, Send,
  Brain, BarChart3, Sparkles, Phone, Building2, Mail, MessageCircle, X
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

/* ─── counter component ─── */
function Counter({ end, suffix = "", prefix = "" }: { end: number; suffix?: string; prefix?: string }) {
  const { ref, value } = useAnimatedCounter(end, 2200);
  return <span ref={ref}>{prefix}{value.toLocaleString("pt-BR")}{suffix}</span>;
}

/* ─── Flow Step with animated line ─── */
function FlowStep({ step, index, total }: { step: { icon: any; title: string; desc: string; color: string; emoji: string }; index: number; total: number }) {
  const { ref, isVisible } = useScrollAnimation(0.2);

  return (
    <div ref={ref} className="relative flex flex-col items-center text-center group" style={{ transitionDelay: `${index * 150}ms` }}>
      {/* Connector line */}
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

      {/* Node */}
      <div
        className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border transition-all duration-700"
        style={{
          borderColor: isVisible ? `${step.color}40` : "rgba(255,255,255,0.05)",
          backgroundColor: isVisible ? `${step.color}08` : "transparent",
          boxShadow: isVisible ? `0 0 30px ${step.color}15, inset 0 0 20px ${step.color}05` : "none",
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateY(0) scale(1)" : "translateY(20px) scale(0.8)",
          transitionDelay: `${index * 150}ms`,
        }}
      >
        <span className="text-xl">{step.emoji}</span>
      </div>

      {/* Step number */}
      <div
        className="mt-3 text-[10px] font-mono font-semibold tracking-widest transition-all duration-700"
        style={{
          color: isVisible ? step.color : "rgba(255,255,255,0.1)",
          opacity: isVisible ? 1 : 0,
          transitionDelay: `${index * 150 + 100}ms`,
        }}
      >
        0{index + 1}
      </div>

      {/* Title */}
      <h3
        className="mt-2 text-sm font-semibold text-white transition-all duration-700"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateY(0)" : "translateY(12px)",
          transitionDelay: `${index * 150 + 200}ms`,
        }}
      >
        {step.title}
      </h3>

      {/* Description */}
      <p
        className="mt-1.5 text-xs text-gray-500 leading-relaxed max-w-[180px] transition-all duration-700"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateY(0)" : "translateY(12px)",
          transitionDelay: `${index * 150 + 300}ms`,
        }}
      >
        {step.desc}
      </p>

      {/* Hover glow */}
      <div
        className="absolute -inset-3 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10"
        style={{ background: `radial-gradient(circle, ${step.color}06, transparent 70%)` }}
      />
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

/* ═══════════════════════════════════════════════════ */
/*                    LANDING PAGE                     */
/* ═══════════════════════════════════════════════════ */
export default function Landing() {
  const [earlyForm, setEarlyForm] = useState({ name: "", email: "", whatsapp: "" });
  const [earlySubmitted, setEarlySubmitted] = useState(false);
  const [partnerForm, setPartnerForm] = useState({ name: "", email: "", company: "", type: "", message: "" });
  const [partnerSubmitted, setPartnerSubmitted] = useState(false);

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

  const handlePartnerSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await supabase.from("site_leads").insert({
      name: partnerForm.name,
      email: partnerForm.email,
      company: partnerForm.company,
      partnership_type: partnerForm.type,
      message: partnerForm.message,
      form_source: "partnership",
    });
    setPartnerSubmitted(true);
    setTimeout(() => setPartnerSubmitted(false), 4000);
    setPartnerForm({ name: "", email: "", company: "", type: "", message: "" });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white overflow-x-hidden" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>

      {/* ═══ NAVBAR ═══ */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0F]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={vsLogo} alt="VS Soluções" className="h-9 w-9 object-contain" />
            <span style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-lg tracking-wider">VS SALES</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-xs text-gray-400">
            <a href="#problema" className="hover:text-white transition-colors">O Problema</a>
            <a href="#como-funciona" className="hover:text-white transition-colors">Como Funciona</a>
            <a href="#comparativo" className="hover:text-white transition-colors">Comparativo</a>
            <a href="#parceiros" className="hover:text-white transition-colors">Parceiros</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>
          <a href="#acesso" className="text-xs font-medium px-4 py-2 rounded-lg bg-gradient-to-r from-[#00D4FF] to-[#0057FF] text-white hover:shadow-[0_0_20px_rgba(0,212,255,0.3)] transition-all">
            Quero acesso
          </a>
        </div>
      </nav>

      {/* ═══ 1. HERO ═══ */}
      <section className="relative min-h-screen flex items-center justify-center pt-14 overflow-hidden">
        <ParticleCanvas />

        {/* Grid lines bg */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(rgba(0,212,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,1) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }} />

        <div className="relative z-10 max-w-4xl mx-auto px-5 text-center">
          <HeroLine delay={200}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00D4FF]/20 bg-[#00D4FF]/5 text-[10px] text-[#00D4FF] font-medium mb-8 tracking-wider uppercase">
              <Sparkles className="h-3 w-3" /> Powered by VS Soluções Labs
            </div>
          </HeroLine>

          <h1
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl leading-[0.9] tracking-tight mb-6"
          >
            <HeroLine delay={400}>Prospecção.</HeroLine>
            <HeroLine delay={600}>Qualificação.</HeroLine>
            <HeroLine delay={800} className="bg-gradient-to-r from-[#00D4FF] to-[#00FF88] bg-clip-text text-transparent glitch-text">Fechamento.</HeroLine>
            <HeroLine delay={1100} className="text-gray-500 text-3xl sm:text-4xl md:text-5xl mt-2">Sem humanos.</HeroLine>
          </h1>

          <HeroLine delay={1400}>
            <p className="text-gray-400 max-w-xl mx-auto text-sm md:text-base leading-relaxed mb-8">
              O VS SALES substitui sua equipe comercial inteira com IA. SDR, BDR, Closer — tudo automatizado, 24/7, por uma fração do custo.
            </p>
          </HeroLine>

          <HeroLine delay={1700}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
              <a
                href="#acesso"
                className="group flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-[#00D4FF] to-[#0057FF] font-medium text-sm hover:shadow-[0_0_30px_rgba(0,212,255,0.4)] transition-all duration-300 hover:scale-[1.03]"
              >
                Quero ver o VS SALES em ação
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
              </a>
              <a
                href="#como-funciona"
                className="flex items-center gap-2 px-6 py-3 rounded-lg border border-white/10 text-sm text-gray-300 hover:border-white/25 hover:text-white transition-all duration-300"
              >
                Como funciona?
              </a>
            </div>
          </HeroLine>

          {/* Counters */}
          <HeroLine delay={2000}>
            <div className="flex items-center justify-center gap-8 md:gap-12 text-center">
              <div>
                <p className="text-2xl md:text-3xl font-bold text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em" }}>
                  <Counter end={12400} />
                </p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Leads qualificados</p>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div>
                <p className="text-2xl md:text-3xl font-bold text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em" }}>
                  <Counter end={8300} suffix="h" />
                </p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Horas economizadas</p>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div>
                <p className="text-2xl md:text-3xl font-bold text-[#00FF88]" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em" }}>
                  <Counter end={97} suffix="%" />
                </p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Satisfação</p>
              </div>
            </div>
          </HeroLine>
        </div>

        {/* Gradient fade bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0A0A0F] to-transparent" />
      </section>

      {/* ═══ 2. O PROBLEMA ═══ */}
      <section id="problema" className="py-24 md:py-32 relative">
        <div className="max-w-6xl mx-auto px-5">
          <Reveal>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#00D4FF] font-medium mb-3">O problema</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl md:text-5xl tracking-tight mb-4">
              Você ainda paga salário para alguém<br />
              <span className="text-gray-500">procurar lead no LinkedIn?</span>
            </h2>
            <p className="text-gray-400 text-sm max-w-xl mb-12">Enquanto isso, sua concorrência já opera com IA 24/7.</p>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-4 mb-12">
            {[
              { icon: Users, title: "SDR custa R$ 3.500/mês", desc: "E prospecta no máximo 40 leads por dia. Nos bons dias." },
              { icon: Target, title: "BDR qualifica errado", desc: "Desperdiça o tempo do Closer com leads que nunca vão comprar." },
              { icon: DollarSign, title: "Closer fecha 20%", desc: "Mas passa 60% do dia lidando com leads frios e desqualificados." },
              { icon: BarChart3, title: "Planilha e CRM desatualizado", desc: "Follow-up esquecido. Pipeline fictício. Forecast que nunca bate." },
            ].map((card, i) => (
              <Reveal key={card.title} delay={i * 100}>
                <div className="group p-5 rounded-xl border border-[#1a1a2e] bg-[#0d0d18]/60 hover:border-red-500/20 hover:bg-red-500/[0.03] transition-all duration-300">
                  <card.icon className="h-5 w-5 text-red-400/70 mb-3" />
                  <h3 className="text-sm font-semibold text-white mb-1">{card.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{card.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Comparison */}
          <Reveal>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-red-500/15 bg-red-500/[0.03] p-6">
                <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-4">❌ Time Humano</p>
                <ul className="space-y-2.5 text-xs text-gray-400">
                  {["Alto custo mensal fixo", "Horário limitado (8h/dia)", "Inconsistência na prospecção", "Follow-up esquecido", "Treinamento constante"].map(item => (
                    <li key={item} className="flex items-center gap-2"><X className="h-3 w-3 text-red-400/60 shrink-0" />{item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-[#00D4FF]/20 bg-[#00D4FF]/[0.03] p-6">
                <p className="text-xs font-semibold text-[#00D4FF] uppercase tracking-wider mb-4">✅ VS SALES</p>
                <ul className="space-y-2.5 text-xs text-gray-300">
                  {["Custo fixo previsível", "Operação 24/7 sem pausa", "100% de consistência", "Follow-up automático e inteligente", "Aprende sozinho com cada interação"].map(item => (
                    <li key={item} className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-[#00FF88] shrink-0" />{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ 3. COMO FUNCIONA ═══ */}
      <section id="como-funciona" className="py-24 md:py-36 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#00D4FF]/[0.02] to-transparent" />
        <div className="max-w-6xl mx-auto px-5 relative z-10">
          <Reveal>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#00D4FF] font-medium mb-3 text-center">Como funciona</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl md:text-5xl tracking-tight mb-3 text-center">
              Um sistema. Quatro papéis.
            </h2>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl md:text-5xl tracking-tight mb-16 text-center text-gray-500">
              Zero desperdício.
            </p>
          </Reveal>

          {/* Horizontal pipeline */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 md:gap-4">
            {[
              { icon: Search, emoji: "🔍", title: "Prospecção Inteligente", desc: "IA rastreia e mapeia leads do ICP ideal em tempo real.", color: "#00D4FF" },
              { icon: PuzzleIcon, emoji: "🧩", title: "Enriquecimento", desc: "Contato, empresa, cargo e redes sociais completados.", color: "#00A0FF" },
              { icon: Target, emoji: "🎯", title: "Score de Qualificação", desc: "Cada lead recebe pontuação de 0 a 100%.", color: "#0057FF" },
              { icon: CheckCircle2, emoji: "✅", title: "Encaminhamento", desc: "Acima do threshold, vai direto pro Closer.", color: "#0057FF" },
              { icon: CalendarCheck, emoji: "📅", title: "Agendamento Auto", desc: "Reunião marcada sem intervenção humana.", color: "#00C880" },
              { icon: DollarSign, emoji: "💰", title: "Fechamento", desc: "Closer humano ou IA fecha o negócio.", color: "#00FF88" },
            ].map((step, i, arr) => (
              <FlowStep key={step.title} step={step} index={i} total={arr.length} />
            ))}
          </div>

          {/* Summary bar */}
          <Reveal delay={900}>
            <div className="mt-16 flex items-center justify-center">
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full border border-[#00D4FF]/15 bg-[#00D4FF]/[0.03]">
                <div className="flex -space-x-1">
                  {["#00D4FF", "#0057FF", "#00FF88"].map(c => (
                    <div key={c} className="h-2 w-2 rounded-full" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <p className="text-xs text-gray-400">
                  Da prospecção ao fechamento em <span className="text-[#00D4FF] font-semibold">modo automático</span>
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ 4. PROVA SOCIAL / NÚMEROS ═══ */}
      <section className="py-24 md:py-32 relative">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }} />
        <div className="max-w-5xl mx-auto px-5 relative z-10">
          <Reveal>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#00D4FF] font-medium mb-3 text-center">Resultados reais</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl md:text-5xl tracking-tight mb-16 text-center">
              Números que um gestor comercial<br /><span className="text-gray-500">jamais conseguiu.</span>
            </h2>
          </Reveal>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
            {[
              { end: 300, suffix: "%", prefix: "+", label: "Aumento em leads qualificados", color: "#00D4FF" },
              { end: 80, suffix: "%", prefix: "-", label: "Custo vs equipe tradicional", color: "#00FF88" },
              { end: 24, suffix: "/7", prefix: "", label: "Operação contínua sem pausa", color: "#0057FF" },
              { end: 5, suffix: " min", prefix: "< ", label: "Tempo de resposta ao lead", color: "#00D4FF" },
            ].map((stat) => (
              <Reveal key={stat.label}>
                <div className="text-center p-6 rounded-xl border border-[#1a1a2e] bg-[#0d0d18]/60">
                  <p className="text-3xl md:text-4xl font-bold mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif", color: stat.color, letterSpacing: "0.03em" }}>
                    <Counter end={stat.end} prefix={stat.prefix} suffix={stat.suffix} />
                  </p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider leading-relaxed">{stat.label}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Testimonial */}
          <Reveal>
            <div className="max-w-2xl mx-auto rounded-xl border border-[#1a1a2e] bg-[#0d0d18]/60 p-8 text-center">
              <p className="text-sm text-gray-300 leading-relaxed italic mb-4">
                "Substituímos 4 SDRs e 1 BDR pelo VS SALES. Em 60 dias, triplicamos os leads qualificados e cortamos 78% do custo operacional do comercial."
              </p>
              <div>
                <p className="text-xs font-semibold text-white">Carlos Mendes</p>
                <p className="text-[10px] text-gray-500">CEO — TechScale Soluções</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ 5. PLANOS + COMPARATIVO ═══ */}
      <section id="comparativo" className="py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-5">
          <Reveal>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#00D4FF] font-medium mb-3 text-center">Planos & Preços</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl md:text-5xl tracking-tight mb-4 text-center">
              Escolha o plano ideal<br /><span className="text-gray-500">para sua operação.</span>
            </h2>
            <p className="text-sm text-gray-500 text-center mb-12 max-w-2xl mx-auto">
              Todos os planos incluem operação 24/7, integração com CRM e suporte dedicado. Cancele quando quiser.
            </p>
          </Reveal>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-5 mb-20">
            {[
              {
                name: "Starter",
                subtitle: "O SDR Digital",
                price: "1.497",
                color: "#00D4FF",
                popular: false,
                features: [
                  "Prospecção ativa e automática",
                  "Validação de ICP com IA",
                  "Qualificação básica de leads",
                  "Encaminhamento para Closer humano",
                  "Operação 24/7 sem pausa",
                  "Dashboard de métricas",
                ],
                cta: "Começar com Starter",
                hook: "Custa menos que um estagiário de pré-vendas, mas trabalha 24h por dia.",
              },
              {
                name: "Pro",
                subtitle: "A Equipe Completa",
                price: "2.497",
                color: "#0057FF",
                popular: true,
                features: [
                  "Tudo do Starter, mais:",
                  "Closer com IA integrado",
                  "Score de qualificação (0-100%)",
                  "Agendamentos automáticos",
                  "CRM alimentado automaticamente",
                  "Configuração de ICP avançada",
                  "Suporte prioritário",
                ],
                cta: "Escolher Pro",
                hook: "Um departamento comercial inteiro que não tira férias e custa metade de um único funcionário.",
              },
              {
                name: "Agency",
                subtitle: "White-Label B2B2C",
                price: "3.497",
                color: "#00FF88",
                popular: false,
                features: [
                  "Tudo do Pro, mais:",
                  "White-label com sua marca",
                  "Múltiplas instâncias de IA",
                  "Gestão multi-cliente",
                  "Revenue share disponível",
                  "API completa + documentação",
                  "Onboarding dedicado",
                ],
                cta: "Falar com comercial",
                hook: "Entregue leads qualificados e agendados para seus clientes. Prove ROI e ganhe comissão recorrente.",
              },
            ].map((plan) => (
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
                        Recomendado
                      </span>
                    </div>
                  )}

                  <div className="mb-5">
                    <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-1" style={{ color: plan.color }}>{plan.subtitle}</p>
                    <h3 className="text-xl font-bold text-white mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em" }}>{plan.name}</h3>
                  </div>

                  <div className="mb-5">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs text-gray-500">R$</span>
                      <span className="text-4xl font-black text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{plan.price}</span>
                      <span className="text-xs text-gray-500">/mês</span>
                    </div>
                  </div>

                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-xs text-gray-300">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: plan.color }} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <p className="text-[10px] text-gray-500 italic mb-4 leading-relaxed">"{plan.hook}"</p>

                  <a
                    href="#acesso"
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

          {/* Comparativo Table */}
          <Reveal>
            <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-medium mb-4 text-center">Time Humano vs VS SALES</p>
            <div className="overflow-x-auto max-w-3xl mx-auto">
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
                    ["Custo mensal", "R$ 10.000 – 15.000+", "A partir de R$ 1.497"],
                    ["Horário de operação", "8h/dia", "24/7"],
                    ["Consistência", "Variável", "100%"],
                    ["Escalabilidade", "Lenta e cara", "Imediata"],
                    ["Integração com CRM", "Manual", "Automática"],
                    ["Tempo de ramp-up", "30-90 dias", "< 48 horas"],
                    ["Follow-up", "Esquecido", "Garantido"],
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

      {/* ═══ 6. PARCEIROS ═══ */}
      <section id="parceiros" className="py-24 md:py-32 bg-[#070712]">
        <div className="max-w-6xl mx-auto px-5">
          <Reveal>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#00D4FF] font-medium mb-3 text-center">Programa de Parceiros</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl md:text-5xl tracking-tight mb-3 text-center">
              Seja um parceiro VS
            </h2>
            <p className="text-sm text-gray-400 text-center mb-12 max-w-xl mx-auto">
              Agências, consultores e integradores: revenda o VS SALES com margem real e suporte completo.
            </p>
          </Reveal>

          {/* Tiers */}
          <div className="grid md:grid-cols-3 gap-4 mb-16">
            {[
              {
                name: "Parceiro Agência", color: "#00D4FF",
                benefits: ["Comissão recorrente de 20%", "Suporte prioritário", "Co-marketing e materiais", "Dashboard de parceiro"],
              },
              {
                name: "Parceiro Integrador", color: "#0057FF",
                benefits: ["White-label disponível", "Onboarding dedicado", "SLA garantido de 4h", "API completa + docs"],
              },
              {
                name: "Parceiro Estratégico", color: "#00FF88",
                benefits: ["Equity de receita", "Acesso antecipado a produtos", "Participação no board de produto", "Margem premium exclusiva"],
              },
            ].map((tier, i) => (
              <Reveal key={tier.name} delay={i * 100}>
                <div
                  className="rounded-xl border border-[#1a1a2e] bg-[#0d0d18]/60 p-6 hover:border-opacity-50 transition-all duration-300 group"
                  style={{ ["--glow" as any]: tier.color }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = `${tier.color}30`}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = ""}
                >
                  <p className="text-xs font-semibold mb-4 tracking-wider" style={{ color: tier.color }}>{tier.name}</p>
                  <ul className="space-y-2.5 mb-6">
                    {tier.benefits.map(b => (
                      <li key={b} className="flex items-start gap-2 text-xs text-gray-300">
                        <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5" style={{ color: tier.color }} />{b}
                      </li>
                    ))}
                  </ul>
                  <a href="#partner-form" className="block text-center text-xs font-medium py-2.5 rounded-lg border border-white/10 text-gray-300 hover:text-white hover:border-white/25 transition-all">
                    Quero ser parceiro
                  </a>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Partner Form */}
          <Reveal>
            <div id="partner-form" className="max-w-lg mx-auto rounded-xl border border-[#1a1a2e] bg-[#0d0d18]/80 p-8">
              <h3 className="text-base font-semibold mb-1 text-center">Formulário de Interesse</h3>
              <p className="text-xs text-gray-500 text-center mb-6">Preencha e nossa equipe entrará em contato</p>

              {partnerSubmitted ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="h-8 w-8 text-[#00FF88] mx-auto mb-3" />
                  <p className="text-sm font-medium text-white">Formulário enviado!</p>
                  <p className="text-xs text-gray-400 mt-1">Entraremos em contato em até 24h.</p>
                </div>
              ) : (
                <form onSubmit={handlePartnerSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input required value={partnerForm.name} onChange={e => setPartnerForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="Nome" className="w-full px-3 py-2.5 rounded-lg bg-[#0A0A0F] border border-[#1a1a2e] text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#00D4FF]/40" />
                    <input required type="email" value={partnerForm.email} onChange={e => setPartnerForm(p => ({ ...p, email: e.target.value }))}
                      placeholder="E-mail" className="w-full px-3 py-2.5 rounded-lg bg-[#0A0A0F] border border-[#1a1a2e] text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#00D4FF]/40" />
                  </div>
                  <input value={partnerForm.company} onChange={e => setPartnerForm(p => ({ ...p, company: e.target.value }))}
                    placeholder="Empresa" className="w-full px-3 py-2.5 rounded-lg bg-[#0A0A0F] border border-[#1a1a2e] text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#00D4FF]/40" />
                  <select required value={partnerForm.type} onChange={e => setPartnerForm(p => ({ ...p, type: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-[#0A0A0F] border border-[#1a1a2e] text-sm text-white focus:outline-none focus:border-[#00D4FF]/40 appearance-none"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23555' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}>
                    <option value="" className="text-gray-600">Tipo de parceria</option>
                    <option value="agencia">Parceiro Agência</option>
                    <option value="integrador">Parceiro Integrador</option>
                    <option value="estrategico">Parceiro Estratégico</option>
                  </select>
                  <textarea value={partnerForm.message} onChange={e => setPartnerForm(p => ({ ...p, message: e.target.value }))}
                    placeholder="Mensagem (opcional)" rows={3}
                    className="w-full px-3 py-2.5 rounded-lg bg-[#0A0A0F] border border-[#1a1a2e] text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#00D4FF]/40 resize-none" />
                  <button type="submit" className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#00D4FF] to-[#0057FF] text-sm font-medium hover:shadow-[0_0_20px_rgba(0,212,255,0.3)] transition-all">
                    Enviar interesse
                  </button>
                </form>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ 7. URGÊNCIA ═══ */}
      <section id="acesso" className="py-24 md:py-32 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[#070712] via-transparent to-transparent" />
        <div className="max-w-lg mx-auto px-5 relative z-10">
          <Reveal>
            <div className="rounded-2xl border border-[#00D4FF]/20 bg-[#0d0d18]/80 p-8 text-center backdrop-blur-sm"
              style={{ boxShadow: "0 0 60px rgba(0,212,255,0.06)" }}>
              <p className="text-[10px] uppercase tracking-[0.3em] text-[#00FF88] font-medium mb-3">Acesso Antecipado</p>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-2xl md:text-4xl tracking-tight mb-3">
                Vagas limitadas.
              </h2>
              <p className="text-xs text-gray-400 mb-6">Garanta sua vaga antes que a lista feche.</p>

              {/* Progress bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1.5">
                  <span>37 de 50 vagas preenchidas</span>
                  <span className="text-[#00FF88]">74%</span>
                </div>
                <div className="h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#00D4FF] to-[#00FF88] rounded-full" style={{ width: "74%" }} />
                </div>
              </div>

              {earlySubmitted ? (
                <div className="py-4">
                  <CheckCircle2 className="h-8 w-8 text-[#00FF88] mx-auto mb-2" />
                  <p className="text-sm font-medium">Vaga garantida! 🎉</p>
                  <p className="text-xs text-gray-400 mt-1">Você receberá um e-mail em breve.</p>
                </div>
              ) : (
                <form onSubmit={handleEarlySubmit} className="space-y-2.5 text-left">
                  <input required value={earlyForm.name} onChange={e => setEarlyForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Seu nome" className="w-full px-3 py-2.5 rounded-lg bg-[#0A0A0F] border border-[#1a1a2e] text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#00D4FF]/40" />
                  <input required type="email" value={earlyForm.email} onChange={e => setEarlyForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="Seu melhor e-mail" className="w-full px-3 py-2.5 rounded-lg bg-[#0A0A0F] border border-[#1a1a2e] text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#00D4FF]/40" />
                  <input value={earlyForm.whatsapp} onChange={e => setEarlyForm(p => ({ ...p, whatsapp: e.target.value }))}
                    placeholder="WhatsApp (opcional)" className="w-full px-3 py-2.5 rounded-lg bg-[#0A0A0F] border border-[#1a1a2e] text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#00D4FF]/40" />
                  <button type="submit"
                    className="w-full py-3 rounded-lg bg-gradient-to-r from-[#00FF88] to-[#00D4FF] text-sm font-bold text-[#0A0A0F] hover:shadow-[0_0_25px_rgba(0,255,136,0.3)] transition-all">
                    Quero minha vaga →
                  </button>
                </form>
              )}

              <p className="text-[10px] text-gray-600 mt-4">Sem cartão de crédito. Sem compromisso. Com resultado.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ 8. FAQ ═══ */}
      <section id="faq" className="py-24 md:py-32">
        <div className="max-w-2xl mx-auto px-5">
          <Reveal>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#00D4FF] font-medium mb-3 text-center">Perguntas frequentes</p>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl md:text-4xl tracking-tight mb-10 text-center">
              Tire suas dúvidas
            </h2>
          </Reveal>

          <div className="space-y-2">
            {[
              { q: "O VS SALES substitui 100% do meu time comercial?", a: "Depende da sua operação. Para negócios com ticket médio até R$ 5.000, sim — o VS SALES faz prospecção, qualificação e fechamento completos. Para tickets maiores, recomendamos que o Closer humano assuma após a qualificação automática." },
              { q: "Quanto tempo leva para implementar?", a: "Menos de 48 horas. A configuração é guiada e o sistema já começa a operar assim que o ICP é definido e as integrações são conectadas." },
              { q: "Funciona para qualquer segmento?", a: "Sim. O VS SALES opera com IA adaptativa que se ajusta a qualquer segmento B2B ou B2C. Você define o ICP e os critérios de qualificação." },
              { q: "E se o lead não quiser falar com IA?", a: "O sistema é configurável. Você pode definir que leads acima de determinado score sejam direcionados diretamente para um humano, sem passar pela IA de fechamento." },
              { q: "Posso configurar o score de qualificação?", a: "Totalmente. O threshold de qualificação é 100% configurável — você define os critérios, pesos e pontuação mínima para encaminhamento." },
              { q: "Como funciona a integração com meu CRM atual?", a: "O VS SALES alimenta automaticamente seu CRM via API. Suportamos integração nativa com os principais CRMs do mercado, além de webhooks e Zapier." },
            ].map((item) => (
              <Reveal key={item.q}>
                <FAQItem question={item.q} answer={item.a} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 9. FOOTER / CTA FINAL ═══ */}
      <section className="py-24 md:py-32 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-[#070712] via-transparent to-transparent" />
        <div className="max-w-3xl mx-auto px-5 text-center relative z-10">
          <Reveal>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-3xl md:text-5xl lg:text-6xl tracking-tight mb-4">
              Sua concorrência já vai usar isso.<br />
              <span className="bg-gradient-to-r from-[#00D4FF] to-[#00FF88] bg-clip-text text-transparent">Você vai esperar?</span>
            </h2>
            <p className="text-sm text-gray-400 mb-8 max-w-md mx-auto">
              Comece agora e transforme sua operação comercial em uma máquina de receita previsível.
            </p>
            <a
              href="#acesso"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-gradient-to-r from-[#00D4FF] to-[#0057FF] font-semibold text-sm hover:shadow-[0_0_40px_rgba(0,212,255,0.4)] transition-all"
            >
              Começar agora com o VS SALES
              <ArrowRight className="h-4 w-4" />
            </a>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1a1a2e] py-10">
        <div className="max-w-6xl mx-auto px-5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <img src={vsLogo} alt="VS Soluções" className="h-7 w-7 object-contain" />
              <div>
                <span className="text-xs font-semibold text-white">VS Soluções</span>
                <span className="text-[10px] text-gray-600 ml-2">Tecnologia que substitui. Resultado que comprova.</span>
              </div>
            </div>
            <div className="flex items-center gap-6 text-[10px] text-gray-600">
              <a href="#" className="hover:text-gray-400 transition-colors">Política de Privacidade</a>
              <a href="#" className="hover:text-gray-400 transition-colors">Termos de Uso</a>
              <a href="#" className="hover:text-gray-400 transition-colors">Contato</a>
              <a href="/admin" className="hover:text-[#00D4FF] transition-colors flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Página do Admin
              </a>
            </div>
          </div>
          <p className="text-[10px] text-gray-700 text-center mt-6">© 2026 VS Soluções. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* Glitch + animations CSS */}
      <style>{`
        .glitch-text {
          position: relative;
          display: inline;
        }
        .glitch-text::before,
        .glitch-text::after {
          content: "Fechamento.";
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          pointer-events: none;
          background: inherit;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .glitch-text::before {
          animation: glitch-1 4s infinite linear;
          color: #00D4FF;
          -webkit-text-fill-color: #00D4FF;
          opacity: 0.6;
        }
        .glitch-text::after {
          animation: glitch-2 4s infinite linear 0.1s;
          color: #00FF88;
          -webkit-text-fill-color: #00FF88;
          opacity: 0.4;
        }
        @keyframes glitch-1 {
          0%, 90%, 100% { clip-path: inset(0 0 100% 0); transform: none; }
          92% { clip-path: inset(20% 0 50% 0); transform: translateX(-3px); }
          94% { clip-path: inset(60% 0 10% 0); transform: translateX(3px); }
          96% { clip-path: inset(40% 0 30% 0); transform: translateX(-2px); }
          98% { clip-path: inset(70% 0 5% 0); transform: translateX(2px); }
        }
        @keyframes glitch-2 {
          0%, 88%, 100% { clip-path: inset(0 0 100% 0); transform: none; }
          90% { clip-path: inset(50% 0 20% 0); transform: translateX(4px); }
          93% { clip-path: inset(10% 0 60% 0); transform: translateX(-4px); }
          95% { clip-path: inset(80% 0 3% 0); transform: translateX(2px); }
          97% { clip-path: inset(30% 0 40% 0); transform: translateX(-1px); }
        }
        html {
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  );
}
