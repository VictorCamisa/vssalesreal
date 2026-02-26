import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Rocket, Mail, Lock, User, CheckCircle2, Brain, MessageCircle, TrendingUp } from "lucide-react";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({
          title: "Conta criada!",
          description: "Verifique seu email para confirmar o cadastro.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    { icon: Brain, text: "Agente de IA que qualifica e fecha vendas 24/7" },
    { icon: MessageCircle, text: "Integração direta com WhatsApp via Evolution API" },
    { icon: TrendingUp, text: "Dashboard com métricas em tempo real" },
    { icon: CheckCircle2, text: "Extração automática de leads de grupos e conversas" },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Left: Form */}
      <div className="flex flex-1 items-center justify-center bg-background p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          {/* Logo */}
          <div className="flex flex-col items-center gap-4 lg:items-start">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary glow-primary">
              <Rocket className="h-7 w-7 text-primary-foreground" />
            </div>
            <div className="text-center lg:text-left">
              <h1 className="text-3xl font-bold tracking-tight">VS LEADS</h1>
              <p className="text-sm text-muted-foreground mt-1">por VS Soluções</p>
            </div>
          </div>

          {/* Form Card */}
          <div className="glass rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold">{isLogin ? "Entrar" : "Criar conta"}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isLogin ? "Acesse sua conta para continuar" : "Preencha os dados para criar sua conta"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-xs font-medium">Nome completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName" type="text" placeholder="Seu nome"
                      value={fullName} onChange={(e) => setFullName(e.target.value)}
                      className="pl-10 h-11 rounded-xl bg-secondary/50 border-border/50 focus:border-primary/50" required
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-medium">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email" type="email" placeholder="seu@email.com"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 rounded-xl bg-secondary/50 border-border/50 focus:border-primary/50" required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-medium">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password" type="password" placeholder="••••••••"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11 rounded-xl bg-secondary/50 border-border/50 focus:border-primary/50" required minLength={6}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full h-11 rounded-xl gradient-primary hover:opacity-90 transition-opacity font-semibold" disabled={loading}>
                {loading ? "Carregando..." : isLogin ? "Entrar" : "Criar conta"}
              </Button>
            </form>

            <div className="relative">
              <Separator className="opacity-30" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card/60 backdrop-blur px-3 text-[11px] text-muted-foreground">
                ou continue com
              </span>
            </div>

            <Button
              type="button" variant="outline"
              className="w-full h-11 rounded-xl border-border/50 hover:bg-secondary/50"
              onClick={async () => {
                const { error } = await lovable.auth.signInWithOAuth("google", {
                  redirect_uri: window.location.origin,
                });
                if (error) {
                  toast({ title: "Erro", description: error.message, variant: "destructive" });
                }
              }}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continuar com Google
            </Button>

            <div className="text-center">
              <button type="button" onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-primary hover:text-primary/80 transition-colors">
                {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Banner */}
      <div className="hidden lg:flex flex-1 items-center justify-center gradient-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-transparent to-primary-foreground/10" />
        <div className="relative z-10 max-w-lg p-12 space-y-8">
          <div>
            <h2 className="text-4xl font-bold text-primary-foreground leading-tight">
              Vendas 100%<br />gerenciadas por IA
            </h2>
            <p className="text-primary-foreground/80 mt-4 text-lg">
              Conecte seu WhatsApp, extraia contatos e deixe a Inteligência Artificial qualificar e fechar vendas automaticamente.
            </p>
          </div>

          <div className="space-y-4">
            {benefits.map((b, i) => (
              <div key={i} className="flex items-center gap-3 text-primary-foreground/90">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-foreground/15 shrink-0">
                  <b.icon className="h-4 w-4" />
                </div>
                <span className="text-sm">{b.text}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/15">
              <Rocket className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-primary-foreground font-bold text-sm">VS Soluções</p>
              <p className="text-primary-foreground/60 text-xs">Fábrica de Ecossistemas Operacionais</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
