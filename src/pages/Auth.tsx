import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import vsLogo from "@/assets/vs-sales-logo.png";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Zap } from "lucide-react";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate("/");
    } catch (error: any) {
      toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: "#06060F" }}>
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Radial glow top */}
        <div
          className="absolute -top-[40%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle, hsl(221 83% 53%), transparent 70%)" }}
        />
        {/* Radial glow bottom-right */}
        <div
          className="absolute -bottom-[30%] -right-[10%] w-[600px] h-[600px] rounded-full opacity-[0.05]"
          style={{ background: "radial-gradient(circle, hsl(190 90% 50%), transparent 70%)" }}
        />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-[420px] mx-4 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-3">
            <img src={vsLogo} alt="VS SALES" className="h-10 w-10 object-contain" />
            <span
              className="text-xl font-bold tracking-[0.15em] text-white"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              VS SALES
            </span>
          </div>
          <p className="text-sm text-[#7a7f9a]">
            Plataforma inteligente de vendas
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-[1px]"
          style={{
            background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(59,130,246,0.05) 40%, rgba(255,255,255,0.03) 60%, rgba(6,182,212,0.1))",
          }}
        >
          <div className="rounded-2xl px-7 py-8 sm:px-8 sm:py-9" style={{ background: "#0C0C1A" }}>
            <h2 className="text-lg font-semibold text-white mb-1">Bem-vindo de volta</h2>
            <p className="text-[13px] text-[#6b7094] mb-7">Entre com suas credenciais para acessar</p>

            {/* Google button */}
            <button
              onClick={handleGoogle}
              disabled={googleLoading}
              className="w-full h-11 rounded-xl flex items-center justify-center gap-2.5 text-sm font-medium transition-all duration-200 disabled:opacity-50 mb-6"
              style={{
                background: "#12122a",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#c8cce0",
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {googleLoading ? "Conectando..." : "Continuar com Google"}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
              <span className="text-[11px] text-[#4a4e6a] uppercase tracking-widest font-medium">ou</span>
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[#8b90b0] ml-0.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4a4e6a]" />
                  <input
                    type="email"
                    placeholder="nome@empresa.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full h-11 pl-10 pr-4 rounded-xl text-sm text-white placeholder:text-[#3a3e58] outline-none transition-all duration-200 focus:ring-1"
                    style={{
                      background: "#0A0A1E",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = "rgba(59,130,246,0.4)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.08)"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.boxShadow = "none"; }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[#8b90b0] ml-0.5">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4a4e6a]" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full h-11 pl-10 pr-11 rounded-xl text-sm text-white placeholder:text-[#3a3e58] outline-none transition-all duration-200"
                    style={{
                      background: "#0A0A1E",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = "rgba(59,130,246,0.4)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.08)"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.boxShadow = "none"; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4a4e6a] hover:text-[#8b90b0] transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 mt-2 group"
                style={{
                  background: "linear-gradient(135deg, hsl(221 83% 50%), hsl(221 83% 60%))",
                  boxShadow: "0 4px 15px -3px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
                }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 6px 25px -3px rgba(59,130,246,0.45), inset 0 1px 0 rgba(255,255,255,0.15)")}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 4px 15px -3px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.1)")}
              >
                {loading ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 mt-8 text-[12px] text-[#4a4e6a]">
          <Zap className="h-3 w-3" />
          <span>Powered by</span>
          <span className="font-semibold text-[#6b7094]">VS Soluções</span>
        </div>

        {/* Back link */}
        <div className="text-center mt-4">
          <button
            onClick={() => navigate("/site")}
            className="text-[12px] text-[#4a4e6a] hover:text-[#8b90b0] transition-colors"
          >
            ← Voltar ao site
          </button>
        </div>
      </div>
    </div>
  );
}
